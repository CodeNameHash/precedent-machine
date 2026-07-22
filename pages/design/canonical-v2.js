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
  const { buildLandosNoShopServingFixture } = require('../../__fixtures__/canonical-v2/landos-no-shop-rows');
  const { buildLandosTerminationFeeServingFixture } = require('../../__fixtures__/canonical-v2/landos-termination-fee-row');
  const { adaptSharedServingRows } = require('../../lib/canonical-v2/shared-row-adapter');
  const fixture = buildLandosReviewedServingFixture();
  const iocFixture = buildLandosIocCapexServingFixture();
  const noShopFixture = buildLandosNoShopServingFixture();
  const terminationFeeFixture = buildLandosTerminationFeeServingFixture();
  const [reviewedRow, unrecognisedRow, iocRow, terminationFeeRow, ...noShopRows] = adaptSharedServingRows([
    fixture.row,
    { row_kind: 'UNRECOGNISED_PROVISION_CANDIDATE' },
    iocFixture.row,
    terminationFeeFixture.row,
    ...noShopFixture.rows,
  ]);
  return {
    props: {
      reviewed_row: JSON.parse(JSON.stringify(reviewedRow)),
      unrecognised_row: JSON.parse(JSON.stringify(unrecognisedRow)),
      ioc_capex_row: JSON.parse(JSON.stringify(iocRow)),
      ioc_capex_source_text: iocFixture.detailPackage.detail_payloads[0].response_body.excerpt.exact_text,
      termination_fee_row: JSON.parse(JSON.stringify(terminationFeeRow)),
      termination_fee_source_text: terminationFeeFixture.detailPackage.detail_payloads[0].response_body.excerpt.exact_text,
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

export default function CanonicalV2DesignFixture({
  reviewed_row: reviewedRow,
  exact_source_text: exactSourceText,
  ioc_capex_row: iocCapexRow,
  ioc_capex_source_text: iocCapexSourceText,
  no_shop_rows: noShopRows,
  no_shop_source_text_by_row: noShopSourceTextByRow,
  termination_fee_row: terminationFeeRow,
  termination_fee_source_text: terminationFeeSourceText,
  unrecognised_row: unrecognisedRow,
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

          <RowIsolationProof item={unrecognisedRow} />
          <IocCapexRow item={iocCapexRow} sourceText={iocCapexSourceText} />
          <TerminationFeeRow item={terminationFeeRow} sourceText={terminationFeeSourceText} />
          <NoShopRows rows={noShopRows} sourceTextByRow={noShopSourceTextByRow} />
        </div>
      </main>
    </>
  );
}

CanonicalV2DesignFixture.noLayout = true;
