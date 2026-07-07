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
