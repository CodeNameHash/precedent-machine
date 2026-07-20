import { useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import MergertraceStyles from '../../../components/review-v2/MergertraceStyles';
import { resolveWhatsMarketIntent } from '../../../lib/query/whats-market';

const TOPICS = [
  ['COVENANT_INTERIM_OPERATING', 'Interim operating covenants', 'Ordinary-course duties, affirmative limbs, restrictions and exceptions'],
  ['COVENANT_NO_SOLICITATION', 'No-shop and fiduciary out', 'Matching rights, superior-proposal standards, force-the-vote and go-shops'],
  ['TERMINATION_FEE', 'Termination fees', 'Company and reverse fees, triggers, tails and fee ranges'],
  ['ANTITRUST_REGULATORY', 'Regulatory risk allocation', 'Efforts standards, divestiture obligations and hell-or-high-water terms'],
  ['CLOSING_CONDITION', 'Closing conditions', 'Bringdown standards, MAE conditions and covenant compliance'],
  ['REPRESENTATION', 'Representations and qualifiers', 'Materiality, knowledge, scrape and survival treatments'],
  ['MAE', 'Material adverse effect', 'Definitions, carve-outs, disproportionate-effects exceptions and conditions'],
  ['CONSIDERATION', 'Consideration and appraisal', 'Consideration mechanics, appraisal rights and equity treatment'],
];

function decodePayload(raw) {
  if (!raw || typeof window === 'undefined') return {};
  try {
    const base64 = String(raw).replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

function encodePayload(payload) {
  if (typeof window === 'undefined') return '';
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function WhatsMarketPage() {
  const router = useRouter();
  const payload = useMemo(() => decodePayload(router.query.payload), [router.query.payload]);
  const intent = useMemo(() => resolveWhatsMarketIntent(payload.question || payload.query || ''), [payload.question, payload.query]);

  const topicHref = (provisionType) => {
    const crossCut = {
      provision_type: provisionType,
      provision_subtype: null,
      deal_ids: Array.isArray(payload.deal_ids) ? payload.deal_ids : [],
      columns: [],
      sort_by: 'deal_signing_date_desc',
      market_question: payload.question || 'What’s market?',
      ...(payload.deal_filter ? { deal_filter: payload.deal_filter } : {}),
    };
    return `/query/provision-cross-cut/adhoc?payload=${encodePayload(crossCut)}`;
  };

  return (
    <div className="mtx min-h-screen bg-[#FAFAF8] text-[#1F1F1F]">
      <Head><title>{intent.title || 'What’s market?'} · Mergertrace</title></Head>
      <MergertraceStyles />
      <header className="border-b border-[#E0E0E0] bg-white px-5 py-4 lg:px-9">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4">
          <div>
            <div className="mtx-meta-label text-[9px] tracking-[0.14em]">CORPUS MARKET OVERVIEW</div>
            <h1 className="mt-1 text-xl font-bold tracking-tight">{intent.title || 'What’s market?'}</h1>
          </div>
          <Link href="/" className="text-[10px] font-bold uppercase tracking-[0.1em] hover:underline">← Back to deals</Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-5 py-8 lg:px-9">
        <section className="border border-[#E0E0E0] bg-white p-5">
          <h2 className="text-base font-bold">Full M&amp;A market summary</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6B6B6B]">
            Choose a provision family to open the full cross-deal treatment table. Each result uses the same structured corpus and row-level market definitions as Compare to Market.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {TOPICS.map(([type, title, description]) => (
              <Link key={type} href={topicHref(type)} className="block border border-[#E0E0E0] bg-white p-4 hover:border-[#1F1F1F] hover:bg-[#F6F6F6]">
                <div className="text-sm font-semibold">{title}</div>
                <div className="mt-1 text-[11px] leading-5 text-[#6B6B6B]">{description}</div>
                <div className="mt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-[#2F6DB5]">Open market treatments →</div>
              </Link>
            ))}
          </div>
        </section>

        {payload.question ? (
          <section className="mt-5 border border-[#E0E0E0] bg-white p-5">
            <div className="mtx-meta-label text-[9px] tracking-[0.14em]">YOUR QUESTION</div>
            <p className="mt-2 text-sm">{payload.question}</p>
            <p className="mt-2 text-[11px] leading-5 text-[#6B6B6B]">
              The question did not resolve to a single registered provision or feature. Use the closest family above; the resulting page exposes all treatments and underlying deals for further narrowing.
            </p>
          </section>
        ) : null}
      </main>
    </div>
  );
}

WhatsMarketPage.noLayout = true;
