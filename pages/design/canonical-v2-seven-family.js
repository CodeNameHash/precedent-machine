import Head from 'next/head';
import MergertraceStyles from '../../components/review-v2/MergertraceStyles';
import SevenFamilyV1Surface from '../../components/review-v2/SevenFamilyV1Surface';
import { designPreviewServerSideProps } from '../../lib/design/route-guard';

export async function getServerSideProps() {
  const guard = designPreviewServerSideProps();
  if (guard.notFound) return guard;
  const {
    loadSevenFamilyGroupingPreview,
  } = require('../../lib/canonical-v2/seven-family-grouping-preview-source');
  const {
    buildSevenFamilyV1PreviewDeal,
  } = require('../../lib/canonical-v2/seven-family-v1-preview-deal');
  const preview = loadSevenFamilyGroupingPreview({ env: process.env });
  if (!preview) return { notFound: true };
  return { props: { preview, v1ReviewDeal: buildSevenFamilyV1PreviewDeal() } };
}

function SourceIdentity({ source }) {
  return (
    <details className="mt-3 text-[10px] text-[#77736C]">
      <summary className="cursor-pointer font-semibold hover:text-[#1F1F1F]">Sealed source identity</summary>
      <div className="mt-2 break-all border-l-2 border-[#D9D7D2] pl-3 font-mono leading-4">
        <div>{source.path}</div>
        <div>{source.byte_length.toLocaleString()} bytes</div>
        <div>SHA-256 {source.sha256}</div>
        <div>Package {source.family_profile_package_id}</div>
      </div>
    </details>
  );
}

function PartyBands({ bands }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {bands.map((band) => (
        <span
          key={band.party_band || 'not-party-banded'}
          className="inline-flex items-center gap-1 rounded-full border border-[#D9D7D2] bg-white px-2 py-1 text-[9px] font-semibold text-[#4F4C47]"
        >
          <span>{band.party_band || 'Not party-banded'}</span>
          <span className="font-mono text-[#77736C]">{band.profile_count}</span>
        </span>
      ))}
    </div>
  );
}

function readableProfilePath(classificationPath) {
  return classificationPath.map((part) => (
    part.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  )).join(' / ');
}

const DEAL_LABELS = {
  concho: 'Concho',
  metsera: 'Metsera',
  redhat: 'Red Hat',
  skechers: 'Skechers',
  skywater: 'SkyWater',
  topbuild: 'TopBuild',
};

function readableCode(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const CODE_ATTRIBUTE_KEYS = new Set([
  'appraisal_status',
  'carveback_source_form',
  'day_kind',
  'delivery_stage',
  'financing_kind',
  'prong_code',
  'restriction_category',
  'standard_code',
  'threshold_basis',
]);

function readableAttributeValue(key, value) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (CODE_ATTRIBUTE_KEYS.has(key)) return readableCode(value);
  return String(value);
}

export function formatEvidenceValue(evidence) {
  if (evidence.evidence_kind === 'PHASE2_SOURCE_ONLY') {
    return 'Recorded source example, no structured claim';
  }
  if (evidence.claim_definition_key === 'PER_SHARE_CASH_CONSIDERATION') {
    const amount = Number(evidence.canonical_value).toFixed(2);
    return evidence.attributes?.currency === 'USD' ? `$${amount}` : `${amount} ${evidence.attributes?.currency || ''}`.trim();
  }
  if (evidence.claim_definition_key === 'PAYOFF_DELIVERY_LEAD_TIME_DAYS') {
    const amount = Number(evidence.canonical_value);
    const dayKind = readableCode(evidence.attributes?.day_kind || 'day').toLowerCase();
    const stage = readableCode(evidence.attributes?.delivery_stage).toLowerCase();
    return `${amount} ${dayKind} ${amount === 1 ? 'day' : 'days'}${stage ? `, ${stage}` : ''}`;
  }
  if (typeof evidence.canonical_value === 'boolean') {
    const trueLabels = {
      APPRAISAL_SETTLEMENT_CONSENT: 'Settlement consent required',
      APPRAISAL_WITHDRAWAL_RECONVERSION: 'Withdrawal reconversion applies',
      DIVIDEND_COORDINATION_COVENANT: 'Dividend coordination required',
      IOC_RESTRICTION_PRESENT: 'Restriction present',
      LIMITED_GUARANTY_DELIVERED: 'Limited guaranty delivered',
      MAE_DISPROPORTIONALITY_CARVEBACK: 'Disproportionality carve-back present',
      NO_FINANCING_CONDITION_ACKNOWLEDGMENT: 'No financing condition',
    };
    return evidence.canonical_value
      ? (trueLabels[evidence.claim_definition_key] || 'Yes')
      : 'No';
  }
  return readableCode(evidence.canonical_value);
}

export function formatMeasurementValue(measurement) {
  if (measurement.measurement_state === 'NOT_YET_MEASURED') return 'Not yet measured';
  if (measurement.disposition === 'ABSENT') return 'Absent';
  if (measurement.disposition === 'UNRESOLVED') return 'Unresolved';
  if (measurement.measurement_state !== 'MEASURED'
    || measurement.disposition !== 'PRESENT') {
    throw new Error('measurement status is not displayable');
  }
  const { typed_value: typedValue, value_type: valueType } = measurement;
  if (valueType === 'PARTY_SET') return typedValue.parties.join('; ');
  if (valueType === 'MONEY') return `${typedValue.currency} ${typedValue.amount}`;
  if (valueType === 'PERCENTAGE') return `${typedValue}%`;
  if (valueType === 'BOOLEAN') return typedValue ? 'Yes' : 'No';
  if (valueType === 'DURATION' || valueType === 'PERIOD') {
    const bound = readableCode(typedValue.bound_type);
    const unit = typedValue.unit.toLowerCase();
    return `${bound} ${typedValue.count} ${unit}${typedValue.count === 1 ? '' : 's'}`;
  }
  if (valueType === 'ENUM') return readableCode(typedValue);
  if (['DATE', 'DEFINED_TERM', 'NUMBER', 'PARTY', 'REFERENCE'].includes(valueType)) {
    return String(typedValue);
  }
  throw new Error(`measurement value type ${valueType || '(missing)'} is not displayable`);
}

const PRESENTED_ATTRIBUTE_KEYS = new Set([
  'appraisal_status',
  'applies_to_clause_labels',
  'carveback_source_form',
  'comparison_baseline_phrase',
  'currency',
  'defined_term_ref',
  'definition_subject',
  'delivery_stage',
  'day_kind',
  'financing_kind',
  'guarantor_ref',
  'incremental_impact_phrase',
  'obligor_ref',
  'prong_code',
  'restriction_category',
  'standard_code',
  'statute_ref',
  'threshold_basis',
]);

function EvidenceAttributes({ attributes }) {
  const entries = Object.entries(attributes || {}).filter(([key, value]) => (
    PRESENTED_ATTRIBUTE_KEYS.has(key) && value !== null && value !== ''
  ));
  if (!entries.length) return null;
  return (
    <dl className="mt-2 grid gap-x-3 gap-y-1 text-[9px] sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1">
          <dt className="text-[#77736C]">{readableCode(key)}:</dt>
          <dd className="font-semibold text-[#4F4C47]">{readableAttributeValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function EvidenceCard({ evidence }) {
  const deal = DEAL_LABELS[evidence.deal] || readableCode(evidence.deal);
  const sourceOnly = evidence.evidence_kind === 'PHASE2_SOURCE_ONLY';
  return (
    <article className={`border p-2.5 ${sourceOnly ? 'border-[#D8B56A] bg-[#FFF9EC]' : 'border-[#E2E0DB] bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#77736C]">
          {deal} · §{evidence.section_reference}
        </div>
        <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] ${sourceOnly ? 'bg-[#F4E7C8] text-[#7A5918]' : 'bg-[#EEF7F0] text-[#27633A]'}`}>
          {sourceOnly ? 'Source-only' : 'Validated extraction'}
        </span>
      </div>
      <div className="mt-1 text-[9px] font-semibold text-[#5E5A54]">
        {sourceOnly ? 'Performance guaranty provision' : readableCode(evidence.claim_definition_key)}
      </div>
      <div className="mt-1 text-[12px] font-bold leading-4 text-[#1F1F1F]">
        {formatEvidenceValue(evidence)}
      </div>
      <EvidenceAttributes attributes={evidence.attributes} />
      {sourceOnly ? (
        <details className="mt-2 text-[9px] text-[#6C5524]">
          <summary className="cursor-pointer font-semibold">View recorded source identity</summary>
          <div className="mt-1 break-all font-mono leading-4">
            Source row {evidence.source_row_key}<br />
            Text SHA-256 {evidence.source_span?.text_sha256}
          </div>
        </details>
      ) : (
        <details className="mt-2 text-[9px] text-[#5E5A54]">
          <summary className="cursor-pointer font-semibold text-[#2F6DB5]">View recorded clause text</summary>
          <blockquote className="mt-1 border-l-2 border-[#C8D8EA] pl-2 leading-4">
            {evidence.raw_value}
          </blockquote>
        </details>
      )}
    </article>
  );
}

export function MeasurementStatuses({ statuses = [] }) {
  if (!statuses.length) return null;
  return (
    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
      {statuses.map((measurement) => {
        const pending = measurement.measurement_state === 'NOT_YET_MEASURED';
        return (
          <div
            key={measurement.field_key}
            data-measurement-state={measurement.measurement_state}
            data-measurement-disposition={measurement.disposition || 'UNSET'}
            className={`border px-2 py-1.5 ${pending ? 'border-[#D8B56A] bg-[#FFF9EC]' : 'border-[#D9D7D2] bg-white'}`}
          >
            <div className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#77736C]">
              {measurement.label}
            </div>
            <div className={`mt-0.5 text-[10px] font-semibold ${pending ? 'text-[#7A5918]' : 'text-[#1F1F1F]'}`}>
              {formatMeasurementValue(measurement)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function evidenceForComparisonRow(familyKey, comparisonLine, profile) {
  const evidence = profile.evidence || [];
  if (familyKey !== 'MAE_DEFINITION') return evidence;
  if (comparisonLine === 'Definition prongs' || comparisonLine === 'MAE Test') {
    return evidence.filter((entry) => entry.claim_definition_key === 'MAE_DEFINITION_PRONG');
  }
  if (comparisonLine === 'Carve-outs') {
    return evidence.filter((entry) => entry.claim_definition_key === 'MAE_CARVEOUT');
  }
  if (comparisonLine === 'Disproportionality relationships') {
    return evidence.filter((entry) => (
      entry.claim_definition_key === 'MAE_DISPROPORTIONALITY_CARVEBACK'
    ));
  }
  if (comparisonLine === 'Exceptions to carve-outs') {
    return evidence.filter((entry) => (
      entry.claim_definition_key === 'MAE_CARVEOUT'
        && /\bunderlying\b/i.test(entry.raw_value || '')
    ));
  }
  return [];
}

function ProfileCoverage({ familyKey, row }) {
  const noun = row.profile_count === 1 ? 'profile' : 'profiles';
  const evidence = row.profiles.flatMap((profile) => (
    evidenceForComparisonRow(familyKey, row.comparison_line, profile)
  ));
  const claims = evidence.filter((entry) => entry.evidence_kind === 'M4_CLAIM');
  const sourceOnly = evidence.filter((entry) => entry.evidence_kind === 'PHASE2_SOURCE_ONLY');
  const pendingMeasurements = row.profiles.flatMap(
    (profile) => profile.measurement_statuses || [],
  ).filter((measurement) => measurement.measurement_state === 'NOT_YET_MEASURED');
  const previewValues = [];
  const seenValues = new Set();
  for (const entry of claims) {
    const label = `${DEAL_LABELS[entry.deal] || readableCode(entry.deal)}: ${formatEvidenceValue(entry)}`;
    if (!seenValues.has(label)) {
      seenValues.add(label);
      previewValues.push(label);
    }
  }
  return (
    <div className="min-w-[310px]">
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-block rounded bg-[#EEF7F0] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#27633A]">
          {claims.length} validated {claims.length === 1 ? 'claim' : 'claims'}
        </span>
        {sourceOnly.length ? (
          <span className="inline-block rounded bg-[#FFF1CF] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#7A5918]">
            {sourceOnly.length} source-only
          </span>
        ) : null}
        <span className="inline-block rounded bg-[#F0F0EE] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#5E5A54]">
          Not product-served
        </span>
        {pendingMeasurements.length ? (
          <span className="inline-block rounded bg-[#FFF1CF] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#7A5918]">
            {pendingMeasurements.length} measurements not yet measured
          </span>
        ) : null}
      </div>
      {previewValues.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {previewValues.slice(0, 4).map((value) => (
            <span key={value} className="rounded border border-[#D9D7D2] bg-white px-1.5 py-1 text-[9px] font-semibold text-[#4F4C47]">
              {value}
            </span>
          ))}
          {previewValues.length > 4 ? (
            <span className="px-1 py-1 text-[9px] font-semibold text-[#77736C]">
              +{previewValues.length - 4} more values
            </span>
          ) : null}
        </div>
      ) : null}
      <details className="mt-2 text-[9px] text-[#4F4C47]">
        <summary className="cursor-pointer font-semibold text-[#2F6DB5] hover:text-[#1F1F1F]">
          View values and recorded source evidence for {row.profile_count} {noun}
        </summary>
        <div className="mt-2 max-h-[34rem] space-y-3 overflow-y-auto border-l-2 border-[#C8D8EA] pl-2">
          {row.profiles.map((profile) => {
            const profileEvidence = evidenceForComparisonRow(
              familyKey,
              row.comparison_line,
              profile,
            );
            const profileMeasurements = profile.measurement_statuses || [];
            const pendingProfileMeasurements = profileMeasurements.filter(
              (measurement) => measurement.measurement_state === 'NOT_YET_MEASURED',
            ).length;
            return (
              <section key={`${profile.profile_key}:${profile.party_band || 'not-party-banded'}`} className="bg-[#FAFAF8] p-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[#1F1F1F]">
                      {readableProfilePath(profile.classification_path)}
                    </div>
                    <div className="mt-0.5 text-[#77736C]">
                      {profile.party_band || 'Not party-banded'}
                    </div>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] ${pendingProfileMeasurements ? 'bg-[#FFF1CF] text-[#7A5918]' : 'bg-[#E7F1E9] text-[#27633A]'}`}>
                    {pendingProfileMeasurements
                      ? `${pendingProfileMeasurements} fields not yet measured`
                      : profile.output_disposition === 'REVIEW_ONLY'
                        ? 'Review-only evidence'
                        : readableCode(profile.extraction_state)}
                  </span>
                </div>
                <MeasurementStatuses statuses={profileMeasurements} />
                <div className="mt-2 space-y-2">
                  {profileEvidence.map((entry) => (
                    <EvidenceCard
                      key={entry.analysis_claim_id || entry.source_row_key}
                      evidence={entry}
                    />
                  ))}
                </div>
                <details className="mt-2 text-[8px] text-[#77736C]">
                  <summary className="cursor-pointer font-semibold">View sealed profile signature</summary>
                  <div className="mt-1 break-all font-mono leading-4 text-[#5E5A54]">
                    {profile.required_expression_signature}
                  </div>
                </details>
              </section>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function V2Rows({ familyKey, rows }) {
  return (
    <div className="overflow-hidden border border-[#AFC6E0] bg-white">
      <header className="border-b border-[#C8D8EA] bg-[#EEF5FC] px-4 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#2F6DB5]">Canonical V2 Preview</div>
        <h3 className="mt-1 text-xs font-bold text-[#1F1F1F]">Approved comparison groups and validated review evidence</h3>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#E6E4DF] bg-[#FAFAF8] text-[9px] font-bold uppercase tracking-[0.1em] text-[#77736C]">
              <th className="px-3 py-2">Comparison line</th>
              <th className="px-3 py-2">Party band and profiles</th>
              <th className="px-3 py-2">Approved fields</th>
              <th className="px-3 py-2">Validated V2 review evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEECE7]">
            {rows.map((row) => (
              <tr key={`${row.row_kind}:${row.comparison_line}`} className="align-top">
                <td className="px-3 py-3 text-[11px] font-semibold text-[#1F1F1F]">
                  {row.comparison_line}
                  {row.row_kind === 'LINK' ? (
                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#2F6DB5]">Linked family row</div>
                  ) : null}
                </td>
                <td className="px-3 py-3"><PartyBands bands={row.bands} /></td>
                <td className="px-3 py-3 text-[10px] leading-4 text-[#4F4C47]">
                  {row.comparison_fields.length ? row.comparison_fields.join('; ') : 'No separate field approved'}
                  {row.grouping_notes.map((note) => (
                    <div key={note} className="mt-1 text-[#77736C]">{note}</div>
                  ))}
                </td>
                <td className="px-3 py-3"><ProfileCoverage familyKey={familyKey} row={row} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UnmeasuredConcepts({ concepts }) {
  if (!concepts.length) return null;
  return (
    <div className="mt-4 border-l-2 border-[#D8B56A] bg-[#FFF9EC] px-4 py-3">
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A6417]">V1 fields not yet measured</div>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] leading-4 text-[#5F4A1E]">
        {concepts.map((entry) => <li key={entry.concept}>{entry.concept}</li>)}
      </ul>
    </div>
  );
}

function MeasurementSummary({ summary }) {
  if (!summary) return null;
  return (
    <div
      data-product-ready={String(summary.product_ready)}
      className="mt-4 border-l-2 border-[#D8B56A] bg-[#FFF9EC] px-4 py-3 text-[#5F4A1E]"
    >
      <div className="text-[9px] font-bold uppercase tracking-[0.12em]">
        Measurement status
      </div>
      <div className="mt-1 text-[11px] font-semibold">
        {summary.not_yet_measured_count} required measurements not yet measured
      </div>
      <div className="mt-1 text-[10px] leading-4">
        {summary.review_only ? 'Review-only' : 'Reviewed'} ·{' '}
        {summary.comparison_complete ? 'Comparison-complete' : 'Not comparison-complete'} ·{' '}
        {summary.product_ready ? 'Product-ready' : 'Not product-ready'}
      </div>
    </div>
  );
}

function FamilySection({ family, ordinal, v1ReviewDeal }) {
  return (
    <section id={family.family_key.toLowerCase()} className="scroll-mt-6 border border-[#D9D7D2] bg-[#FCFBF8] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">Family {ordinal}</div>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-[#1F1F1F]">{family.title}</h2>
        </div>
        <div className="rounded-full border border-[#B7D2BF] bg-[#EEF7F0] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#27633A]">
          {family.profile_count} sealed {family.profile_count === 1 ? 'profile' : 'profiles'}
        </div>
      </div>
      <p className="mt-3 max-w-4xl text-[11px] leading-5 text-[#4F4C47]">
        V1 remains unchanged. V2 shows the validated values and recorded clause text already bound to each sealed Work3 profile. These values are review evidence. They are not yet served to the production product.
      </p>
      <div className="mt-4 border-l-2 border-[#D8B56A] bg-[#FFF9EC] px-4 py-3 text-[10px] leading-4 text-[#5F4A1E]">
        <span className="font-bold">Different source sets.</span>
        {' '}V1 uses selected recorded examples from {v1ReviewDeal.sourceDeals.join(' and ')} to demonstrate the existing renderer. V2 uses the sealed Work3 cohort. This is not a same-deal or value-by-value comparison.
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(220px,0.7fr)_minmax(620px,1.7fr)]">
        <SevenFamilyV1Surface familyKey={family.family_key} reviewDeal={v1ReviewDeal} />
        <V2Rows familyKey={family.family_key} rows={family.v2_rows} />
      </div>
      <MeasurementSummary summary={family.measurement_summary} />
      <UnmeasuredConcepts concepts={family.unmeasured_concepts} />
      <SourceIdentity source={family.package} />
    </section>
  );
}

export default function SevenFamilyPreview({ preview, v1ReviewDeal }) {
  return (
    <>
      <Head>
        <title>Seven-family Canonical V2 Preview</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <MergertraceStyles />
      <main className="min-h-screen bg-[#F3F1EC] px-4 py-8 text-[#1F1F1F] sm:px-7 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <header className="border-t-4 border-black bg-white px-5 py-6 shadow-sm sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#2F6DB5]">Canonical V2 Preview</div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Seven-family grouping application</h1>
                <p className="mt-3 max-w-3xl text-[11px] leading-5 text-[#4F4C47]">
                  Read-only evidence preview. V1 surfaces appear beside the ruled V2 comparison groups, validated values and recorded clause text. Every V2 row is derived at request time from the exact sealed successor packages, their bound grouping dispositions and their current review evidence.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden border border-[#D9D7D2] bg-[#D9D7D2] text-center sm:grid-cols-4">
                {[
                  ['Families', preview.family_count],
                  ['Profiles', preview.profile_count],
                  ['Validated claims', preview.claim_count],
                  ['Source-only', preview.source_only_count],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-[82px] bg-[#FAFAF8] px-3 py-3">
                    <div className="font-mono text-lg font-bold">{value}</div>
                    <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#77736C]">{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-[0.1em]">
              <span className="rounded bg-[#EEF7F0] px-2.5 py-1.5 text-[#27633A]">Independent review: {preview.review.state}</span>
              <span className="rounded bg-[#F0F0EE] px-2.5 py-1.5 text-[#4F4C47]">Preview only</span>
              <span className="rounded bg-[#F0F0EE] px-2.5 py-1.5 text-[#4F4C47]">No production effect</span>
              <span className="rounded bg-[#F0F0EE] px-2.5 py-1.5 text-[#4F4C47]">No database writes</span>
            </div>
          </header>

          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Family navigation">
            {preview.families.map((family) => (
              <a
                key={family.family_key}
                href={`#${family.family_key.toLowerCase()}`}
                className="border border-[#D9D7D2] bg-white px-3 py-2 text-[9px] font-bold uppercase tracking-[0.08em] text-[#4F4C47] hover:border-[#2F6DB5] hover:text-[#2F6DB5]"
              >
                {family.title}
              </a>
            ))}
          </nav>

          <div className="mt-5 space-y-5">
            {preview.families.map((family, index) => (
              <FamilySection
                key={family.family_key}
                family={family}
                ordinal={index + 1}
                v1ReviewDeal={v1ReviewDeal}
              />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

SevenFamilyPreview.noLayout = true;
