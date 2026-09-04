'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const M4 = 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m4';

function source(path, record, file) {
  return Object.freeze({ path, record, file });
}

const FAMILY_EVIDENCE_SOURCES = Object.freeze([
  Object.freeze({
    family_key: 'DIVIDENDS',
    package: require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-dividends-grouping-successor-2026-09-01B.json'),
    phase2: source(
      `${CONTROL}/m7-v2-repair-contract-dividends-authoring-phase2-authority-v2.json`,
      require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-dividends-authoring-phase2-authority-v2.json'),
      require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-dividends-authoring-phase2-authority-v2.json'),
    ),
    phase4: source(
      `${CONTROL}/m7-v2-repair-contract-dividends-authoring-phase4-family-profile-package-review-authority.json`,
      require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-dividends-authoring-phase4-family-profile-package-review-authority.json'),
      require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-dividends-authoring-phase4-family-profile-package-review-authority.json'),
    ),
  }),
  Object.freeze({
    family_key: 'MAE_DEFINITION',
    package: require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-mae-definition-grouping-successor-2026-09-01B.json'),
    phase2: source(
      `${CONTROL}/m7-v2-repair-contract-mae-definition-authoring-phase2-authority-v1.json`,
      require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-mae-definition-authoring-phase2-authority-v1.json'),
      require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-mae-definition-authoring-phase2-authority-v1.json'),
    ),
    phase4: source(
      `${CONTROL}/m7-v2-repair-contract-mae-definition-authoring-phase4-family-profile-package-review-authority.json`,
      require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-mae-definition-authoring-phase4-family-profile-package-review-authority.json'),
      require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-mae-definition-authoring-phase4-family-profile-package-review-authority.json'),
    ),
  }),
  Object.freeze({
    family_key: 'GUARANTY_FINANCING_PARTY',
    package: require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-guaranty-financing-party-grouping-successor-2026-09-01B.json'),
    phase2: source(
      `${CONTROL}/m7-v2-repair-contract-guaranty-financing-party-authoring-phase2-authority-v2.json`,
      require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-guaranty-financing-party-authoring-phase2-authority-v2.json'),
      require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-guaranty-financing-party-authoring-phase2-authority-v2.json'),
    ),
    phase4: source(
      `${CONTROL}/m7-v2-repair-contract-guaranty-financing-party-authoring-phase4-family-profile-package-review-authority.json`,
      require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-guaranty-financing-party-authoring-phase4-family-profile-package-review-authority.json'),
      require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-guaranty-financing-party-authoring-phase4-family-profile-package-review-authority.json'),
    ),
  }),
  Object.freeze({
    family_key: 'APPRAISAL_DISSENTERS_RIGHTS',
    package: require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-appraisal-dissenters-rights-grouping-successor-2026-09-01B.json'),
    phase2: source(
      `${CONTROL}/m7-v2-repair-contract-appraisal-dissenters-rights-authoring-phase2-authority-v2.json`,
      require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-appraisal-dissenters-rights-authoring-phase2-authority-v2.json'),
      require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-appraisal-dissenters-rights-authoring-phase2-authority-v2.json'),
    ),
    phase4: source(
      `${CONTROL}/m7-v2-repair-contract-appraisal-dissenters-rights-authoring-phase4-family-profile-package-review-authority.json`,
      require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-appraisal-dissenters-rights-authoring-phase4-family-profile-package-review-authority.json'),
      require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-appraisal-dissenters-rights-authoring-phase4-family-profile-package-review-authority.json'),
    ),
  }),
  Object.freeze({
    family_key: 'FINANCING_COVENANTS',
    package: require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-financing-covenants-grouping-successor-2026-09-01B.json'),
    phase2: source(
      `${CONTROL}/m7-v2-repair-contract-financing-covenants-authoring-phase2-authority-v2.json`,
      require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-financing-covenants-authoring-phase2-authority-v2.json'),
      require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-financing-covenants-authoring-phase2-authority-v2.json'),
    ),
    phase4: source(
      `${CONTROL}/m7-v2-repair-contract-financing-covenants-authoring-phase4-family-profile-package-review-authority.json`,
      require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-financing-covenants-authoring-phase4-family-profile-package-review-authority.json'),
      require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-financing-covenants-authoring-phase4-family-profile-package-review-authority.json'),
    ),
  }),
  Object.freeze({
    family_key: 'CONSIDERATION',
    package: require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-consideration-grouping-successor-2026-09-01B.json'),
    phase2: source(
      `${CONTROL}/m7-v2-repair-contract-consideration-authoring-phase2-authority-v2.json`,
      require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-consideration-authoring-phase2-authority-v2.json'),
      require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-consideration-authoring-phase2-authority-v2.json'),
    ),
    phase4: source(
      `${CONTROL}/m7-v2-repair-contract-consideration-authoring-phase4-family-profile-package-review-authority.json`,
      require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-consideration-authoring-phase4-family-profile-package-review-authority.json'),
      require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-consideration-authoring-phase4-family-profile-package-review-authority.json'),
    ),
  }),
  Object.freeze({
    family_key: 'INTERIM_OPERATING',
    package: require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-interim-operating-grouping-successor-2026-09-01B.json'),
    phase2: source(
      `${CONTROL}/m7-v2-repair-contract-interim-operating-authoring-phase2-authority-v2.json`,
      require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-interim-operating-authoring-phase2-authority-v2.json'),
      require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-interim-operating-authoring-phase2-authority-v2.json'),
    ),
    phase4: source(
      `${CONTROL}/m7-v2-repair-contract-interim-operating-authoring-phase4-family-profile-package-review-authority.json`,
      require('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-interim-operating-authoring-phase4-family-profile-package-review-authority.json'),
      require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-interim-operating-authoring-phase4-family-profile-package-review-authority.json'),
    ),
  }),
]);

const M4_SOURCES = Object.freeze([
  source(
    `${M4}/06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a.agreement-analysis.json`,
    require('../../evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a.agreement-analysis.json'),
    require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a.agreement-analysis.json'),
  ),
  source(
    `${M4}/08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154.agreement-analysis.json`,
    require('../../evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154.agreement-analysis.json'),
    require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154.agreement-analysis.json'),
  ),
  source(
    `${M4}/1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116.agreement-analysis.json`,
    require('../../evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116.agreement-analysis.json'),
    require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116.agreement-analysis.json'),
  ),
  source(
    `${M4}/3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb.agreement-analysis.json`,
    require('../../evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb.agreement-analysis.json'),
    require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb.agreement-analysis.json'),
  ),
  source(
    `${M4}/b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363.agreement-analysis.json`,
    require('../../evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363.agreement-analysis.json'),
    require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363.agreement-analysis.json'),
  ),
  source(
    `${M4}/f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c.agreement-analysis.json`,
    require('../../evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c.agreement-analysis.json'),
    require.resolve('../../evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c.agreement-analysis.json'),
  ),
]);

const GUARANTY_SILENT_SECTIONS = Object.freeze({
  '8516b9b686f7f6e3553dc21ff8f5414dded532b6a63cd421207a2b8cd073f753': '9.16',
  '92aadd4edab0e674e3f0301af587431d532eab2ff11e47c243cda581cd30838f': '8.07',
  a74f6cf0b23993b94732f3d2145a45f65988286deb4dea44246ec2ab18ecac00: '8.06',
  f78f94d6023306f8f28fb0b50f7c15e69d30cc1d3c920e04650a7b255f4b5450: '9.15',
});

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function loadBytes(input) {
  if (typeof input.file === 'string') return fs.readFileSync(input.file);
  return Buffer.from(`${JSON.stringify(input.record)}\n`, 'utf8');
}

function profileKeyHash(profileKey) {
  const parts = String(profileKey || '').split(':');
  return parts.length >= 4 ? parts[parts.length - 1] : null;
}

function tupleKey(value) {
  return JSON.stringify([
    value.classification_path,
    value.required_expression_signature,
  ]);
}

function exactSet(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return left.length === leftSet.size
    && right.length === rightSet.size
    && leftSet.size === rightSet.size
    && [...leftSet].every((value) => rightSet.has(value));
}

function validateM4Binding(binding, loaded, agreementId) {
  const record = loaded.source.record;
  if (!binding || binding.path !== loaded.source.path
    || binding.byte_length !== loaded.bytes.length
    || binding.sha256 !== sha256(loaded.bytes)
    || binding.schema_version !== record.schema_version
    || binding.record_id_field !== 'agreement_analysis_id'
    || binding.record_id !== record.agreement_analysis_id
    || agreementId !== record.agreement_id) {
    throw new Error(`${agreementId} M4 analysis does not match its Phase2 authority binding`);
  }
}

function buildM4Index() {
  const byAgreement = new Map();
  const claimById = new Map();
  for (const input of M4_SOURCES) {
    const loaded = { source: input, bytes: loadBytes(input) };
    const { record } = input;
    if (byAgreement.has(record.agreement_id) || !Array.isArray(record.claims)) {
      throw new Error(`${record.agreement_id} M4 analysis is duplicated or malformed`);
    }
    const deals = new Set(record.claims.map((claim) => claim.deal));
    if (deals.size !== 1) throw new Error(`${record.agreement_id} has no unique deal label`);
    loaded.deal = [...deals][0];
    byAgreement.set(record.agreement_id, loaded);
    for (const claim of record.claims) {
      if (claimById.has(claim.analysis_claim_id)) {
        throw new Error(`${claim.analysis_claim_id} is duplicated across M4 analyses`);
      }
      claimById.set(claim.analysis_claim_id, claim);
    }
  }
  return { byAgreement, claimById, validatedAgreementIds: new Set() };
}

function validateFamilyM4Bindings(spec, m4Index) {
  const bindings = spec.phase2.record.immutable_parent_bindings?.m2_m3_m4;
  if (!Array.isArray(bindings) || bindings.length === 0) {
    throw new Error(`${spec.family_key} has no Phase2 M4 bindings`);
  }
  for (const binding of bindings) {
    const loaded = m4Index.byAgreement.get(binding.agreement_id);
    if (!loaded) throw new Error(`${spec.family_key} references an unloaded M4 analysis`);
    validateM4Binding(binding.m4, loaded, binding.agreement_id);
    m4Index.validatedAgreementIds.add(binding.agreement_id);
  }
}

function validateReviewRow(spec, profile, reviewRow, terminals) {
  const validation = reviewRow?.proposed_validation;
  const terminalSourceKeys = terminals.map((terminal) => terminal.source_unit_key);
  const terminalClaimIds = terminals.flatMap((terminal) => terminal.m4_claim_ids);
  if (!reviewRow
    || reviewRow.package_profile_key !== profile.profile_key
    || reviewRow.proposed_profile_key !== profileKeyHash(profile.profile_key)
    || tupleKey(reviewRow.canonical_tuple) !== tupleKey(profile)
    || validation?.extraction_state !== 'COMPLETE'
    || validation?.output_disposition !== 'REVIEW_ONLY'
    || validation?.source_quality !== 'SUFFICIENT'
    || !Array.isArray(reviewRow.missing_required_field_keys)
    || reviewRow.missing_required_field_keys.length !== 0
    || !exactSet(reviewRow.source_unit_keys, terminalSourceKeys)
    || !exactSet(reviewRow.m4_claim_ids, terminalClaimIds)) {
    throw new Error(`${spec.family_key} profile is not COMPLETE/REVIEW_ONLY in Phase4`);
  }
}

function claimEvidence(spec, terminal, claimId, m4Index) {
  const claim = m4Index.claimById.get(claimId);
  const analysis = m4Index.byAgreement.get(terminal.agreement_id);
  const revision = claim?.legacy_claim_revision;
  if (!analysis || !claim
    || claim.agreement_id !== terminal.agreement_id
    || claim.family !== spec.family_key
    || revision?.state !== 'PRESENT'
    || revision?.publication_state !== 'VALIDATED'
    || claim.projection_eligibility !== 'BLOCKED'
    || claim.projection_block_reason !== 'SCHEMA_APPROVAL_PENDING') {
    throw new Error(`${claimId} is not validated, blocked M4 review evidence`);
  }
  return {
    evidence_kind: 'M4_CLAIM',
    source_unit_key: terminal.source_unit_key,
    analysis_claim_id: claim.analysis_claim_id,
    agreement_id: claim.agreement_id,
    deal: claim.deal,
    section_reference: claim.section_reference,
    claim_definition_key: claim.claim_definition_key,
    canonical_value: revision.canonical_value,
    raw_value: revision.raw_value,
    attributes: revision.attributes,
    claim_state: revision.state,
    publication_state: revision.publication_state,
    serving_state: 'NOT_SERVED',
    serving_reason: claim.projection_block_reason,
  };
}

function sourceOnlyEvidence(spec, terminal, sourceKey, m4Index) {
  const analysis = m4Index.byAgreement.get(terminal.agreement_id);
  const sectionReference = GUARANTY_SILENT_SECTIONS[sourceKey];
  const member = terminal.source_closure?.members?.find((entry) => (
    entry.node_occurrence_id === sourceKey
  ));
  if (spec.family_key !== 'GUARANTY_FINANCING_PARTY'
    || !analysis
    || !sectionReference
    || !member?.source_span) {
    throw new Error(`${sourceKey} is not an admitted Guaranty M4-silent source row`);
  }
  return {
    evidence_kind: 'PHASE2_SOURCE_ONLY',
    source_unit_key: terminal.source_unit_key,
    source_row_key: sourceKey,
    agreement_id: terminal.agreement_id,
    deal: analysis.deal,
    section_reference: sectionReference,
    claim_definition_key: null,
    canonical_value: null,
    raw_value: null,
    attributes: null,
    claim_state: 'NO_M4_CLAIM',
    publication_state: null,
    serving_state: 'SOURCE_ONLY_NOT_SERVED',
    serving_reason: 'M4_SILENT_PROVISION_EXAMPLE',
    source_span: { ...member.source_span },
  };
}

function buildFamily(spec, m4Index) {
  const { package: sealedPackage } = spec;
  const phase2 = spec.phase2.record;
  const phase4 = spec.phase4.record;
  const terminalContract = phase2.source_terminal_successor_contract;
  const terminals = terminalContract?.terminal_rule_registry;
  const reviewRows = phase4.profile_review_schedule;
  if (sealedPackage.family_key !== spec.family_key
    || sealedPackage.state !== 'BEN_APPROVED_FAMILY_PROFILE_PACKAGE'
    || !Array.isArray(sealedPackage.profiles)
    || !Array.isArray(terminals)
    || !Array.isArray(reviewRows)
    || terminals.length !== terminalContract.terminal_rule_registry_exact_count
    || reviewRows.length !== sealedPackage.profiles.length) {
    throw new Error(`${spec.family_key} profile, Phase2 or Phase4 accounting drifted`);
  }
  validateFamilyM4Bindings(spec, m4Index);

  const terminalsByTuple = new Map();
  for (const terminal of terminals) {
    const key = tupleKey(terminal);
    if (!terminalsByTuple.has(key)) terminalsByTuple.set(key, []);
    terminalsByTuple.get(key).push(terminal);
  }
  const reviewByTuple = new Map(reviewRows.map((row) => [tupleKey(row.canonical_tuple), row]));
  if (reviewByTuple.size !== reviewRows.length) {
    throw new Error(`${spec.family_key} Phase4 review tuple is duplicated`);
  }

  const usedClaims = new Set();
  const usedSilentRows = new Set();
  const profiles = sealedPackage.profiles.map((profile) => {
    const key = tupleKey(profile);
    const matchingTerminals = terminalsByTuple.get(key) || [];
    if (matchingTerminals.length === 0) {
      throw new Error(`${spec.family_key} sealed profile has no exact Phase2 terminal`);
    }
    const reviewRow = reviewByTuple.get(key);
    validateReviewRow(spec, profile, reviewRow, matchingTerminals);
    const evidence = [];
    for (const terminal of matchingTerminals) {
      const claimIds = terminal.m4_claim_ids;
      const silentRows = terminal.m4_silent_source_row_keys;
      if (!Array.isArray(claimIds) || !Array.isArray(silentRows)
        || (claimIds.length === 0) === (silentRows.length === 0)) {
        throw new Error(`${terminal.source_unit_key} has an invalid Phase2 evidence mode`);
      }
      for (const claimId of claimIds) {
        if (usedClaims.has(claimId)) throw new Error(`${claimId} is assigned more than once`);
        usedClaims.add(claimId);
        evidence.push(claimEvidence(spec, terminal, claimId, m4Index));
      }
      for (const sourceKey of silentRows) {
        if (usedSilentRows.has(sourceKey)) throw new Error(`${sourceKey} is assigned more than once`);
        usedSilentRows.add(sourceKey);
        evidence.push(sourceOnlyEvidence(spec, terminal, sourceKey, m4Index));
      }
    }
    return {
      profile_key: profile.profile_key,
      proposed_profile_key: profileKeyHash(profile.profile_key),
      classification_path: [...profile.classification_path],
      required_expression_signature: profile.required_expression_signature,
      extraction_state: reviewRow.proposed_validation.extraction_state,
      output_disposition: reviewRow.proposed_validation.output_disposition,
      source_quality: reviewRow.proposed_validation.source_quality,
      review_flags: [...reviewRow.review_flags],
      source_unit_keys: [...reviewRow.source_unit_keys],
      evidence,
    };
  });

  const expectedClaims = terminals.flatMap((terminal) => terminal.m4_claim_ids).length;
  const expectedSilentRows = terminals.flatMap((terminal) => (
    terminal.m4_silent_source_row_keys
  )).length;
  if (usedClaims.size !== expectedClaims
    || usedSilentRows.size !== expectedSilentRows
    || usedClaims.size !== terminalContract.admitted_m4_claim_exact_count
    || usedSilentRows.size !== terminalContract.m4_silent_terminal_exact_count) {
    throw new Error(`${spec.family_key} Phase2 evidence accounting drifted`);
  }
  return {
    family_key: spec.family_key,
    profile_count: profiles.length,
    terminal_count: terminals.length,
    claim_count: usedClaims.size,
    source_only_count: usedSilentRows.size,
    phase2_authority_path: spec.phase2.path,
    phase4_authority_path: spec.phase4.path,
    profiles,
  };
}

let cachedReviewEvidence;

function loadSevenFamilyV2ReviewEvidence() {
  if (cachedReviewEvidence) return cachedReviewEvidence;
  const m4Index = buildM4Index();
  const families = FAMILY_EVIDENCE_SOURCES.map((spec) => buildFamily(spec, m4Index));
  if (m4Index.validatedAgreementIds.size !== m4Index.byAgreement.size) {
    throw new Error('an M4 analysis has no matching Phase2 authority binding');
  }
  const result = {
    family_count: families.length,
    agreement_count: m4Index.byAgreement.size,
    profile_count: families.reduce((sum, family) => sum + family.profile_count, 0),
    terminal_count: families.reduce((sum, family) => sum + family.terminal_count, 0),
    claim_count: families.reduce((sum, family) => sum + family.claim_count, 0),
    source_only_count: families.reduce((sum, family) => sum + family.source_only_count, 0),
    families,
  };
  if (result.family_count !== 7
    || result.agreement_count !== 6
    || result.profile_count !== 140
    || result.terminal_count !== 142
    || result.claim_count !== 240
    || result.source_only_count !== 4) {
    throw new Error('seven-family V2 review-evidence accounting drifted');
  }
  JSON.stringify(result);
  cachedReviewEvidence = result;
  return result;
}

module.exports = {
  FAMILY_EVIDENCE_SOURCES,
  GUARANTY_SILENT_SECTIONS,
  M4_SOURCES,
  loadSevenFamilyV2ReviewEvidence,
};
