'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const { contentId } = require('./canonical-bytes');
const { isPermittedCanonicalV2Runtime } = require('./feature-flags');

const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const REVIEW_PATH =
  'docs/codex-program/notes/N1-SEVEN-FAMILY-GROUPING-APPLICATION-INDEPENDENT-REVIEW-2026-09-01.md';
const REVIEW_BINDING = Object.freeze({
  byte_length: 2671,
  sha256: '70ee8cca4020f1e7cce4c4a6810b021c587c73641148144e116d9e915bbd6b12',
  git_blob_oid: 'e36394bacb4a4b4cc8d2c7236ffaa8a9acfda07a',
});

const FAMILY_SOURCES = Object.freeze([
  Object.freeze({
    family_key: 'DIVIDENDS',
    title: 'Dividends',
    package: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-dividends-grouping-successor-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-dividends-grouping-successor-2026-09-01B.json'),
    }),
    disposition: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-dividends-1-profile-inventory-disposition-grouping-successor-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-dividends-1-profile-inventory-disposition-grouping-successor-2026-09-01B.json'),
    }),
    seal: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-dividends-grouping-family-package-seal-receipt-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-dividends-grouping-family-package-seal-receipt-2026-09-01B.json'),
      record_id: '897673b7bd8532163cc31c81fb79b0509d5021042be9173ff13cf98d7ef90869',
    }),
    comparison_line_order: Object.freeze(['Dividend coordination']),
    party_band_order: Object.freeze([null]),
    v1: Object.freeze({
      surface: 'No dedicated Dividends table',
      rows: Object.freeze(['Interim Operating: Dividends and Distributions']),
      note: 'The V1 row concerns restrictions on dividends. It does not show dividend-date coordination.',
    }),
  }),
  Object.freeze({
    family_key: 'MAE_DEFINITION',
    title: 'Material Adverse Effect',
    package: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-mae-definition-grouping-successor-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-mae-definition-grouping-successor-2026-09-01B.json'),
    }),
    disposition: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-mae-4-profile-inventory-disposition-grouping-successor-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-mae-4-profile-inventory-disposition-grouping-successor-2026-09-01B.json'),
    }),
    seal: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-mae-definition-grouping-family-package-seal-receipt-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-mae-definition-grouping-family-package-seal-receipt-2026-09-01B.json'),
      record_id: 'cb266b0d06dcd26a9e7998608f53febd8d03284cf24a0274d7b2243aea526c80',
    }),
    comparison_line_order: Object.freeze([
      'Definition prongs',
      'MAE Test',
      'Carve-outs',
      'Disproportionality relationships',
      'Exceptions to carve-outs',
    ]),
    party_band_order: Object.freeze([null]),
    v1: Object.freeze({
      surface: 'Dedicated Material Adverse Effect table',
      rows: Object.freeze([
        'Definition prongs',
        'MAE Test',
        'Carve-outs',
        'Disproportionality relationships',
        'Exceptions to carve-outs',
      ]),
      note: null,
    }),
  }),
  Object.freeze({
    family_key: 'GUARANTY_FINANCING_PARTY',
    title: 'Guaranty',
    package: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-guaranty-financing-party-grouping-successor-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-guaranty-financing-party-grouping-successor-2026-09-01B.json'),
    }),
    disposition: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-guaranty-5-profile-inventory-disposition-grouping-successor-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-guaranty-5-profile-inventory-disposition-grouping-successor-2026-09-01B.json'),
    }),
    seal: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-guaranty-financing-party-grouping-family-package-seal-receipt-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-guaranty-financing-party-grouping-family-package-seal-receipt-2026-09-01B.json'),
      record_id: '824f026c95854c2b574f0fd504bb82b7392bc31f6cc3d50b21200b383ebc4745',
    }),
    comparison_line_order: Object.freeze(['Performance guaranty']),
    party_band_order: Object.freeze([null]),
    v1: Object.freeze({
      surface: 'No dedicated Guaranty table',
      rows: Object.freeze(['Deal summary: Buyer type']),
      note: 'Buyer type can reflect guaranty evidence, but it does not compare guaranty clauses.',
    }),
  }),
  Object.freeze({
    family_key: 'APPRAISAL_DISSENTERS_RIGHTS',
    title: "Appraisal and dissenters' rights",
    package: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-appraisal-dissenters-rights-grouping-successor-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-appraisal-dissenters-rights-grouping-successor-2026-09-01B.json'),
    }),
    disposition: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-appraisal-dissenters-rights-5-profile-inventory-disposition-grouping-successor-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-appraisal-dissenters-rights-5-profile-inventory-disposition-grouping-successor-2026-09-01B.json'),
    }),
    seal: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-appraisal-dissenters-rights-grouping-family-package-seal-receipt-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-appraisal-dissenters-rights-grouping-family-package-seal-receipt-2026-09-01B.json'),
      record_id: 'e2e7a56d174d674ca5dff08b80dacc5f5768303bd9213345bd4b55278bc0a43d',
    }),
    comparison_line_order: Object.freeze(["Appraisal / dissenters' rights"]),
    party_band_order: Object.freeze([null]),
    v1: Object.freeze({
      surface: 'Embedded fields, no standalone table',
      rows: Object.freeze([
        'Consideration: Appraisal rights',
        'Closing Conditions: Dissenting Shares Threshold',
      ]),
      note: null,
    }),
  }),
  Object.freeze({
    family_key: 'FINANCING_COVENANTS',
    title: 'Financing Covenants',
    package: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-financing-covenants-grouping-successor-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-financing-covenants-grouping-successor-2026-09-01B.json'),
    }),
    disposition: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-financing-covenants-5-profile-inventory-disposition-grouping-successor-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-financing-covenants-5-profile-inventory-disposition-grouping-successor-2026-09-01B.json'),
    }),
    seal: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-financing-covenants-grouping-family-package-seal-receipt-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-financing-covenants-grouping-family-package-seal-receipt-2026-09-01B.json'),
      record_id: '40844fee744b338d7448ba9d0d7957bc4a28b3ad725b1f11ec911bfecf4806bf',
    }),
    comparison_line_order: Object.freeze(['Payoff', 'Obtain financing', 'No financing condition']),
    party_band_order: Object.freeze([null]),
    v1: Object.freeze({
      surface: 'Adjacent fields, no dedicated Financing Covenants table',
      rows: Object.freeze([
        'Other Covenants: Financing cooperation required',
        'Other Covenants: Financing cooperation scope',
        'Other Covenants: Breach is a closing condition',
        'Closing Conditions: Financing / Sufficient Funds',
      ]),
      note: 'The V1 sufficient-funds field is not a no-financing-condition acknowledgement.',
    }),
  }),
  Object.freeze({
    family_key: 'CONSIDERATION',
    title: 'Consideration',
    package: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-consideration-grouping-successor-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-consideration-grouping-successor-2026-09-01B.json'),
    }),
    disposition: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-consideration-7-profile-inventory-disposition-grouping-successor-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-consideration-7-profile-inventory-disposition-grouping-successor-2026-09-01B.json'),
    }),
    seal: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-consideration-grouping-family-package-seal-receipt-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-consideration-grouping-family-package-seal-receipt-2026-09-01B.json'),
      record_id: '98410f9978933db4e0dd11eb811f23c465acb3dbb139579156c819ae9ab4bc61',
    }),
    comparison_line_order: Object.freeze(['Cash component', "Appraisal / dissenters' rights"]),
    party_band_order: Object.freeze([null]),
    v1: Object.freeze({
      surface: 'Dedicated Consideration table',
      rows: Object.freeze(['Consideration type', 'Per-share consideration', 'Appraisal rights']),
      note: null,
    }),
  }),
  Object.freeze({
    family_key: 'INTERIM_OPERATING',
    title: 'Interim Operating',
    package: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-family-work3-profile-package-interim-operating-grouping-successor-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-interim-operating-grouping-successor-2026-09-01B.json'),
    }),
    disposition: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-interim-operating-113-profile-inventory-disposition-grouping-successor-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-interim-operating-113-profile-inventory-disposition-grouping-successor-2026-09-01B.json'),
    }),
    seal: Object.freeze({
      path: `${CONTROL}/m7-v2-repair-interim-operating-grouping-family-package-seal-receipt-2026-09-01B.json`,
      file: require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-interim-operating-grouping-family-package-seal-receipt-2026-09-01B.json'),
      record_id: 'c252142bdbfb1f6dc09f7ef0db2b972df25727f3c78105a039877dc7164bbe2a',
    }),
    comparison_line_order: Object.freeze([
      'Accounting changes',
      'Capital expenditures',
      'Charter and bylaws',
      'Compensation and benefits',
      'Material contracts',
      'Indebtedness and loans',
      'Dividends and distributions',
      'Hiring and termination',
      'Insurance',
      'Intellectual property',
      'Securities issuances',
      'Liens and encumbrances',
      'Mergers and acquisitions',
      'Equity repurchases',
      'Litigation settlements',
      'Tax matters',
    ]),
    party_band_order: Object.freeze(['Target', 'Parent']),
    v1: Object.freeze({
      surface: 'Dedicated Interim Operating table',
      rows: Object.freeze([
        'Target and Parent party sections',
        'Affirmative covenants',
        'Exceptions',
        'Negative covenants',
        'Other restrictions',
      ]),
      note: 'V1 also displays specific-restriction pills within each negative-covenant row.',
    }),
  }),
]);

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function gitBlobOid(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(bytes).digest('hex');
}

function readJson(source) {
  const bytes = fs.readFileSync(source.file);
  return { bytes, record: JSON.parse(bytes.toString('utf8')) };
}

function assertBinding(source, binding, loaded, label) {
  if (!binding || binding.path !== source.path
    || binding.byte_length !== loaded.bytes.length
    || binding.sha256 !== sha256(loaded.bytes)
    || binding.git_blob_oid !== gitBlobOid(loaded.bytes)
    || binding.schema_version !== loaded.record.schema_version
    || typeof binding.record_id_field !== 'string'
    || loaded.record[binding.record_id_field] !== binding.record_id) {
    throw new Error(`${label} does not match its sealed binding`);
  }
}

function profileKeyHash(profileKey) {
  const parts = String(profileKey || '').split(':');
  return parts.length >= 4 ? parts[parts.length - 1] : null;
}

function comparisonRows(spec, disposition) {
  const grouped = new Map();
  for (const profileDisposition of disposition.profile_dispositions) {
    if (profileDisposition.disposition !== 'APPROVE') {
      throw new Error(`${spec.family_key} contains a non-approved preview profile`);
    }
    const application = profileDisposition.grouping_ruling_application;
    if (!application || application.family_key !== spec.family_key
      || application.state !== 'APPLIED_PENDING_INDEPENDENT_REVIEW') {
      throw new Error(`${spec.family_key} grouping application is invalid`);
    }
    const candidates = application.approved_comparison_lines.map((line) => ({
      comparison_line: line,
      row_kind: 'COMPARISON',
    }));
    if (application.approved_link_target) {
      candidates.push({
        comparison_line: application.approved_link_target,
        row_kind: 'LINK',
      });
    }
    if (candidates.length === 0) {
      throw new Error(`${spec.family_key} profile has no approved comparison line or link`);
    }
    for (const candidate of candidates) {
      const key = `${candidate.row_kind}:${candidate.comparison_line}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          comparison_line: candidate.comparison_line,
          row_kind: candidate.row_kind,
          bands: new Map(),
          comparison_fields: new Set(),
          grouping_notes: new Set(),
          profile_keys: new Set(),
        });
      }
      const row = grouped.get(key);
      const band = application.party_band;
      row.bands.set(band, (row.bands.get(band) || 0) + 1);
      for (const field of application.approved_comparison_fields) {
        row.comparison_fields.add(field);
      }
      if (application.grouping_note) row.grouping_notes.add(application.grouping_note);
      row.profile_keys.add(profileDisposition.proposed_profile_key);
    }
  }
  const rows = [...grouped.values()].map((row) => {
    const bands = [...row.bands].map(([party_band, profile_count]) => ({
      party_band,
      profile_count,
    }));
    if (bands.some((band) => !spec.party_band_order.includes(band.party_band))) {
      throw new Error(`${spec.family_key} party-band set drifted`);
    }
    bands.sort((left, right) => (
      spec.party_band_order.indexOf(left.party_band)
        - spec.party_band_order.indexOf(right.party_band)
    ));
    return {
      comparison_line: row.comparison_line,
      row_kind: row.row_kind,
      bands,
      comparison_fields: [...row.comparison_fields],
      grouping_notes: [...row.grouping_notes],
      profile_count: row.profile_keys.size,
    };
  });
  const actualLines = new Set(rows.map((row) => row.comparison_line));
  if (actualLines.size !== spec.comparison_line_order.length
    || spec.comparison_line_order.some((line) => !actualLines.has(line))) {
    throw new Error(`${spec.family_key} comparison-line set drifted`);
  }
  return rows.sort((left, right) => (
    spec.comparison_line_order.indexOf(left.comparison_line)
      - spec.comparison_line_order.indexOf(right.comparison_line)
  ));
}

function loadFamily(spec) {
  const sealedPackage = readJson(spec.package);
  const disposition = readJson(spec.disposition);
  const seal = readJson(spec.seal).record;
  validateSealReceipt(spec, seal);
  assertBinding(spec.package, seal.package_transition?.successor, sealedPackage, spec.family_key);
  assertBinding(
    spec.disposition,
    seal.successor_disposition_binding,
    disposition,
    `${spec.family_key} disposition`,
  );
  if (sealedPackage.record.family_key !== spec.family_key
    || sealedPackage.record.state !== 'BEN_APPROVED_FAMILY_PROFILE_PACKAGE'
    || disposition.record.family_key !== spec.family_key
    || sealedPackage.record.profiles.length !== disposition.record.profile_dispositions.length
    || sealedPackage.record.profiles.length !== seal.profile_accounting?.profile_count) {
    throw new Error(`${spec.family_key} package accounting drifted`);
  }
  const packageProfiles = new Set(sealedPackage.record.profiles.map((profile) => (
    profileKeyHash(profile.profile_key)
  )));
  const dispositionProfiles = new Set(disposition.record.profile_dispositions.map((profile) => (
    profile.proposed_profile_key
  )));
  if (packageProfiles.has(null)
    || packageProfiles.size !== sealedPackage.record.profiles.length
    || dispositionProfiles.size !== disposition.record.profile_dispositions.length
    || [...packageProfiles].some((profileKey) => !dispositionProfiles.has(profileKey))) {
    throw new Error(`${spec.family_key} package and disposition profiles do not match`);
  }
  const rows = comparisonRows(spec, disposition.record);
  return {
    family_key: spec.family_key,
    title: spec.title,
    profile_count: sealedPackage.record.profiles.length,
    package: {
      path: spec.package.path,
      byte_length: sealedPackage.bytes.length,
      sha256: sha256(sealedPackage.bytes),
      family_profile_package_id: sealedPackage.record.family_profile_package_id,
      approved_on: sealedPackage.record.family_approval?.approved_on || null,
    },
    v1: {
      surface: spec.v1.surface,
      rows: [...spec.v1.rows],
      note: spec.v1.note,
    },
    v2_rows: rows,
    unmeasured_concepts: (disposition.record.unmeasured_concepts || []).map((entry) => ({
      concept: entry.concept,
      status: entry.status,
    })),
  };
}

function validateSealReceipt(spec, seal) {
  const unsignedSeal = { ...seal };
  delete unsignedSeal.grouping_family_package_seal_receipt_id;
  if (seal.schema_version !== 'N1_GROUPING_FAMILY_PACKAGE_SEAL_RECEIPT/V1'
    || seal.family_key !== spec.family_key
    || seal.grouping_family_package_seal_receipt_id !== spec.seal.record_id
    || contentId(seal.schema_version, unsignedSeal)
      !== seal.grouping_family_package_seal_receipt_id
    || seal.completion_state !== 'SUCCESSOR_PACKAGE_SEALED') {
    throw new Error(`${spec.family_key} seal receipt is invalid`);
  }
}

function loadSevenFamilyGroupingPreview({ env = process.env } = {}) {
  if (!isPermittedCanonicalV2Runtime(env)) return null;
  const families = FAMILY_SOURCES.map(loadFamily);
  return {
    review: { state: 'PASS', path: REVIEW_PATH, ...REVIEW_BINDING },
    family_count: families.length,
    profile_count: families.reduce((total, family) => total + family.profile_count, 0),
    comparison_row_count: families.reduce((total, family) => total + family.v2_rows.length, 0),
    families,
  };
}

module.exports = {
  FAMILY_SOURCES,
  REVIEW_BINDING,
  REVIEW_PATH,
  loadSevenFamilyGroupingPreview,
  validateSealReceipt,
};
