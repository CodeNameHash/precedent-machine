import Head from 'next/head';
import MergertraceStyles from '../../components/review-v2/MergertraceStyles';
import MetseraExclusivityCrossView from '../../components/process/MetseraExclusivityCrossView';
import { designPreviewServerSideProps } from '../../lib/design/route-guard';

export async function getServerSideProps() {
  const guard = designPreviewServerSideProps();
  if (guard.notFound) return guard;
  const fixture = require(
    '../../__fixtures__/canonical-v2/metsera-exclusivity-p8.json',
  );
  return { props: { fixture } };
}

export default function CanonicalV2MetseraExclusivityP8({ fixture }) {
  return (
    <>
      <Head><title>Metsera exclusivity P8 acceptance</title></Head>
      <MergertraceStyles />
      <main
        className="min-h-screen overflow-x-hidden bg-[#F2F0EA] px-4 py-6 sm:px-6 sm:py-8"
        style={{ fontFamily: 'var(--mtx-sans)' }}
      >
        <div className="mx-auto max-w-[1360px]">
          <header className="border-b-2 border-[#1F1F1F] pb-4">
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#77736C]">
              P8 staging-only browser acceptance
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-[#1F1F1F]">
              Metsera exclusivity cross-view result
            </h1>
            <p className="mt-2 max-w-3xl text-[10px] leading-4 text-[#66625C]">
              Real sealed SEC evidence. Inactive candidate. No production authority.
            </p>
          </header>
          <MetseraExclusivityCrossView fixture={fixture} />
        </div>
      </main>
    </>
  );
}

CanonicalV2MetseraExclusivityP8.noLayout = true;
