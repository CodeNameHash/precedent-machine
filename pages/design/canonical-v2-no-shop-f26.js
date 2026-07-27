import Head from 'next/head';
import MergertraceStyles from '../../components/review-v2/MergertraceStyles';
import NoShopCrossViewPreview from '../../components/review-v2/NoShopCrossViewPreview';
import { designPreviewServerSideProps } from '../../lib/design/route-guard';

export async function getServerSideProps() {
  const guard = designPreviewServerSideProps();
  if (guard.notFound) return guard;
  const preview = require(
    '../../__fixtures__/canonical-v2/qxo-no-shop-cross-view-f26.json',
  );
  return { props: { preview } };
}

export default function CanonicalV2NoShopF26({ preview }) {
  return (
    <>
      <Head><title>Canonical v2 no-shop F26 acceptance</title></Head>
      <MergertraceStyles />
      <main
        className="min-h-screen overflow-x-hidden bg-[#F2F0EA] px-4 py-6 sm:px-6 sm:py-8"
        style={{ fontFamily: 'var(--mtx-sans)' }}
      >
        <div className="mx-auto max-w-[1360px]">
          <header className="border-b-2 border-[#1F1F1F] pb-4">
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#77736C]">
              Staging-only browser acceptance
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-[#1F1F1F]">
              QXO no-shop cross-view result
            </h1>
            <p className="mt-2 max-w-3xl text-[10px] leading-4 text-[#66625C]">
              Exact F23-F25 certifications assembled through the F26 central admission gate. The release is inactive and has no production authority.
            </p>
          </header>
          <NoShopCrossViewPreview preview={preview} />
          <footer className="mt-4 flex flex-wrap justify-between gap-2 border-t border-[#D9D7D2] pt-3 text-[8px] text-[#77736C]">
            <span>{preview.surfaces.join(' · ')}</span>
            <span className="font-mono">{preview.release_id.slice(0, 16)}…</span>
          </footer>
        </div>
      </main>
    </>
  );
}

CanonicalV2NoShopF26.noLayout = true;
