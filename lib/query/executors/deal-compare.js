const { scalarDelta, maxSeverity } = require('../delta');
const { assertNoDarkAuthorityRecords } = require('../dark-authority-fence');
const { fieldsForCompareCell } = require('../render/deal-compare-cell-fields');
const { dealColumn, firstProvision, firstProvisionWithField, fieldKind, provisionFieldValue, primaryQuote, buildProv, hasValue, labelFor } = require('./shared');

const ANTITRUST_LEGACY_FALLBACKS = Object.freeze({
  antitrustEffortsStandard: Object.freeze(['effortsStandard']),
  burdenCommitment: Object.freeze(['hellOrHighWater']),
});

function antitrustFieldResult(provisions, deal, field) {
  for (const candidateField of [field, ...(ANTITRUST_LEGACY_FALLBACKS[field] || [])]) {
    const provision = firstProvisionWithField(provisions, deal.id, 'ANTITRUST_REGULATORY', candidateField, null, deal);
    if (!provision) continue;
    const result = provisionFieldValue(provision, 'ANTITRUST_REGULATORY', candidateField, deal);
    if (hasValue(result.value)) return { provision, result };
  }
  return { provision: firstProvision(provisions, deal.id, 'ANTITRUST_REGULATORY'), result: { value: null, def: null } };
}

const FIELD_OWNING_FAMILIES = new Set([
  'CONSIDERATION',
  'CLOSING_CONDITION',
  'TERMINATION_RIGHT',
  'TERMINATION_FEE',
  'COVENANT_INTERIM_OPERATING',
  'SEC_FILING_MEETING',
]);

function owningProvision(provisions, deal, provisionType, field) {
  if (!FIELD_OWNING_FAMILIES.has(provisionType)) return firstProvision(provisions, deal.id, provisionType);
  return firstProvisionWithField(provisions, deal.id, provisionType, field, null, deal);
}

// B3 (2026-07-19 pre-demo audit): the 'feeAmount' alias collides in the
// normalized-v1 registry with the 'companyTerminationFee' row (both list
// "feeAmount" as an alias — see docs/schema-shape/normalized-v1.json).
// readRegistry()'s byAlias map keeps whichever entry lists an alias FIRST,
// which happens to be companyTerminationFee's row — and that row's own
// displayName is an unfixed auto-generated placeholder that bakes the raw
// extraction shape into the label ("Company Termination Fee - object {
// amount, percentage_of_equity, triggers[], payment_deadline }"). Every
// DEAL_COMPARE cell for TERMINATION_FEE's 'feeAmount' field inherited this
// as its user-facing label. Fixed narrowly here (strip the "- object {...}"
// suffix, fall back to a humanized field name) rather than editing the
// shared registry, which many other unrelated callers key off the same
// alias/entry for.
const SCHEMA_SIGNATURE_LABEL_RE = /\s*[-–—]\s*object\s*\{[^}]*\}\s*$/i;
function cleanLabel(label, field) {
  const stripped = label ? String(label).replace(SCHEMA_SIGNATURE_LABEL_RE, '').trim() : '';
  return stripped || labelFor(field);
}

function executeDealCompare(payload, context) {
  assertNoDarkAuthorityRecords(
    context.provisions || [],
    'Compare cannot admit a VALIDATED_NOT_SERVED provision.',
  );
  const deals = (context.deals || []).filter((deal) => payload.deal_ids.includes(deal.id)).slice(0, 4);
  const provisionTypes = payload.provision_types || [];
  const columns = deals.map(dealColumn);
  const rows = provisionTypes.map((provisionType) => {
    const cells = deals.map((deal) => {
      const provision = firstProvision(context.provisions || [], deal.id, provisionType);
      const fields = fieldsForCompareCell(provisionType, payload.included_field_groups).map((field) => {
        const antitrustResult = provisionType === 'ANTITRUST_REGULATORY'
          ? antitrustFieldResult(context.provisions || [], deal, field)
          : null;
        const fieldProvision = antitrustResult
          ? antitrustResult.provision
          : owningProvision(context.provisions || [], deal, provisionType, field);
        const result = antitrustResult
          ? antitrustResult.result
          : fieldProvision ? provisionFieldValue(fieldProvision, provisionType, field, deal) : { value: null, def: null };
        return {
          label: cleanLabel(result.def ? result.def.label : null, field),
          value: result.value,
          kind: fieldKind(result.def),
          field,
          ...(hasValue(result.value) ? { _prov: buildProv(result, fieldProvision) } : {}),
        };
      });
      return {
        deal_id: deal.id,
        card_id: provision ? provision.id : null,
        primary_quote: provision ? primaryQuote(provision) : null,
        key_fields: fields,
        delta_severity: 'NONE',
        delta_versus: null,
      };
    });
    if (payload.highlight_deltas !== false && cells.length > 1) {
      for (const cell of cells) {
        const severities = [];
        const differing = new Set();
        for (const peer of cells) {
          if (peer === cell) continue;
          for (const field of cell.key_fields) {
            const peerField = peer.key_fields.find((x) => x.field === field.field);
            const delta = scalarDelta(field.field, field.value, peerField && peerField.value, field.kind);
            if (delta.isDelta) {
              severities.push(delta.severity);
              differing.add(field.field);
            }
          }
        }
        cell.delta_severity = maxSeverity(severities);
        cell.delta_versus = differing.size ? { peer_deal_id: null, differing_fields: [...differing] } : null;
      }
    }
    return {
      provision_type: provisionType,
      provision_subtype: null,
      section_ref_by_deal: Object.fromEntries(cells.map((cell) => [cell.deal_id, cell.primary_quote && cell.primary_quote.section_ref])),
      cells,
    };
  });
  return { kind: 'DEAL_COMPARE', columns, rows };
}

module.exports = { executeDealCompare };
