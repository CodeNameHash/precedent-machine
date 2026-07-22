import Head from 'next/head';
import { useState } from 'react';
import MergertraceStyles from '../../components/review-v2/MergertraceStyles';
import { MarketMetricCell } from '../../components/review-v2/MarketColumn';
import MarketDrilldownSidebar from '../../components/review-v2/MarketDrilldownSidebar';
import { buildTypedRowMarketContext } from '../../components/review-v2/rowMarketContext';
import { designPreviewServerSideProps } from '../../lib/design/route-guard';

export async function getServerSideProps(context) {
  const guard = designPreviewServerSideProps();
  if (guard.notFound) return guard;
  const { buildLandosReviewedServingFixture } = require('../../__fixtures__/canonical-v2/landos-reviewed-row');
  const { buildLandosIocCapexServingFixture } = require('../../__fixtures__/canonical-v2/landos-ioc-capex-row');
  const { buildLandosMaterialContractsServingFixture } = require('../../__fixtures__/canonical-v2/landos-material-contracts-row');
  const { buildLandosNoShopServingFixture } = require('../../__fixtures__/canonical-v2/landos-no-shop-rows');
  const { buildLandosTerminationFeeServingFixture } = require('../../__fixtures__/canonical-v2/landos-termination-fee-row');
  const { buildLandosSourceSpecificServingFixture } = require('../../__fixtures__/canonical-v2/landos-source-specific-row');
  const { contentId } = require('../../lib/canonical-v2/canonical-bytes');
  const {
    buildCanonicalQueryResultView,
    compileCanonicalQueryRequest,
  } = require('../../lib/canonical-v2/query-result');
  const { adaptSharedServingRows } = require('../../lib/canonical-v2/shared-row-adapter');
  const fixture = buildLandosReviewedServingFixture();
  const iocFixture = buildLandosIocCapexServingFixture();
  const materialContractsFixture = buildLandosMaterialContractsServingFixture();
  const noShopFixture = buildLandosNoShopServingFixture();
  const terminationFeeFixture = buildLandosTerminationFeeServingFixture();
  const sourceSpecificFixture = buildLandosSourceSpecificServingFixture();
  const terminationFeeMarket = terminationFeeFixture.row.canonical_result.market_context;
  const queryRequest = compileCanonicalQueryRequest({
    serving_namespace_id: contentId('SERVING_NAMESPACE/V1', 'landos-reviewed-fixture'),
    corpus_release_id: terminationFeeFixture.row.corpus_release_id,
    contract_fingerprint: terminationFeeFixture.row.provenance.contract_fingerprint,
    intent: 'MARKET_RANGE',
    metric_key: terminationFeeMarket.metric_key,
    metric_version: terminationFeeMarket.metric_version,
    concept_key: terminationFeeFixture.row.canonical_result.concept_key,
    party: terminationFeeFixture.row.canonical_result.party,
    filters: {},
    selected_columns: null,
    column_filters: {},
    page_size: 25,
    cursor: null,
  });
  const queryView = buildCanonicalQueryResultView({
    schema_version: 'CANONICAL_QUERY_PAGE_RESULT/V1',
    serving_namespace_id: queryRequest.serving_namespace_id,
    corpus_release_id: queryRequest.corpus_release_id,
    contract_fingerprint: queryRequest.contract_fingerprint,
    query_semantics_digest: queryRequest.query_semantics_digest,
    total_count: 1,
    page_count: 1,
    rows: [terminationFeeFixture.row],
    next_cursor: null,
  }, queryRequest);
  const [reviewedRow, unrecognisedRow, sourceSpecificRow, iocRow, materialContractsRow, terminationFeeRow, ...noShopRows] = adaptSharedServingRows([
    fixture.row,
    { row_kind: 'UNRECOGNISED_PROVISION_CANDIDATE' },
    sourceSpecificFixture.row,
    iocFixture.row,
    materialContractsFixture.row,
    terminationFeeFixture.row,
    ...noShopFixture.rows,
  ]);
  return {
    props: {
      reviewed_row: JSON.parse(JSON.stringify(reviewedRow)),
      unrecognised_row: JSON.parse(JSON.stringify(unrecognisedRow)),
      source_specific_row: JSON.parse(JSON.stringify(sourceSpecificRow)),
      source_specific_excerpts: sourceSpecificFixture.exactDetail.detail_payloads[0].response_body.exact_excerpts,
      ioc_capex_row: JSON.parse(JSON.stringify(iocRow)),
      ioc_capex_source_text: iocFixture.detailPackage.detail_payloads[0].response_body.excerpt.exact_text,
      material_contracts_row: JSON.parse(JSON.stringify(materialContractsRow)),
      material_contracts_source_text: materialContractsFixture.detailPackage.detail_payloads[0].response_body.excerpt.exact_text,
      termination_fee_row: JSON.parse(JSON.stringify(terminationFeeRow)),
      termination_fee_source_text: terminationFeeFixture.detailPackage.detail_payloads[0].response_body.excerpt.exact_text,
      query_view: JSON.parse(JSON.stringify(queryView)),
      no_shop_rows: JSON.parse(JSON.stringify(noShopRows)),
      no_shop_source_text_by_row: Object.fromEntries(noShopFixture.rows.map((row, index) => [
        row.row_serving_key,
        noShopFixture.detailPackages[index].detail_payloads[0].response_body.excerpt.exact_text,
      ])),
      exact_source_text: fixture.exactDetail.detail_payloads[0].response_body.excerpt.exact_text,
      reviewed_mapping_id: fixture.reviewed_mapping.reviewed_mapping_id,
      preview_environment: context?.req?.headers?.host || 'local',
    },
  };
}

function RowFailure({ item, label = 'Provision needs review' }) {
  return (
    <div
      className="border border-[#D8B56A] bg-[#FFF9EC] px-4 py-3"
      data-row-result="failed"
      data-reason-code={item?.reason_code || 'INVALID_SHARED_SERVING_ROW'}
    >
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A6417]">{label}</div>
      <p className="mt-1 text-[10px] leading-4 text-[#5F4A1E]">
        This provision could not be mapped safely. It is isolated for review while every valid sibling row remains available.
      </p>
    </div>
  );
}

function RowBoundary({ item, label, children }) {
  if (item?.render_kind !== 'ROW') return <RowFailure item={item} label={label} />;
  return children(item.prepared);
}

function Surface({ name, rowKey, children }) {
  return (
    <section className="border border-[#D9D7D2] bg-white" data-surface={name} data-row-key={rowKey}>
      <header className="border-b border-[#E6E4DF] bg-[#F7F5F0] px-4 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">Canonical v2 fixture</div>
        <h2 className="mt-1 text-sm font-bold text-[#1F1F1F]">{name}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SubjectTreatment({ adapted, sourceText = null }) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const metricKey = adapted.resolution.metrics[0].metricKey;
  const metric = adapted.data.byRow[adapted.row_key].metrics[metricKey];
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#77736C]">This deal</div>
      <div className="mt-1 text-xs font-semibold text-[#1F1F1F]">{metric.subject.label}</div>
      <dl className="mt-3 space-y-2 border-t border-[#E6E4DF] pt-3">
        {metric.subject.legalTerms.map((term) => (
          <div key={term.key} className="grid grid-cols-[92px_1fr] gap-3 text-[10px] leading-4">
            <dt className="font-bold text-[#77736C]">{term.label}</dt>
            <dd className="text-[#1F1F1F]">{term.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 text-[9px] text-[#77736C]">
        {metric.coverage.excludedCount === 0
          ? 'No fixture observations excluded'
          : `${metric.coverage.excludedCount} peer slots excluded with a typed reason`}
      </div>
      {metric.source?.state === 'available' && sourceText ? (
        <div className="mt-3 border-t border-[#E6E4DF] pt-2">
          <button
            type="button"
            onClick={() => setSourceOpen((open) => !open)}
            className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline"
          >
            {sourceOpen ? 'Hide provision' : 'See provision'}
          </button>
          {sourceOpen ? (
            <div className="mt-2 border-l-2 border-[#2F6DB5] bg-[#F7F9FC] px-3 py-2 font-mono text-[9px] leading-4 text-[#1F1F1F]">
              {sourceText}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function QueryResult({ adapted, sourceText }) {
  return (
    <div className="overflow-hidden border border-[#E6E4DF]">
      <div className="grid grid-cols-[minmax(160px,0.8fr)_minmax(220px,1.2fr)] border-b border-[#E6E4DF] bg-[#F7F5F0] text-[9px] font-bold uppercase tracking-[0.1em] text-[#77736C]">
        <div className="px-3 py-2">Result</div>
        <div className="border-l border-[#E6E4DF] px-3 py-2">Market terms</div>
      </div>
      <div className="grid grid-cols-[minmax(160px,0.8fr)_minmax(220px,1.2fr)]">
        <div className="px-3 py-3"><SubjectTreatment adapted={adapted} sourceText={sourceText} /></div>
        <div className="border-l border-[#E6E4DF] px-3 py-3">
          <MarketMetricCell resolution={adapted.resolution} data={adapted.data} />
        </div>
      </div>
    </div>
  );
}

function NoShopRows({ rows, sourceTextByRow }) {
  return (
    <section className="mt-5 border border-[#D9D7D2] bg-white">
      <header className="border-b border-[#E6E4DF] bg-[#F7F5F0] px-4 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">Real Section 5.3 result set</div>
        <h2 className="mt-1 text-sm font-bold text-[#1F1F1F]">No-shop / non-solicit terms</h2>
        <p className="mt-1 text-[10px] text-[#77736C]">
          Each subrow is independently comparable. Exceptions stay attached only to the actions they legally qualify.
        </p>
      </header>
      <div className="divide-y divide-[#E6E4DF]">
        {rows.map((item) => (
          <div key={item.key} className="px-4 py-4">
            <RowBoundary item={item} label="No-shop provision needs review">
              {(row) => (
                <div className="grid grid-cols-[minmax(260px,1fr)_minmax(260px,0.9fr)] gap-5" data-row-result="ready">
                  <div>
                    <div className="mb-2 text-[10px] font-bold text-[#1F1F1F]">{row.resolution.label}</div>
                    <SubjectTreatment adapted={row} sourceText={sourceTextByRow[row.row_key]} />
                  </div>
                  <div className="border-l border-[#E6E4DF] pl-5">
                    <MarketMetricCell resolution={row.resolution} data={row.data} />
                  </div>
                </div>
              )}
            </RowBoundary>
          </div>
        ))}
      </div>
    </section>
  );
}

function IocCapexRow({ item, sourceText }) {
  return (
    <section className="mt-5 border border-[#D9D7D2] bg-white">
      <header className="border-b border-[#E6E4DF] bg-[#F7F5F0] px-4 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">Real Section 5.2 result</div>
        <h2 className="mt-1 text-sm font-bold text-[#1F1F1F]">Interim operating covenant, capital expenditures</h2>
        <p className="mt-1 text-[10px] text-[#77736C]">
          Raw dollars remain visible. The market comparison uses percentage of the source-backed closing deal value.
        </p>
      </header>
      <div className="px-4 py-4">
        <RowBoundary item={item} label="Capital-expenditure provision needs review">
          {(row) => (
            <div className="grid grid-cols-[minmax(260px,1fr)_minmax(260px,0.9fr)] gap-5" data-row-result="ready">
              <SubjectTreatment adapted={row} sourceText={sourceText} />
              <div className="border-l border-[#E6E4DF] pl-5">
                <MarketMetricCell resolution={row.resolution} data={row.data} />
              </div>
            </div>
          )}
        </RowBoundary>
      </div>
    </section>
  );
}

function TerminationFeeRow({ item, sourceText }) {
  return (
    <section className="mt-5 border border-[#D9D7D2] bg-white">
      <header className="border-b border-[#E6E4DF] bg-[#F7F5F0] px-4 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">Real Sections 7.1 and 7.3 result</div>
        <h2 className="mt-1 text-sm font-bold text-[#1F1F1F]">Seller termination fee and triggers</h2>
        <p className="mt-1 text-[10px] text-[#77736C]">
          The fee is normalised against the closing transaction value. Payer, payee and all three payment triggers remain explicit.
        </p>
      </header>
      <div className="px-4 py-4">
        <RowBoundary item={item} label="Seller termination-fee provision needs review">
          {(row) => (
            <div className="grid grid-cols-[minmax(260px,1fr)_minmax(260px,0.9fr)] gap-5" data-row-result="ready">
              <SubjectTreatment adapted={row} sourceText={sourceText} />
              <div className="border-l border-[#E6E4DF] pl-5">
                <MarketMetricCell resolution={row.resolution} data={row.data} />
              </div>
            </div>
          )}
        </RowBoundary>
      </div>
    </section>
  );
}

function MaterialContractsRow({ item, sourceText }) {
  return (
    <section className="mt-5 border border-[#D9D7D2] bg-white">
      <header className="border-b border-[#E6E4DF] bg-[#F7F5F0] px-4 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">Real Section 3.13 result</div>
        <h2 className="mt-1 text-sm font-bold text-[#1F1F1F]">Material Contracts cash-flow threshold</h2>
        <p className="mt-1 text-[10px] text-[#77736C]">
          The raw threshold remains visible. The comparison uses percentage of the source-backed closing transaction value and preserves the criterion and measurement period.
        </p>
      </header>
      <div className="px-4 py-4">
        <RowBoundary item={item} label="Material Contracts provision needs review">
          {(row) => (
            <div className="grid grid-cols-[minmax(260px,1fr)_minmax(260px,0.9fr)] gap-5" data-row-result="ready">
              <SubjectTreatment adapted={row} sourceText={sourceText} />
              <div className="border-l border-[#E6E4DF] pl-5">
                <MarketMetricCell resolution={row.resolution} data={row.data} />
              </div>
            </div>
          )}
        </RowBoundary>
      </div>
    </section>
  );
}

function QueryContractPreview({ view }) {
  const result = view.rows[0];
  const cells = result.cells;
  const visible = view.columns.filter((column) => !['triggers', 'source'].includes(column.column_key));
  return (
    <section className="mt-5 overflow-hidden border border-[#D9D7D2] bg-white" data-query-contract-preview="true">
      <header className="border-b border-[#E6E4DF] bg-[#F7F5F0] px-4 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">Canonical query result</div>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold text-[#1F1F1F]">Termination fees market check</h2>
          <div className="text-[9px] text-[#77736C]">{view.total_count} matching deal</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {view.refinements.map((refinement) => (
            <span key={refinement.column_key} className="border border-[#D9D7D2] bg-white px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[#66625C]">
              Refine by {refinement.column_key.replaceAll('_', ' ')}
            </span>
          ))}
        </div>
      </header>
      <div className="p-4">
        <div className="grid gap-px border border-[#E6E4DF] bg-[#E6E4DF] sm:grid-cols-2 xl:grid-cols-4">
          {visible.map((column) => {
            const value = cells[column.column_key];
            const display = column.column_key === 'percent_of_deal_value'
              ? `${value}%`
              : value?.label
              || (value?.value && value?.capacity ? `${value.value} (${value.capacity.toLowerCase()})` : null)
              || String(value ?? 'Not captured');
            return (
              <div key={column.column_key} className="min-w-0 bg-white px-3 py-3">
                <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#77736C]">{column.label}</div>
                <div className="mt-1 break-words text-[10px] font-semibold text-[#1F1F1F]">{display}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_180px]">
          <div className="border border-[#E6E4DF] px-3 py-3">
            <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#77736C]">Triggers and payment timing</div>
            <ul className="mt-2 grid gap-2 text-[10px] leading-4 text-[#1F1F1F] lg:grid-cols-3">
              {cells.triggers.map((trigger) => (
                <li key={trigger.trigger_code} className="border-l-2 border-[#2F6DB5] pl-2">
                  <div className="font-semibold">{trigger.trigger_code.replaceAll('_', ' ')}</div>
                  <div className="mt-1 text-[9px] text-[#77736C]">{trigger.payment_timing.replaceAll('_', ' ')}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-[#E6E4DF] px-3 py-3">
            <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#77736C]">Source</div>
            <div className="mt-2 text-[10px] font-semibold text-[#2F6DB5]">Exact claim evidence</div>
            <div className="mt-1 font-mono text-[8px] text-[#77736C]">{cells.source.source_detail_reference_id.slice(0, 12)}…</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RowIsolationProof({ item }) {
  return (
    <section className="mt-5 border border-[#D9D7D2] bg-white px-4 py-4" data-isolation-proof="true">
      <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">Row isolation proof</div>
      <RowBoundary item={item} label="Unrecognised provision">
        {() => null}
      </RowBoundary>
    </section>
  );
}

function SourceSpecificRow({ item, sourceExcerpts }) {
  const [sourceOpen, setSourceOpen] = useState(false);
  return (
    <section className="mt-5 border border-[#D9D7D2] bg-white" data-source-specific-proof="true">
      <header className="border-b border-[#E6E4DF] bg-[#F7F5F0] px-4 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">Reviewed unfamiliar proposition</div>
        <h2 className="mt-1 text-sm font-bold text-[#1F1F1F]">Source-specific treatment without invented comparability</h2>
      </header>
      <div className="px-4 py-4">
        <RowBoundary item={item} label="Source-specific proposition needs review">
          {(row) => {
            const sourceSpecific = row.resolution.sourceSpecific;
            return (
              <div data-row-result="ready" data-market-cohort-eligible="false">
                <div className="grid gap-5 lg:grid-cols-[minmax(240px,0.8fr)_minmax(300px,1.2fr)]">
                  <div>
                    <div className="text-xs font-bold text-[#1F1F1F]">{sourceSpecific.displayLabel}</div>
                    <div className="mt-2 text-[10px] leading-4 text-[#66625C]">{sourceSpecific.nonComparableReason}</div>
                    <div className="mt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-[#77736C]">
                      Observed party: {sourceSpecific.observedPartyTokens.join(', ')}
                    </div>
                  </div>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {sourceSpecific.primitives.map((primitive) => (
                      <div key={primitive.key} className="border-l-2 border-[#2F6DB5] pl-3 text-[10px] leading-4">
                        <dt className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#77736C]">{primitive.kind.replaceAll('_', ' ')}</dt>
                        <dd className="mt-1 font-semibold text-[#1F1F1F]">{primitive.interpretedValue}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="mt-4 border-t border-[#E6E4DF] pt-3">
                  <button
                    type="button"
                    onClick={() => setSourceOpen((open) => !open)}
                    className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline"
                  >
                    {sourceOpen ? 'Hide exact evidence' : 'See exact evidence'}
                  </button>
                  {sourceOpen ? (
                    <div className="mt-2 grid gap-2">
                      {sourceExcerpts.map((excerpt) => (
                        <div key={excerpt.evidence_reference_id} className="border-l-2 border-[#2F6DB5] bg-[#F7F9FC] px-3 py-2">
                          <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#77736C]">{excerpt.evidence_role.replaceAll('_', ' ')}</div>
                          <div className="mt-1 font-mono text-[9px] leading-4 text-[#1F1F1F]">{excerpt.exact_text}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          }}
        </RowBoundary>
      </div>
    </section>
  );
}

export default function CanonicalV2DesignFixture({
  reviewed_row: reviewedRow,
  exact_source_text: exactSourceText,
  ioc_capex_row: iocCapexRow,
  ioc_capex_source_text: iocCapexSourceText,
  material_contracts_row: materialContractsRow,
  material_contracts_source_text: materialContractsSourceText,
  no_shop_rows: noShopRows,
  no_shop_source_text_by_row: noShopSourceTextByRow,
  termination_fee_row: terminationFeeRow,
  termination_fee_source_text: terminationFeeSourceText,
  query_view: queryView,
  unrecognised_row: unrecognisedRow,
  source_specific_row: sourceSpecificRow,
  source_specific_excerpts: sourceSpecificExcerpts,
  reviewed_mapping_id: reviewedMappingId,
  preview_environment: previewEnvironment,
}) {
  const adapted = reviewedRow.render_kind === 'ROW' ? reviewedRow.prepared : null;
  const context = adapted ? buildTypedRowMarketContext(adapted.resolution, adapted.data) : null;
  const rowKey = reviewedRow.key;
  return (
    <>
      <Head><title>Canonical v2 cross-surface fixture</title></Head>
      <MergertraceStyles />
      <main className="min-h-screen bg-[#F2F0EA] px-6 py-8" style={{ fontFamily: 'var(--mtx-sans)' }}>
        <div className="mx-auto max-w-[1360px]">
          <header className="mb-6 flex items-end justify-between gap-6 border-b-2 border-[#1F1F1F] pb-4">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#77736C]">Preview-only, in-memory fixture</div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1F1F1F]">One row contract across four surfaces</h1>
              <p className="mt-2 max-w-3xl text-[11px] leading-5 text-[#66625C]">
                Landos / AbbVie capitalisation bring-down. Built from the exact agreement, with no runtime data request.
              </p>
            </div>
            <div className="text-right text-[9px] text-[#77736C]">
              <div className="font-bold uppercase tracking-[0.1em]">{previewEnvironment}</div>
              <div className="mt-1 font-mono">{rowKey.slice(0, 12)}…</div>
              <div className="mt-1 font-mono">map {reviewedMappingId.slice(0, 12)}…</div>
            </div>
          </header>

          <div className="grid gap-5 xl:grid-cols-2">
            <Surface name="Review" rowKey={rowKey}>
              <RowBoundary item={reviewedRow} label="Capitalisation result needs review">
                {(row) => (
                  <div className="grid grid-cols-[minmax(180px,0.8fr)_minmax(240px,1.2fr)] gap-5" data-row-result="ready">
                    <SubjectTreatment adapted={row} sourceText={exactSourceText} />
                    <MarketMetricCell resolution={row.resolution} data={row.data} />
                  </div>
                )}
              </RowBoundary>
            </Surface>

            <Surface name="Compare" rowKey={rowKey}>
              <RowBoundary item={reviewedRow} label="Capitalisation result needs review">
                {(row) => (
                  <div className="grid grid-cols-[minmax(180px,0.8fr)_minmax(240px,1.2fr)] gap-5" data-row-result="ready">
                    <SubjectTreatment adapted={row} sourceText={exactSourceText} />
                    <MarketMetricCell resolution={row.resolution} data={row.data} />
                  </div>
                )}
              </RowBoundary>
            </Surface>

            <Surface name="Corpus Context" rowKey={rowKey}>
              <RowBoundary item={reviewedRow} label="Capitalisation result needs review">
                {() => (
                  <div className="min-h-[420px] overflow-hidden border border-[#E6E4DF] [&>aside]:!block [&>aside]:!static [&>aside]:!h-auto [&>aside]:!w-full [&>aside]:!border-l-0" data-row-result="ready">
                    <MarketDrilldownSidebar context={context} />
                  </div>
                )}
              </RowBoundary>
            </Surface>

            <Surface name="Query" rowKey={rowKey}>
              <RowBoundary item={reviewedRow} label="Capitalisation result needs review">
                {(row) => <QueryResult adapted={row} sourceText={exactSourceText} />}
              </RowBoundary>
            </Surface>
          </div>

          <section className="mt-5 border border-[#D9D7D2] bg-white px-4 py-3">
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#77736C]">Exact source evidence</div>
            <div className="mt-2 font-mono text-[10px] leading-5 text-[#1F1F1F]">{exactSourceText}</div>
          </section>

          <QueryContractPreview view={queryView} />
          <RowIsolationProof item={unrecognisedRow} />
          <SourceSpecificRow item={sourceSpecificRow} sourceExcerpts={sourceSpecificExcerpts} />
          <IocCapexRow item={iocCapexRow} sourceText={iocCapexSourceText} />
          <MaterialContractsRow item={materialContractsRow} sourceText={materialContractsSourceText} />
          <TerminationFeeRow item={terminationFeeRow} sourceText={terminationFeeSourceText} />
          <NoShopRows rows={noShopRows} sourceTextByRow={noShopSourceTextByRow} />
        </div>
      </main>
    </>
  );
}

CanonicalV2DesignFixture.noLayout = true;
