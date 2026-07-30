import Head from 'next/head';
import { useState } from 'react';
import MergertraceStyles from '../../../components/review-v2/MergertraceStyles';
import ProcessResearchSurface from '../../../components/process/ProcessResearchSurface';

const { isCanonicalV2ProcessPilotUiEnabled } = require('../../../lib/canonical-v2/feature-flags');
const { getProcessResearchPilotFixture } = require('../../../__fixtures__/canonical-v2/process-research-pilot');

export function getServerSideProps() {
  if (!isCanonicalV2ProcessPilotUiEnabled()) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }
  return { props: { fixture: getProcessResearchPilotFixture() } };
}

export default function ProcessResearchPilotPage({ fixture }) {
  const [reader, setReader] = useState(null);
  const [notice, setNotice] = useState(null);
  const useFixtureAction = () => setNotice('This is a synthetic preview fixture. Actions do not change data.');
  const openFixtureSource = (action) => {
    const selectedReader = fixture.source_readers.find(
      (candidate) => candidate.product_query_result_identity === action.product_query_result_identity,
    );
    setReader(selectedReader || null);
  };

  return (
    <>
      <Head><title>Process research preview · Corpus</title></Head>
      <MergertraceStyles />
      <div className="mtx min-h-screen bg-bg">
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <p className="border border-border bg-bg px-3 py-2 text-xs font-semibold tracking-wide text-ink">SYNTHETIC FIXTURE · PREVIEW ONLY · NOT CORPUS DATA</p>
          {notice ? <p role="status" className="mt-3 text-sm text-inkLight">{notice}</p> : null}
        </div>
        <ProcessResearchSurface
          presentation={fixture.presentation}
          navigation={fixture.navigation}
          filterFields={fixture.filter_fields}
          relatedPassages={fixture.related_passages}
          sourceReader={reader}
          onAsk={useFixtureAction}
          onBrowse={useFixtureAction}
          onEditSubject={useFixtureAction}
          onEditFilter={useFixtureAction}
          onClearFilter={useFixtureAction}
          onOpenSource={openFixtureSource}
          onOpenDetail={useFixtureAction}
          onCopyExactPassage={useFixtureAction}
          onShare={useFixtureAction}
          onSelectForExport={useFixtureAction}
          onSave={useFixtureAction}
          onRerun={useFixtureAction}
          onCorrection={useFixtureAction}
          onCloseReader={() => setReader(null)}
          onReaderContextAction={useFixtureAction}
          onOpenRelated={useFixtureAction}
        />
      </div>
    </>
  );
}
