import Head from 'next/head';
import { useMemo, useState } from 'react';
import AppHeader from '../../components/chrome/AppHeader';
import DealPicker from '../../components/query/DealPicker';
import ProcessPassageCard from '../../components/process/ProcessPassageCard';
import DealHeader from '../../components/review-v2/DealHeader';
import MergertraceStyles from '../../components/review-v2/MergertraceStyles';

const { getFourDealLocalDemo, reviewDealFromDirectory } = require('../../lib/four-deal-local-demo');

const TABS = [
  ['review', 'Review'],
  ['compare', 'Compare'],
  ['context', 'Corpus Context'],
  ['query', 'Query'],
];

function money(value) {
  if (!Number.isFinite(Number(value))) return 'Not stated';
  const billions = Number(value) / 1e9;
  return billions >= 1 ? `$${billions.toFixed(billions >= 10 ? 0 : 1).replace(/\.0$/, '')}B` : `$${Math.round(Number(value) / 1e6)}M`;
}

function title(deal) {
  return `${deal.buyer_display} / ${deal.target_display}`;
}

function stateLabel(state) {
  return String(state || 'NOT_STATED').replaceAll('_', ' ');
}

function resultStateLabel(result) {
  return result.result_domain === 'M3_CANONICAL_REVIEW' ? 'Legal review' : 'Product result state';
}

function rowSummary(rows = []) {
  return rows.reduce((summary, row) => {
    if (row.resolver_state === 'OPEN_WORLD') summary.openWorld += 1;
    else if (row.resolver_state === 'REVIEW_QUEUE') summary.reviewQueue += 1;
    else if (row.resolver_state === 'RESOLVED') summary.governed += 1;
    else if (row.resolver_state === 'STRUCTURED_INACTIVE_CANDIDATE') summary.structured += 1;
    return summary;
  }, { governed: 0, structured: 0, reviewQueue: 0, openWorld: 0 });
}

function priorityRows(rows) {
  const priority = { STRUCTURED_FORMULA: 0, REVIEW_ITEM: 1, OPEN_WORLD_WARNING: 2, GOVERNED_VALUE: 3 };
  return rows.map((row, index) => ({ row, index }))
    .sort((left, right) => (priority[left.row.result_type] ?? 4) - (priority[right.row.result_type] ?? 4)
      || left.index - right.index)
    .map(({ row }) => row);
}

export function getServerSideProps() {
  const { getFrozenFourDealLocalDemoResult } = require('../../lib/four-deal-local-demo-preview');
  return { props: { demo: getFourDealLocalDemo(), resultContract: getFrozenFourDealLocalDemoResult() } };
}

export default function FourDealLocalDemo({ demo, resultContract }) {
  const [tab, setTab] = useState('review');
  const [selectedId, setSelectedId] = useState(demo.deals[0].id);
  const selected = useMemo(() => demo.deals.find((deal) => deal.id === selectedId) || demo.deals[0], [demo.deals, selectedId]);
  const selectedResult = useMemo(() => resultContract.deals.find((deal) => deal.deal_id === selected.id), [resultContract.deals, selected.id]);

  return (
    <>
      <Head><title>Four-deal local demo · Corpus</title></Head>
      <MergertraceStyles />
      <main className="mtx min-h-screen bg-[#F2F0EA] text-[#1F1F1F]">
        <AppHeader active="corpus" center={<span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6B6B6B]">Four-deal local demo</span>} />
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <header className="border-b-2 border-[#1F1F1F] pb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#77736C]">Local preview · frozen data · read-only</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Four-deal product walkthrough</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66625C]">TopBuild, Skechers and Modiv use the sealed final M3 review packet. Metsera uses the sealed Process Product result. This page does not connect to a database or write data.</p>
          </header>

          <div className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="rounded border border-[#D9D7D2] bg-white p-3">
              <DealPicker deals={demo.deals} value={selected.id} onChange={setSelectedId} label="Select deal" />
              <dl className="mt-5 space-y-2 border-t border-[#E6E4DF] pt-4 text-xs">
                <Result label="Preview contract" value={resultContract.schema_version} />
                <Result label="Write authority" value={resultContract.write_authority} />
                <Result label="M3 artefact" value={resultContract.m3_artifact.relative_path} />
                <Result label="M3 digest" value={resultContract.m3_artifact.sha256} mono />
              </dl>
            </aside>

            <section className="min-w-0 rounded border border-[#D9D7D2] bg-white">
              <nav className="flex flex-wrap gap-1 border-b border-[#D9D7D2] bg-[#F7F5F0] p-2" aria-label="Demo interface">
                {TABS.map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`border px-3 py-2 text-xs font-semibold ${tab === key ? 'border-[#1F1F1F] bg-[#1F1F1F] text-white' : 'border-[#D9D7D2] bg-white text-[#4E4B46]'}`}>{label}</button>)}
              </nav>
              {tab === 'review' ? <Review deal={selected} result={selectedResult} /> : null}
              {tab === 'compare' ? <Compare deals={demo.deals} resultContract={resultContract} /> : null}
              {tab === 'context' ? <CorpusContext deal={selected} result={selectedResult} resultContract={resultContract} /> : null}
              {tab === 'query' ? <Query deal={selected} result={selectedResult} /> : null}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

function Review({ deal, result }) {
  const adapted = reviewDealFromDirectory(deal);
  return <div><DealHeader deal={adapted} view="summary" onToggleView={() => {}} hasAgreementText={false} extracted={{ consideration: deal.consideration_type }} /><div className="p-5"><ResultNotice result={result} /><div className="mt-4 grid gap-3 sm:grid-cols-4"><Result label="Governed values" value={rowSummary(result.rows).governed} /><Result label="Structured formulas" value={rowSummary(result.rows).structured} /><Result label="Resolver queue" value={rowSummary(result.rows).reviewQueue} /><Result label="Open-world warnings" value={rowSummary(result.rows).openWorld} /></div>{result.product_component ? <div className="mt-5"><h2 className="text-sm font-bold uppercase tracking-wide text-[#4E4B46]">Process Product result</h2><div className="mt-3"><ProcessPassageCard slot={result.product_component} /></div></div> : null}<ResultRows rows={result.rows} title="Final review output" /></div></div>;
}

function Compare({ deals, resultContract }) {
  return <div className="overflow-x-auto p-5"><h2 className="text-lg font-bold">Compare four deals</h2><p className="mt-2 text-sm text-[#66625C]">Each column uses the same frozen result contract as Review, Corpus Context and Query.</p><table className="mt-4 min-w-full border-collapse text-left text-sm"><thead><tr className="border-b border-[#D9D7D2] text-xs uppercase tracking-wide text-[#77736C]"><th className="p-2">Deal</th><th className="p-2">Result state</th><th className="p-2">Governed values</th><th className="p-2">Resolver queue</th><th className="p-2">Open-world</th></tr></thead><tbody>{deals.map((deal) => { const result = resultContract.deals.find((entry) => entry.deal_id === deal.id); const summary = rowSummary(result.rows); return <tr key={deal.id} className="border-b border-[#E6E4DF]"><td className="p-2 font-semibold">{title(deal)}</td><td className="p-2">{stateLabel(result.result_state)}</td><td className="p-2">{summary.governed}</td><td className="p-2">{summary.reviewQueue}</td><td className="p-2">{summary.openWorld}</td></tr>; })}</tbody></table></div>;
}

function CorpusContext({ deal, result, resultContract }) {
  const citations = [...new Set(result.rows.map((row) => row.source_citation))];
  return <div className="grid gap-4 p-5 md:grid-cols-2"><Panel title="Deal context"><FactList deal={deal} /><Result label="Result domain" value={stateLabel(result.result_domain)} /><Result label={resultStateLabel(result)} value={stateLabel(result.result_state)} /></Panel><Panel title="Immutable source binding"><Result label="Final review packet" value={resultContract.m3_artifact.final_review_packet_id} mono /><Result label="Source artefact" value={resultContract.m3_artifact.relative_path} /><Result label="Source citations" value={citations.length} /><p className="mt-3 text-xs text-[#66625C]">Each output row carries its retained source quote and citation. Resolver disposition is not a legal-review result.</p></Panel><div className="md:col-span-2"><ResultRows rows={result.rows} title="Exact source context" limit={8} /></div></div>;
}

function Query({ deal, result }) {
  const [query, setQuery] = useState('');
  const matched = result.rows.filter((row) => `${row.governed_field} ${row.governed_value} ${row.source_quote}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="p-5"><h2 className="text-lg font-bold">Frozen result query</h2><p className="mt-2 text-sm text-[#66625C]">Searches the same immutable output rows for {title(deal)}. It does not execute a new corpus query.</p><label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#77736C]" htmlFor="result-query">Filter governed values or source text</label><input id="result-query" value={query} onChange={(event) => setQuery(event.target.value)} className="mt-2 w-full rounded border border-[#D9D7D2] px-3 py-2 text-sm" placeholder="e.g. stockholder approval" /><ResultRows rows={matched} title={`${matched.length} matching frozen outputs`} /></div>;
}

function ResultNotice({ result }) { return <p className="border border-[#D9D7D2] bg-[#F7F5F0] px-3 py-2 text-xs leading-5 text-[#4E4B46]">{stateLabel(result.result_domain)} · {resultStateLabel(result).toLowerCase()}: {stateLabel(result.result_state)} · exact quotes and citations are bound from the frozen preview contract.</p>; }

function ResultRows({ rows, title, limit = 16 }) { const [showAll, setShowAll] = useState(false); const ordered = priorityRows(rows); const visible = showAll ? ordered : ordered.slice(0, limit); return <section className="mt-5"><div className="flex items-baseline justify-between gap-4"><h2 className="text-sm font-bold uppercase tracking-wide text-[#4E4B46]">{title}</h2><span className="text-xs text-[#77736C]">{rows.length} rows</span></div><div className="mt-3 space-y-3">{visible.map((row) => <article key={row.row_id} className="rounded border border-[#E6E4DF] bg-[#FBFAF7] p-3"><div className="flex flex-wrap items-center gap-2">{row.product_result_state ? <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#77736C]">Product: {stateLabel(row.product_result_state)}</span> : <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#77736C]">Legal: {stateLabel(row.legal_review_state)}</span>}<span className="text-xs text-[#77736C]">Resolver: {stateLabel(row.resolver_state)}</span><span className="text-xs font-semibold text-[#34312D]">{row.governed_field}</span><span className="text-xs text-[#66625C]">{row.governed_value}</span></div><blockquote className="mt-2 whitespace-pre-wrap border-l-2 border-[#1F1F1F] pl-3 text-sm leading-6 text-[#34312D]">{row.source_quote}</blockquote><p className="mt-2 text-xs font-medium text-[#66625C]">{row.source_citation}</p>{row.warning ? <p className="mt-2 text-xs font-semibold text-[#9D3B21]">Warning: {row.warning}</p> : null}{row.legal_review_reason ? <p className="mt-2 text-xs text-[#77736C]">Legal review basis: {row.legal_review_reason}</p> : null}{row.resolver_reasons.length ? <p className="mt-2 text-xs text-[#77736C]">Resolver basis: {row.resolver_reasons.join(', ')}</p> : null}</article>)}</div>{rows.length > limit ? <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-4 text-xs font-semibold underline">{showAll ? 'Show fewer rows' : `Show all ${rows.length} rows`}</button> : null}</section>; }

function FactList({ deal }) { return <dl className="space-y-2 text-sm"><Result label="Deal" value={title(deal)} /><Result label="Value" value={money(deal.value)} /><Result label="Signing date" value={deal.signing_date} /><Result label="Buyer counsel" value={deal.advisors.buyer_firms.join(', ') || 'Not stated'} /><Result label="Target counsel" value={deal.advisors.seller_firms.join(', ') || 'Not stated'} /></dl>; }
function Panel({ title, children }) { return <article className="rounded border border-[#E6E4DF] bg-[#FBFAF7] p-4"><h2 className="text-sm font-bold uppercase tracking-wide text-[#4E4B46]">{title}</h2><div className="mt-3 text-sm leading-6 text-[#34312D]">{children}</div></article>; }
function Result({ label, value, mono = false }) { return <div><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#77736C]">{label}</dt><dd className={`mt-1 break-all text-sm text-[#1F1F1F] ${mono ? 'font-mono text-[10px]' : ''}`}>{value}</dd></div>; }

FourDealLocalDemo.noLayout = true;
