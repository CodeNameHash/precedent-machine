import Head from 'next/head';
import { useMemo, useState } from 'react';
import AppHeader from '../../components/chrome/AppHeader';
import DealPicker from '../../components/query/DealPicker';
import DealHeader from '../../components/review-v2/DealHeader';
import MergertraceStyles from '../../components/review-v2/MergertraceStyles';

const { getFourDealLocalDemo, reviewDealFromDirectory } = require('../../lib/four-deal-local-demo');

const TABS = [
  ['review', 'Review'],
  ['compare', 'Compare'],
  ['context', 'Corpus Context'],
  ['query', 'Query'],
  ['admin', 'Admin'],
];

function money(value) {
  if (!Number.isFinite(Number(value))) return 'Not stated';
  const billions = Number(value) / 1e9;
  return billions >= 1 ? `$${billions.toFixed(billions >= 10 ? 0 : 1).replace(/\.0$/, '')}B` : `$${Math.round(Number(value) / 1e6)}M`;
}

function title(deal) {
  return `${deal.buyer_display} / ${deal.target_display}`;
}

export function getServerSideProps() {
  return { props: { demo: getFourDealLocalDemo() } };
}

export default function FourDealLocalDemo({ demo }) {
  const [tab, setTab] = useState('review');
  const [selectedId, setSelectedId] = useState(demo.deals[0].id);
  const selected = useMemo(() => demo.deals.find((deal) => deal.id === selectedId) || demo.deals[0], [demo.deals, selectedId]);

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
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66625C]">TopBuild, Skechers, Modiv and Metsera. This page reads the frozen home-directory snapshot only. It does not connect to the database or write data.</p>
          </header>

          <div className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="rounded border border-[#D9D7D2] bg-white p-3">
              <DealPicker deals={demo.deals} value={selected.id} onChange={setSelectedId} label="Select deal" />
              <dl className="mt-5 space-y-2 border-t border-[#E6E4DF] pt-4 text-xs">
                <div><dt className="font-semibold text-[#77736C]">Snapshot</dt><dd className="mt-1 font-mono text-[10px] break-all">{demo.source_digest}</dd></div>
                <div><dt className="font-semibold text-[#77736C]">Write authority</dt><dd className="mt-1">{demo.write_authority}</dd></div>
              </dl>
            </aside>

            <section className="min-w-0 rounded border border-[#D9D7D2] bg-white">
              <nav className="flex flex-wrap gap-1 border-b border-[#D9D7D2] bg-[#F7F5F0] p-2" aria-label="Demo interface">
                {TABS.map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`border px-3 py-2 text-xs font-semibold ${tab === key ? 'border-[#1F1F1F] bg-[#1F1F1F] text-white' : 'border-[#D9D7D2] bg-white text-[#4E4B46]'}`}>{label}</button>)}
              </nav>
              {tab === 'review' ? <Review deal={selected} /> : null}
              {tab === 'compare' ? <Compare deals={demo.deals} /> : null}
              {tab === 'context' ? <CorpusContext deal={selected} /> : null}
              {tab === 'query' ? <Query deal={selected} /> : null}
              {tab === 'admin' ? <Admin demo={demo} /> : null}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

function Review({ deal }) {
  const adapted = reviewDealFromDirectory(deal);
  return <div><DealHeader deal={adapted} view="summary" onToggleView={() => {}} hasAgreementText={false} extracted={{ consideration: deal.consideration_type }} /><div className="grid gap-4 p-5 md:grid-cols-2"><Panel title="Review scope"><p>Deal identity, consideration, structure and adviser fields are available from the frozen preview directory.</p></Panel><Panel title="Available facts"><FactList deal={deal} /></Panel></div></div>;
}

function Compare({ deals }) {
  return <div className="overflow-x-auto p-5"><h2 className="text-lg font-bold">Compare four deals</h2><table className="mt-4 min-w-full border-collapse text-left text-sm"><thead><tr className="border-b border-[#D9D7D2] text-xs uppercase tracking-wide text-[#77736C]"><th className="p-2">Deal</th><th className="p-2">Value</th><th className="p-2">Consideration</th><th className="p-2">Sector</th><th className="p-2">Signed</th></tr></thead><tbody>{deals.map((deal) => <tr key={deal.id} className="border-b border-[#E6E4DF]"><td className="p-2 font-semibold">{title(deal)}</td><td className="p-2">{money(deal.value)}</td><td className="p-2">{deal.consideration_type.replaceAll('_', ' ')}</td><td className="p-2">{deal.sector}</td><td className="p-2">{deal.signing_date}</td></tr>)}</tbody></table></div>;
}

function CorpusContext({ deal }) {
  return <div className="grid gap-4 p-5 md:grid-cols-2"><Panel title="Deal context"><FactList deal={deal} /></Panel><Panel title="Source provenance"><p>Frozen home-deal directory v1.</p><p className="mt-3 text-xs text-[#66625C]">The preview does not claim full agreement text, provision cards or market statistics where the frozen directory does not provide them.</p></Panel></div>;
}

function Query({ deal }) {
  return <div className="p-5"><h2 className="text-lg font-bold">Local query result</h2><p className="mt-2 text-sm text-[#66625C]">Selected deal fields that are supported by the frozen preview directory.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Result label="Deal" value={title(deal)} /><Result label="Consideration" value={deal.consideration_type.replaceAll('_', ' ')} /><Result label="Sector" value={deal.sector} /><Result label="Merger form" value={deal.merger_form.replaceAll('_', ' ')} /></div></div>;
}

function Admin({ demo }) {
  return <div className="p-5"><h2 className="text-lg font-bold">Admin status</h2><p className="mt-2 text-sm text-[#66625C]">This local demo intentionally exposes no ingestion, editing, approval or database action.</p><dl className="mt-4 grid gap-3 sm:grid-cols-2"><Result label="Dataset" value={`${demo.deals.length} frozen deals`} /><Result label="Write authority" value={demo.write_authority} /><Result label="Supported interfaces" value="Review, Compare, Corpus Context, Query" /><Result label="Database connection" value="Not used" /></dl></div>;
}

function FactList({ deal }) {
  return <dl className="space-y-2 text-sm"><Result label="Deal" value={title(deal)} /><Result label="Value" value={money(deal.value)} /><Result label="Signing date" value={deal.signing_date} /><Result label="Buyer counsel" value={deal.advisors.buyer_firms.join(', ') || 'Not stated'} /><Result label="Target counsel" value={deal.advisors.seller_firms.join(', ') || 'Not stated'} /></dl>;
}

function Panel({ title, children }) { return <article className="rounded border border-[#E6E4DF] bg-[#FBFAF7] p-4"><h2 className="text-sm font-bold uppercase tracking-wide text-[#4E4B46]">{title}</h2><div className="mt-3 text-sm leading-6 text-[#34312D]">{children}</div></article>; }
function Result({ label, value }) { return <div><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#77736C]">{label}</dt><dd className="mt-1 text-sm text-[#1F1F1F]">{value}</dd></div>; }

FourDealLocalDemo.noLayout = true;
