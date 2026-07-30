import Head from 'next/head';
import { useState } from 'react';
import MergertraceStyles from '../../../components/review-v2/MergertraceStyles';
import ProcessResearchSurface from '../../../components/process/ProcessResearchSurface';

const { isCanonicalV2ProcessPilotUiEnabled } = require('../../../lib/canonical-v2/feature-flags');
const {
  applyProcessResearchPilotContextAction,
  exactPassageCopyText,
  fixtureShareHref,
  getProcessResearchPilotFixture,
  openProcessResearchPilotReader,
  openProcessResearchPilotRelatedPassage,
  resolveProcessResearchPilotShare,
} = require('../../../__fixtures__/canonical-v2/process-research-pilot');

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
  const [shareLink, setShareLink] = useState(null);
  const [openedShare, setOpenedShare] = useState(null);
  const useFixtureAction = () => setNotice('This is a synthetic preview fixture. Actions do not change data.');
  const openFixtureSource = (action) => {
    const selectedReader = fixture.source_readers.find(
      (candidate) => candidate.product_query_result_identity === action.product_query_result_identity,
    );
    setReader(selectedReader ? openProcessResearchPilotReader(selectedReader) : null);
  };
  const copyExactPassage = async (action) => {
    const copyText = exactPassageCopyText(action);
    if (!copyText || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setNotice('Copy failed. Clipboard access is unavailable.');
      return;
    }
    try {
      await navigator.clipboard.writeText(copyText);
      setNotice('Exact passage and citation copied.');
    } catch (error) {
      setNotice('Copy failed. Clipboard access was denied.');
    }
  };
  const shareExactResult = (action) => {
    const outcome = resolveProcessResearchPilotShare(fixture, action?.share_reference);
    if (outcome.outcome !== 'OPENED') {
      setShareLink(null);
      setNotice(outcome.outcome === 'RELEASE_NOT_ACTIVE' ? 'RELEASE_NOT_ACTIVE' : 'Share link is unavailable.');
      return;
    }
    setShareLink({ reference: action.share_reference, href: fixtureShareHref(action.share_reference) });
    setNotice('Share link prepared for this exact synthetic result and release.');
  };
  const openSharedResult = (event) => {
    event.preventDefault();
    const outcome = resolveProcessResearchPilotShare(fixture, shareLink?.reference);
    if (outcome.outcome !== 'OPENED') {
      setNotice(outcome.outcome === 'RELEASE_NOT_ACTIVE' ? 'RELEASE_NOT_ACTIVE' : 'Share link is unavailable.');
      return;
    }
    setOpenedShare(outcome);
    setNotice(`Opened shared result ${outcome.product_query_result_identity} at the exact synthetic release.`);
  };
  const applyReaderContextAction = (action) => {
    const outcome = applyProcessResearchPilotContextAction(reader, action);
    if (outcome.outcome === 'CONTEXT_EXPANDED') setReader(outcome.reader);
    setNotice(outcome.outcome === 'INVALID_CONTEXT_ACTION' ? 'Context action is unavailable.' : outcome.outcome === 'CONTEXT_LIMIT_REACHED' ? 'Context limit reached.' : 'One admitted context paragraph added.');
  };
  const openRelatedPassage = (passage) => {
    setReader(openProcessResearchPilotRelatedPassage(passage));
    setNotice('Opened exact related drafting in the source reader.');
  };

  return (
    <>
      <Head><title>Process research preview · Corpus</title></Head>
      <MergertraceStyles />
      <div className="mtx min-h-screen bg-bg">
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <p className="border border-border bg-bg px-3 py-2 text-xs font-semibold tracking-wide text-ink">SYNTHETIC FIXTURE · PREVIEW ONLY · NOT CORPUS DATA</p>
          {notice ? <p role="status" aria-live="polite" className="mt-3 text-sm text-inkLight">{notice}</p> : null}
          {shareLink ? <p className="mt-3 text-sm text-ink"><a href={shareLink.href} onClick={openSharedResult} className="underline">Open exact shared result</a></p> : null}
          {openedShare ? <article aria-label="Opened shared result" className="mt-3 rounded border border-border bg-white p-3"><blockquote className="whitespace-pre-wrap text-sm text-ink">{openedShare.result_slot.exact_content}</blockquote><p className="mt-2 text-xs text-inkLight">{openedShare.result_slot.exact_citation.human_readable_source_label}</p></article> : null}
        </div>
        <ProcessResearchSurface
          presentation={fixture.presentation}
          navigation={fixture.navigation}
          filterFields={fixture.filter_fields}
          admittedOptionsProjection={fixture.admitted_options_projection}
          relatedPassages={fixture.related_passages}
          sourceReader={reader}
          onAsk={useFixtureAction}
          onBrowse={useFixtureAction}
          onEditSubject={useFixtureAction}
          onOpenSource={openFixtureSource}
          onOpenDetail={useFixtureAction}
          onCopyExactPassage={copyExactPassage}
          onShare={shareExactResult}
          onSelectForExport={useFixtureAction}
          onSave={useFixtureAction}
          onRerun={useFixtureAction}
          onCloseReader={() => setReader(null)}
          onReaderContextAction={applyReaderContextAction}
          onOpenRelated={openRelatedPassage}
        />
      </div>
    </>
  );
}
