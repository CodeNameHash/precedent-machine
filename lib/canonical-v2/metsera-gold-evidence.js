const crypto = require('crypto');
const path = require('path');

const sourceUniverse = require(path.join(
  __dirname,
  '../../evidence/process-intelligence/metsera-gold/source-universe.v1.json',
));
const exclusivityGold = require(path.join(
  __dirname,
  '../../evidence/process-intelligence/metsera-gold/exclusivity-gold.v1.json',
));
const phaseAllowlist = require(path.join(
  __dirname,
  '../../.github/phase-allowlists/wp-metsera-gold-evidence-v1.json',
));

const AUTHORITY = 'official-sec-edgar-primary-document';
const CUTOFF = '2025-11-13';
const REQUIRED_ACCESSIONS = Object.freeze([
  '0000078003-25-000159',
  '0001193125-25-210030',
  '0001193125-25-242494',
  '0001193125-25-257435',
  '0001193125-25-263828',
  '0001193125-25-263933',
  '0001193125-25-273292',
  '0001193125-25-273435',
  '0001193125-25-280387',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function invariant(condition, message) {
  if (!condition) throw new Error(`Metsera gold evidence: ${message}`);
}

function makeEvidenceIdentity({ accession, source, interval, byteStart, byteEnd, verbatimUtf8 }) {
  const resolvedAccession = accession || (source && source.accession);
  const resolvedByteStart = byteStart ?? (interval && interval.byteStart);
  const resolvedByteEnd = byteEnd ?? (interval && interval.byteEnd);
  invariant(typeof resolvedAccession === 'string', 'evidence identity requires an accession');
  invariant(Number.isInteger(resolvedByteStart) && Number.isInteger(resolvedByteEnd), 'evidence identity requires integer byte bounds');
  invariant(typeof verbatimUtf8 === 'string', 'evidence identity requires UTF-8 text');
  return `sha256:${sha256(`${resolvedAccession}:${resolvedByteStart}:${resolvedByteEnd}:${verbatimUtf8}`)}`;
}

function indexDocuments(universe) {
  invariant(universe && universe.sourceAuthority === AUTHORITY, 'unapproved source authority');
  invariant(universe.sealed === true, 'source universe is not sealed');
  invariant(universe.cutoff && universe.cutoff.inclusiveDate === CUTOFF, 'cutoff is not the sealed inclusive date');
  invariant(Array.isArray(universe.documents), 'source universe has no documents');
  invariant(universe.documents.length === REQUIRED_ACCESSIONS.length, 'source universe omits or adds a filing');

  const found = new Map();
  for (const document of universe.documents) {
    invariant(document && typeof document === 'object', 'source document is invalid');
    invariant(REQUIRED_ACCESSIONS.includes(document.accession), `unexpected filing ${document.accession}`);
    invariant(!found.has(document.accession), `duplicate filing ${document.accession}`);
    invariant(document.filedOn <= CUTOFF, `cutoff breach ${document.accession}`);
    invariant(document.officialUrl === `https://www.sec.gov/Archives/edgar/data/${Number(document.cik)}/${document.accession.replaceAll('-', '')}/${document.primaryDocument}`, `non-canonical SEC URL ${document.accession}`);
    invariant(/^[a-f0-9]{64}$/.test(document.sha256), `missing document hash ${document.accession}`);
    invariant(Number.isInteger(document.byteLength) && document.byteLength > 0, `invalid byte length ${document.accession}`);
    found.set(document.accession, document);
  }
  for (const accession of REQUIRED_ACCESSIONS) invariant(found.has(accession), `missing filing ${accession}`);
  return found;
}

function validateAllowlist(allowlist, documents) {
  invariant(allowlist && allowlist.allowedReadAuthority === AUTHORITY, 'allowlist authority injection');
  invariant(Array.isArray(allowlist.allowedInputs), 'allowlist has no inputs');
  invariant(allowlist.allowedInputs.length === REQUIRED_ACCESSIONS.length, 'allowlist omits or adds a filing');
  const inputs = new Map(allowlist.allowedInputs.map((input) => [input.accession, input]));
  for (const accession of REQUIRED_ACCESSIONS) {
    const source = documents.get(accession);
    const input = inputs.get(accession);
    invariant(input, `allowlist missing ${accession}`);
    invariant(input.officialUrl === source.officialUrl && input.sha256 === source.sha256 && input.byteLength === source.byteLength, `allowlist source drift ${accession}`);
  }
  invariant(Array.isArray(allowlist.deniedAuthorities), 'allowlist does not deny prohibited authorities');
  for (const prohibited of ['extraction', 'materialisation', 'writer', 'serving', 'database', 'query-execution', 'release', 'import', 'activation', 'production', 'staging-write', 'contract-freeze']) {
    invariant(allowlist.deniedAuthorities.includes(prohibited), `allowlist admits ${prohibited}`);
  }
}

function validatePassageAgainstBytes(passage, bytes) {
  invariant(Buffer.isBuffer(bytes), `source bytes missing for ${passage.id}`);
  const { byteStart, byteEnd, byteLength } = passage.interval;
  invariant(byteStart >= 0 && byteEnd > byteStart && byteLength === byteEnd - byteStart, `invalid interval ${passage.id}`);
  invariant(byteEnd <= bytes.length, `interval exceeds source bytes ${passage.id}`);
  const actual = bytes.subarray(byteStart, byteEnd);
  invariant(actual.toString('utf8') === passage.verbatimUtf8, `interval text drift ${passage.id}`);
  invariant(sha256(actual) === passage.verbatimSha256, `interval hash drift ${passage.id}`);
  return true;
}

function validateEvidence(universe, evidence) {
  const documents = indexDocuments(universe);
  invariant(evidence && evidence.sourceAuthority === AUTHORITY, 'evidence authority injection');
  invariant(evidence.sealed === true, 'evidence is not sealed');
  invariant(evidence.cutoff && evidence.cutoff.inclusiveDate === CUTOFF, 'evidence cutoff drift');
  invariant(Array.isArray(evidence.partyRegistry) && Array.isArray(evidence.bidderTracks) && Array.isArray(evidence.passages), 'evidence is incomplete');

  const parties = new Map(evidence.partyRegistry.map((party) => [party.id, party]));
  const tracks = new Map(evidence.bidderTracks.map((track) => [track.id, track]));
  invariant(parties.size === evidence.partyRegistry.length, 'duplicate party identifier');
  invariant(tracks.size === evidence.bidderTracks.length, 'duplicate track identifier');
  const passageIds = new Set();
  for (const passage of evidence.passages) {
    invariant(!passageIds.has(passage.id), `duplicate passage ${passage.id}`);
    passageIds.add(passage.id);
    const document = documents.get(passage.source.accession);
    invariant(document, `passage source is outside universe ${passage.id}`);
    invariant(passage.source.officialUrl === document.officialUrl && passage.source.documentSha256 === document.sha256 && passage.source.documentByteLength === document.byteLength, `source identity drift ${passage.id}`);
    invariant(passage.date <= CUTOFF, `passage cutoff breach ${passage.id}`);
    invariant(passage.interval && passage.interval.encoding === 'utf-8', `interval encoding drift ${passage.id}`);
    invariant(Buffer.byteLength(passage.verbatimUtf8, 'utf8') === passage.interval.byteLength, `verbatim byte drift ${passage.id}`);
    invariant(sha256(Buffer.from(passage.verbatimUtf8, 'utf8')) === passage.verbatimSha256, `verbatim hash drift ${passage.id}`);
    invariant(makeEvidenceIdentity(passage) === passage.evidenceIdentity, `evidence identity drift ${passage.id}`);
    invariant(passage.contextUnit && passage.contextUnit.type === 'one-source-paragraph' && passage.contextUnit.passageId === passage.id && passage.contextUnit.paragraphCount === 1, `missing one-paragraph context ${passage.id}`);
    const track = tracks.get(passage.trackId);
    invariant(track, `missing track ${passage.id}`);
    for (const partyId of passage.partyIds) {
      invariant(parties.has(partyId), `unknown party ${partyId}`);
      invariant(track.allowedPartyIds.includes(partyId), `party/role/track crossing ${passage.id}`);
    }
    invariant(Array.isArray(passage.relatedDiscussionIds), `missing related discussion ${passage.id}`);
    if (passage.kind.includes('exclusivity') || passage.kind.includes('solicitation')) invariant(passage.relatedDiscussionIds.length > 0, `missing related discussion ${passage.id}`);
  }
  for (const passage of evidence.passages) for (const id of passage.relatedDiscussionIds) invariant(passageIds.has(id), `unknown related discussion ${id}`);

  invariant(Array.isArray(evidence.falseMatchTraps) && evidence.falseMatchTraps.length > 0, 'false-match traps missing');
  for (const trap of evidence.falseMatchTraps) {
    invariant(trap.classification === 'not-transaction-exclusivity', `false-match admission ${trap.id}`);
    invariant(!passageIds.has(trap.id), `false match admitted as evidence ${trap.id}`);
    const document = documents.get(trap.source.accession);
    invariant(document && trap.source.documentSha256 === document.sha256, `false-match source drift ${trap.id}`);
    invariant(Buffer.byteLength(trap.verbatimUtf8, 'utf8') === trap.interval.byteLength && sha256(Buffer.from(trap.verbatimUtf8, 'utf8')) === trap.verbatimSha256, `false-match interval drift ${trap.id}`);
  }
  return { documents, parties, tracks, passageIds };
}

function verifySourceBytes(accession, bytes, universe = sourceUniverse) {
  const document = indexDocuments(universe).get(accession);
  invariant(document, `source is outside universe ${accession}`);
  invariant(Buffer.isBuffer(bytes), `source bytes missing ${accession}`);
  invariant(bytes.length === document.byteLength, `source byte-length drift ${accession}`);
  invariant(sha256(bytes) === document.sha256, `source hash drift ${accession}`);
  return true;
}

function loadSealedMetseraGoldEvidence() {
  validateAllowlist(phaseAllowlist, indexDocuments(sourceUniverse));
  validateEvidence(sourceUniverse, exclusivityGold);
  return Object.freeze({ sourceUniverse, exclusivityGold, phaseAllowlist });
}

module.exports = {
  AUTHORITY,
  CUTOFF,
  REQUIRED_ACCESSIONS,
  makeEvidenceIdentity,
  validateAllowlist,
  validateEvidence,
  validatePassageAgainstBytes,
  verifySourceBytes,
  loadSealedMetseraGoldEvidence,
};
