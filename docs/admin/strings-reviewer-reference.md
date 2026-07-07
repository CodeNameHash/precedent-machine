# Strings reviewer reference

Archived reference for the Phase 0-C strings-reviewer surface created during PR #140. This page was used to review registry fields by section, expose empty-but-important fields, and route decisions into the reconciliation workflow. The runnable source is archived under `archive/strings-reviewer/` for Phase 0-D reuse and is not wired into the app.

Workflow notes:

- Review fields by section, including non-string schema fields marked by type.
- Use the field links to focus a specific registry key via `field_key`.
- Use the reconcile workflow for merge, move, recode, reset, split, and deferred schema decisions.
- Preserve the section taxonomy maps in the API: `SECTION_LABELS`, `IMPORTANT_EMPTY_FIELDS_BY_SECTION`, and `SECTION_FIELD_OVERRIDES`.

Keyboard shortcuts: none were implemented in this archived strings page.

## `pages/admin/registry/strings.js`

```js
import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import AdminNav from '../../../components/admin/AdminNav';

StringsPage.noLayout = true;
const IMPORTANT_EMPTY_FIELDS_BY_SECTION = {
  CONSID: new Set([
    'deal.consideration.perShareCashComponent',
    'deal.consideration.perShareStockComponent',
    'offerConsideration',
    'offerPrice',
    'perShareAmount',
  ]),
  ANTI: new Set([
    'burdenCap',
    'buyerEffortsCap',
    'controllingParty',
    'targetEffortsCap',
    'timingAgreement',
  ]),
  STRUCT: new Set([
    'acceptanceAndPaymentMechanics',
    'backendMergerMechanic',
    'closingConditionsPrecedent',
    'closingTiming',
    'dealStructure',
    'nominalTargetParty',
    'offerCommencementDeadline',
    'offerConditionsReference',
    'offerConsideration',
    'offerExpirationAndExtension',
    'offerPrice',
    'schedule14D9Filing',
    'scheduleTOFiling',
    'section251h',
    'shortFormMergerMechanic',
    'stockholderListCovenant',
    'survivingEntity',
  ]),
  SEC: new Set([
    'adjournmentRights',
    'forceTheVote',
    'forceTheVoteDetails',
    'mailingDeadline',
    'meetingControlNotes',
    'meetingDeadline',
    'offerCommencementDeadline',
    'proxyFilingDeadline',
    'schedule14D9Filing',
    'scheduleTOFiling',
    'stockholderApprovalRequired',
    'tenderOfferDisclosurePermitted',
    'tenderOfferDisclosureScope',
  ]),
};

function FieldRow({ field, active, onSelect }) {
  const typeLabel = field.type || 'unknown';
  return (
    <button
      type="button"
      onClick={() => onSelect(field.key)}
      className={`w-full rounded border p-3 text-left transition-colors ${
        active ? 'border-accent bg-accent text-white' : 'border-border bg-white text-ink hover:border-accent'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-ui text-sm font-semibold">{field.displayName}</div>
          <div className={`truncate font-mono text-[11px] ${active ? 'text-white/80' : 'text-inkFaint'}`}>{field.key}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={`rounded border px-2 py-0.5 font-ui text-[10px] uppercase ${active ? 'border-white/40 text-white/80' : 'border-border text-inkFaint'}`}>
            {typeLabel}
          </span>
          <span className={`rounded border px-2 py-0.5 font-ui text-xs ${active ? 'border-white/40' : 'border-border text-inkLight'}`}>
            {field.value_count}
          </span>
        </div>
      </div>
      <div className={`mt-2 font-ui text-xs ${active ? 'text-white/80' : 'text-inkFaint'}`}>
        {field.count} values · {field.deal_count} deals
      </div>
    </button>
  );
}

function ValueCard({ value }) {
  return (
    <article className="rounded border border-border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded border border-border px-2 py-0.5 font-ui text-xs text-inkLight">{value.count} values</span>
        <span className="rounded border border-border px-2 py-0.5 font-ui text-xs text-inkLight">{value.deal_count} deals</span>
      </div>
      <pre className="whitespace-pre-wrap break-words font-ui text-sm leading-6 text-ink">{value.raw_value}</pre>
      {value.samples?.length > 0 && (
        <div className="mt-4 space-y-3">
          {value.samples.map((sample, index) => (
            <div key={`${sample.deal_id}-${sample.source_provision_id}-${index}`} className="rounded border border-border bg-bg p-3">
              <div className="mb-2 flex flex-wrap gap-2 font-mono text-[11px] text-inkFaint">
                <span>{sample.deal_id}</span>
                {sample.source_provision_id && <span>{sample.source_provision_id}</span>}
              </div>
              <p className="font-ui text-xs leading-5 text-inkLight">{sample.evidence_quote}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default function StringsPage({ registry }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const fields = registry.fields || [];
  const sectionGroups = registry.section_groups || [];
  const filteredFields = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return fields.filter((field) => {
      if (selectedSection === 'ALL') {
        if (field.value_count <= 0) return false;
      } else {
        if (field.value_count <= 0 && !IMPORTANT_EMPTY_FIELDS_BY_SECTION[selectedSection]?.has(field.key)) return false;
        if (!(field.sections || []).includes(selectedSection)) return false;
        if ((field.sections || []).length > 4) return false;
      }
      if (!needle) return true;
      return [
        field.key,
        field.displayName,
        field.appliesTo,
        ...(field.aliases || []),
        ...(field.provisionCodes || []),
      ].join(' ').toLowerCase().includes(needle);
    });
  }, [fields, query, selectedSection]);
  const selectedField = registry.selected_field || fields[0] || null;
  const selectedSectionGroup = sectionGroups.find((section) => section.key === selectedSection) || sectionGroups[0] || null;
  const values = useMemo(() => {
    if (!selectedField || selectedField.key !== registry.selected_field?.key) return [];
    const needle = query.trim().toLowerCase();
    const list = registry.values || [];
    if (!needle) return list;
    return list.filter((value) => value.raw_value.toLowerCase().includes(needle)
      || (value.samples || []).some((sample) => String(sample.evidence_quote || '').toLowerCase().includes(needle)));
  }, [query, registry.selected_field?.key, registry.values, selectedField]);
  function selectField(key) {
    router.push({
      pathname: '/admin/registry/strings',
      query: { field_key: key },
    });
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="border-b border-border bg-white p-6">
        <AdminNav className="mb-5" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-ink">String Registry</h1>
            <div className="mt-2 flex flex-wrap gap-2 font-ui text-xs text-inkFaint">
              <span>{registry.field_total} review fields</span>
              {selectedField && <span>{selectedField.value_count} raw values</span>}
            </div>
          </div>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search strings"
            className="h-10 w-full max-w-sm rounded border border-border bg-bg px-3 font-ui text-sm text-ink outline-none focus:border-accent"
          />
        </div>
      </div>
      <div className="grid min-h-[calc(100vh-121px)] grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-r border-border bg-white p-3">
          <div className="mb-4 border-b border-border pb-4">
            <div className="mb-2 font-ui text-[11px] font-semibold uppercase text-inkFaint">Sections</div>
            <div className="space-y-1">
              {sectionGroups.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setSelectedSection(section.key)}
                  className={`flex w-full items-center justify-between rounded border px-2 py-2 text-left font-ui text-xs transition-colors ${
                    section.key === selectedSection ? 'border-accent bg-accent text-white' : 'border-border bg-bg text-inkLight hover:border-accent hover:text-ink'
                  }`}
                >
                  <span className="truncate">{section.label}</span>
                  <span className={section.key === selectedSection ? 'text-white/80' : 'text-inkFaint'}>{section.field_count}</span>
                </button>
              ))}
            </div>
          </div>
          {selectedSectionGroup && (
            <div className="mb-4 rounded border border-border bg-bg p-3">
              <div className="font-ui text-sm font-semibold text-ink">{selectedSectionGroup.label}</div>
              <div className="mt-1 font-ui text-xs text-inkFaint">
                {selectedSectionGroup.field_count} fields · {selectedSectionGroup.value_count} values
              </div>
              <div className="mt-3 max-h-48 space-y-1 overflow-auto pr-1">
                {selectedSectionGroup.fields.map((field) => (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => selectField(field.key)}
                    className="block w-full truncate rounded px-2 py-1 text-left font-mono text-[11px] text-inkLight hover:bg-white hover:text-ink"
                  >
                    <span>{field.key}</span>
                    <span className="ml-2 font-ui uppercase text-inkFaint">{field.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            {filteredFields.map((field) => (
              <FieldRow key={field.key} field={field} active={field.key === selectedField?.key} onSelect={selectField} />
            ))}
          </div>
        </aside>
        <main className="min-w-0 p-5">
          {selectedField ? (
            <div className="space-y-4">
              <section className="border-b border-border pb-4">
                <h2 className="font-display text-xl text-ink">{selectedField.displayName}</h2>
                <div className="mt-2 flex flex-wrap gap-2 font-ui text-xs text-inkFaint">
                  <span>{selectedField.key}</span>
                  <span className="uppercase">{selectedField.type}</span>
                  <span>{selectedField.count} values</span>
                  <span>{selectedField.deal_count} deals</span>
                </div>
              </section>
              {selectedField.key === registry.selected_field?.key && values.map((value) => <ValueCard key={value.id} value={value} />)}
              {selectedField.key === registry.selected_field?.key && values.length === 0 && (
                <div className="rounded border border-border bg-white p-4 font-ui text-sm text-inkLight">No strings found.</div>
              )}
            </div>
          ) : (
            <div className="rounded border border-border bg-white p-4 font-ui text-sm text-inkLight">No review fields found.</div>
          )}
        </main>
      </div>
    </div>
  );
}

export async function getServerSideProps({ query }) {
  const { buildStringRegistry } = await import('../../api/admin/registry/strings');
  return { props: { registry: buildStringRegistry({ field_key: query.field_key, q: query.q }) } };
}
```

## `pages/api/admin/registry/strings.js`

```js
import crypto from 'crypto';
import fs from 'fs';

const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';
const DEFAULT_VALUE_LIMIT = 200;
const DEFAULT_SAMPLE_LIMIT = 4;
const SECTION_LABELS = {
  ALL: 'All sections',
  DEF: 'Definitions',
  STRUCT: 'Structure',
  CONSID: 'Consideration',
  'REP-T': 'Target reps',
  'REP-B': 'Buyer reps',
  COV: 'Covenants',
  SEC: 'Shareholder / SEC',
  IOC: 'Interim covenants',
  NOSOL: 'No-shop',
  ANTI: 'Regulatory / antitrust',
  COND: 'Conditions',
  TERMR: 'Termination rights',
  TERMF: 'Termination fees',
  MISC: 'Miscellaneous',
  OTHER: 'Other',
};
const IMPORTANT_EMPTY_FIELDS_BY_SECTION = {
  CONSID: new Set([
    'deal.consideration.perShareCashComponent',
    'deal.consideration.perShareStockComponent',
    'offerConsideration',
    'offerPrice',
    'perShareAmount',
  ]),
  ANTI: new Set([
    'burdenCap',
    'buyerEffortsCap',
    'controllingParty',
    'targetEffortsCap',
    'timingAgreement',
  ]),
  STRUCT: new Set([
    'acceptanceAndPaymentMechanics',
    'backendMergerMechanic',
    'closingConditionsPrecedent',
    'closingTiming',
    'dealStructure',
    'nominalTargetParty',
    'offerCommencementDeadline',
    'offerConditionsReference',
    'offerConsideration',
    'offerExpirationAndExtension',
    'offerPrice',
    'schedule14D9Filing',
    'scheduleTOFiling',
    'section251h',
    'shortFormMergerMechanic',
    'stockholderListCovenant',
    'survivingEntity',
  ]),
  SEC: new Set([
    'adjournmentRights',
    'forceTheVote',
    'forceTheVoteDetails',
    'mailingDeadline',
    'meetingControlNotes',
    'meetingDeadline',
    'offerCommencementDeadline',
    'proxyFilingDeadline',
    'schedule14D9Filing',
    'scheduleTOFiling',
    'stockholderApprovalRequired',
    'tenderOfferDisclosurePermitted',
    'tenderOfferDisclosureScope',
  ]),
};
const SECTION_FIELD_OVERRIDES = {
  SEC: new Set([
    'adjournmentRights',
    'approvalDefinition',
    'forceTheVote',
    'forceTheVoteDetails',
    'mailingDeadline',
    'meetingControlNotes',
    'meetingDeadline',
    'offerCommencementDeadline',
    'proxyFilingDeadline',
    'schedule14D9Filing',
    'scheduleTOFiling',
    'shareholderApprovalMethodCompany',
    'shareholderApprovalMethodParent',
    'stockholderApprovalRequired',
    'tenderOfferDisclosurePermitted',
    'tenderOfferDisclosureScope',
    'voteThreshold',
  ]),
};
const HIDDEN_REVIEW_FIELDS = new Set([
  'carveOuts',
  'carveOutsList',
  'deal.antitrust.burdensomeConditionDefined',
  'deal.antitrust.burdensomeConditionPresent',
  'deal.antitrust.burdensomeConditionScope',
  'deal.antitrust.capStandard',
  'deal.antitrust.clearSkiesCompany',
  'deal.antitrust.clearSkiesParent',
  'deal.antitrust.controlLeadParty',
  'deal.antitrust.effortsStandard',
  'deal.antitrust.exHsrFilingDeadline',
  'deal.antitrust.hsrFilingDeadline',
  'deal.antitrust.litigationObligation',
  'deal.antitrust.pullAndRefile',
  'deal.antitrust.timingAgreement',
  'deal.mae.carveouts',
  'deal.termination.outsideDate',
  'deal.termination.outsideDateExtensions',
  'canonicalCode',
  'partOfRep',
  'proposedCode',
  'proposedLabel',
  'reapplied_corrections',
  'sourceSectionType',
  'startChar',
]);

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function clampInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

function stableId(fieldKey, rawValue) {
  return crypto.createHash('sha256').update(`${fieldKey}|${rawValue}`).digest('hex').slice(0, 16);
}

function normaliseText(value) {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function fieldMatches(field, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  const haystack = [
    field.key,
    field.displayName,
    ...(field.aliases || []),
  ].join(' ').toLowerCase();
  return haystack.includes(needle);
}

function valueMatches(value, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  return normaliseText(value.raw_value).toLowerCase().includes(needle)
    || (value.samples || []).some((sample) => normaliseText(sample.evidence_quote).toLowerCase().includes(needle));
}

function splitCodes(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sectionForCode(code) {
  if (!code) return 'OTHER';
  if (code.startsWith('REP-T')) return 'REP-T';
  if (code.startsWith('REP-B')) return 'REP-B';
  if (code.startsWith('COND')) return 'COND';
  if (code.startsWith('TERMR')) return 'TERMR';
  if (code.startsWith('TERMF')) return 'TERMF';
  if (code.startsWith('IOC')) return 'IOC';
  if (code.startsWith('NOSOL')) return 'NOSOL';
  if (code.startsWith('ANTI')) return 'ANTI';
  if (code.startsWith('COV')) return 'COV';
  if (code.startsWith('DEF')) return 'DEF';
  if (code.startsWith('STRUCT')) return 'STRUCT';
  if (code.startsWith('CONSID')) return 'CONSID';
  if (code.startsWith('MISC')) return 'MISC';
  return SECTION_LABELS[code] ? code : 'OTHER';
}

function sectionsForEntry(entry) {
  const provenance = entry.provenance || {};
  const codes = [
    ...splitCodes(provenance.appliesTo),
    ...(provenance.provisionCodes || []).flatMap(splitCodes),
  ];
  const sections = [...new Set(codes.map(sectionForCode))];
  for (const [section, keys] of Object.entries(SECTION_FIELD_OVERRIDES)) {
    if (keys.has(entry.key)) sections.push(section);
  }
  const uniqueSections = [...new Set(sections)];
  return uniqueSections.length ? uniqueSections : ['OTHER'];
}

function sectionScopedFields(fields, key) {
  if (key === 'ALL') return fields.filter((field) => field.value_count > 0);
  return fields.filter((field) => (
    (field.value_count > 0 || IMPORTANT_EMPTY_FIELDS_BY_SECTION[key]?.has(field.key))
    && (field.sections || []).includes(key)
    && (field.sections || []).length <= 4
  ));
}

function entryValueCount(entry, triplesByField) {
  const triples = triplesByField.get(entry.key) || [];
  return new Set(triples.map((triple) => normaliseText(triple.raw_value)).filter(Boolean)).size;
}

function groupValues(triples, { sampleLimit }) {
  const groups = new Map();
  for (const triple of triples) {
    const rawValue = normaliseText(triple.raw_value);
    if (!rawValue) continue;
    const group = groups.get(rawValue) || {
      id: stableId(triple.field_key, rawValue),
      raw_value: rawValue,
      count: 0,
      deal_count: 0,
      deal_ids: new Set(),
      samples: [],
    };
    group.count += 1;
    group.deal_ids.add(triple.deal_id);
    if (group.samples.length < sampleLimit) {
      group.samples.push({
        deal_id: triple.deal_id,
        source_provision_id: triple.source_provision_id,
        evidence_quote: triple.evidence_quote,
        canonicalKey: triple.canonicalKey || null,
      });
    }
    groups.set(rawValue, group);
  }
  return [...groups.values()].map((group) => {
    const dealIds = [...group.deal_ids].sort();
    return {
      ...group,
      deal_count: dealIds.length,
      deal_ids: dealIds,
    };
  }).sort((a, b) => b.count - a.count || a.raw_value.localeCompare(b.raw_value));
}

export function buildStringRegistry(query = {}) {
  const normalized = readJson(NORMALIZED_FILE, { entries: [], triples: [] });
  const valueLimit = clampInt(query.limit, DEFAULT_VALUE_LIMIT, 1000);
  const sampleLimit = clampInt(query.sample_limit, DEFAULT_SAMPLE_LIMIT, 10);
  const q = String(query.q || '').trim();
  const selectedFieldKey = String(query.field_key || '').trim();
  const reviewFields = (normalized.entries || [])
    .filter((entry) => !HIDDEN_REVIEW_FIELDS.has(entry.key))
    .sort((a, b) => a.key.localeCompare(b.key));
  const triplesByField = new Map();
  for (const triple of normalized.triples || []) {
    const bucket = triplesByField.get(triple.field_key) || [];
    bucket.push(triple);
    triplesByField.set(triple.field_key, bucket);
  }
  const fields = reviewFields.map((field) => {
    const triples = triplesByField.get(field.key) || [];
    const dealIds = new Set(triples.map((triple) => triple.deal_id));
    const values = new Set(triples.map((triple) => normaliseText(triple.raw_value)).filter(Boolean));
    return {
      key: field.key,
      displayName: field.displayName || field.key,
      type: field.type || 'unknown',
      aliases: field.aliases || [],
      sections: sectionsForEntry(field),
      provisionCodes: field.provenance?.provisionCodes || [],
      appliesTo: field.provenance?.appliesTo || null,
      sourceOfTruth: field.sourceOfTruth || null,
      usedIn: field.usedIn || [],
      count: triples.length,
      deal_count: dealIds.size,
      value_count: values.size,
    };
  }).filter((field) => fieldMatches(field, q));
  const sectionGroups = Object.entries(SECTION_LABELS).map(([key, label]) => {
    const groupedFields = sectionScopedFields(fields, key);
    const dealIds = new Set();
    for (const field of groupedFields) {
      const triples = triplesByField.get(field.key) || [];
      for (const triple of triples) dealIds.add(triple.deal_id);
    }
    return {
      key,
      label,
      field_count: groupedFields.length,
      value_count: groupedFields.reduce((sum, field) => sum + field.value_count, 0),
      deal_count: dealIds.size,
      fields: groupedFields.map((field) => ({
        key: field.key,
        displayName: field.displayName,
        type: field.type,
        value_count: field.value_count,
        count: field.count,
      })),
    };
  }).filter((group) => group.key === 'ALL' || group.field_count > 0);
  const selectedField = fields.find((field) => field.key === selectedFieldKey)
    || [...fields].sort((a, b) => b.value_count - a.value_count || b.count - a.count || a.key.localeCompare(b.key))[0]
    || null;
  const selectedTriples = selectedField ? (triplesByField.get(selectedField.key) || []) : [];
  const allValues = groupValues(selectedTriples, { sampleLimit }).filter((value) => valueMatches(value, q));
  return {
    schema_version: normalized.schema_version,
    generated_at: normalized.generated_at,
    field_total: reviewFields.length,
    fields,
    section_groups: sectionGroups,
    selected_field: selectedField,
    values: allValues.slice(0, valueLimit),
    value_total: allValues.length,
    limit: valueLimit,
  };
}

export default function handler(req, res) {
  res.status(200).json(buildStringRegistry(req.query || {}));
}
```
