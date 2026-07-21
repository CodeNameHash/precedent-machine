import Head from 'next/head';
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
  const { adaptSharedServingRow } = require('../../lib/canonical-v2/shared-row-adapter');
  const fixture = buildLandosReviewedServingFixture();
  const iocFixture = buildLandosIocCapexServingFixture();
  const noShopFixture = buildLandosNoShopServingFixture();
  const adapted = adaptSharedServingRow(fixture.row);
  return {
    props: {
      adapted: JSON.parse(JSON.stringify(adapted)),
      ioc_capex_row: JSON.parse(JSON.stringify(adaptSharedServingRow(iocFixture.row))),
      no_shop_rows: JSON.parse(JSON.stringify(noShopFixture.rows.map(adaptSharedServingRow))),
      exact_source_text: fixture.exactDetail.detail_payloads[0].response_body.excerpt.exact_text,
      reviewed_mapping_id: fixture.reviewed_mapping.reviewed_mapping_id,
      preview_environment: context?.req?.headers?.host || 'local',
    },
  };
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

function SubjectTreatment({ adapted }) {
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
    </div>
  );
}

function QueryResult({ adapted }) {
  return (
    <div className="overflow-hidden border border-[#E6E4DF]">
      <div className="grid grid-cols-[minmax(160px,0.8fr)_minmax(220px,1.2fr)] border-b border-[#E6E4DF] bg-[#F7F5F0] text-[9px] font-bold uppercase tracking-[0.1em] text-[#77736C]">
        <div className="px-3 py-2">Result</div>
        <div className="border-l border-[#E6E4DF] px-3 py-2">Market terms</div>
      </div>
      <div className="grid grid-cols-[minmax(160px,0.8fr)_minmax(220px,1.2fr)]">
        <div className="px-3 py-3"><SubjectTreatment adapted={adapted} /></div>
        <div className="border-l border-[#E6E4DF] px-3 py-3">
          <MarketMetricCell resolution={adapted.resolution} data={adapted.data} />
        </div>
      </div>
    </div>
  );
}

function NoShopRows({ rows }) {
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
        {rows.map((row) => (
          <div key={row.row_key} className="grid grid-cols-[minmax(260px,1fr)_minmax(260px,0.9fr)] gap-5 px-4 py-4">
            <div>
              <div className="mb-2 text-[10px] font-bold text-[#1F1F1F]">{row.resolution.label}</div>
              <SubjectTreatment adapted={row} />
            </div>
            <div className="border-l border-[#E6E4DF] pl-5">
              <MarketMetricCell resolution={row.resolution} data={row.data} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function IocCapexRow({ row }) {
  return (
    <section className="mt-5 border border-[#D9D7D2] bg-white">
      <header className="border-b border-[#E6E4DF] bg-[#F7F5F0] px-4 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">Real Section 5.2 result</div>
        <h2 className="mt-1 text-sm font-bold text-[#1F1F1F]">Interim operating covenant, capital expenditures</h2>
        <p className="mt-1 text-[10px] text-[#77736C]">
          Raw dollars remain visible. The market comparison uses percentage of the source-backed closing deal value.
        </p>
      </header>
      <div className="grid grid-cols-[minmax(260px,1fr)_minmax(260px,0.9fr)] gap-5 px-4 py-4">
        <SubjectTreatment adapted={row} />
        <div className="border-l border-[#E6E4DF] pl-5">
          <MarketMetricCell resolution={row.resolution} data={row.data} />
        </div>
      </div>
    </section>
  );
}

export default function CanonicalV2DesignFixture({
  adapted,
  exact_source_text: exactSourceText,
  ioc_capex_row: iocCapexRow,
  no_shop_rows: noShopRows,
  reviewed_mapping_id: reviewedMappingId,
  preview_environment: previewEnvironment,
}) {
  const context = buildTypedRowMarketContext(adapted.resolution, adapted.data);
  const rowKey = adapted.row_key;
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
              <div className="grid grid-cols-[minmax(180px,0.8fr)_minmax(240px,1.2fr)] gap-5">
                <SubjectTreatment adapted={adapted} />
                <MarketMetricCell resolution={adapted.resolution} data={adapted.data} />
              </div>
            </Surface>

            <Surface name="Compare" rowKey={rowKey}>
              <div className="grid grid-cols-[minmax(180px,0.8fr)_minmax(240px,1.2fr)] gap-5">
                <SubjectTreatment adapted={adapted} />
                <MarketMetricCell resolution={adapted.resolution} data={adapted.data} />
              </div>
            </Surface>

            <Surface name="Corpus Context" rowKey={rowKey}>
              <div className="min-h-[420px] overflow-hidden border border-[#E6E4DF] [&>aside]:!block [&>aside]:!static [&>aside]:!h-auto [&>aside]:!w-full [&>aside]:!border-l-0">
                <MarketDrilldownSidebar context={context} />
              </div>
            </Surface>

            <Surface name="Query" rowKey={rowKey}>
              <QueryResult adapted={adapted} />
            </Surface>
          </div>

          <section className="mt-5 border border-[#D9D7D2] bg-white px-4 py-3">
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#77736C]">Exact source evidence</div>
            <div className="mt-2 font-mono text-[10px] leading-5 text-[#1F1F1F]">{exactSourceText}</div>
          </section>

          <IocCapexRow row={iocCapexRow} />
          <NoShopRows rows={noShopRows} />
        </div>
      </main>
    </>
  );
}

CanonicalV2DesignFixture.noLayout = true;
