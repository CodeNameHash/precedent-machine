import { useState } from 'react';
import ProcessAsk from './ProcessAsk';
import ProcessBrowse from './ProcessBrowse';
import ProcessCoverageState from './ProcessCoverageState';
import ProcessFilterEditor from './ProcessFilterEditor';
import ProcessFilterSentence from './ProcessFilterSentence';
import ProcessPassageList from './ProcessPassageList';
import ProcessRelatedPassages from './ProcessRelatedPassages';
import ProcessResultsTable from './ProcessResultsTable';
import ProcessSourceReader from './ProcessSourceReader';
import { editorSelection, PASSAGE_VIEW, TABLE_VIEW } from './processResearchView';

export default function ProcessResearchSurface({ presentation, navigation, filterFields, relatedPassages, sourceReader, onAsk, onBrowse, onEditSubject, onEditFilter, onClearFilter, onOpenSource, onOpenDetail, onCopyExactPassage, onShare, onSelectForExport, onSave, onRerun, onCorrection, onCloseReader, onReaderContextAction, onOpenRelated }) {
  const [mode, setMode] = useState('ASK');
  const [view, setView] = useState(PASSAGE_VIEW);
  const [editing, setEditing] = useState(false);
  const [editingSegment, setEditingSegment] = useState(null);
  const sentence = presentation?.filter_sentence;
  const permittedViews = presentation?.view_contract?.permitted_views || [PASSAGE_VIEW];
  const results = view === TABLE_VIEW
    ? <ProcessResultsTable presentation={presentation} onOpenSource={onOpenSource} />
    : <ProcessPassageList presentation={presentation} onOpenSource={onOpenSource} onOpenDetail={onOpenDetail} onCopyExactPassage={onCopyExactPassage} onShare={onShare} onSelectForExport={onSelectForExport} onCorrection={onCorrection} />;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4 text-ink">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-inkLight">Process research</p>
        <h1 className="mt-1 text-2xl font-semibold">{presentation?.understood_legal_question?.label || 'Process research'}</h1>
      </header>
      <div className="flex gap-2 border-b border-border" role="tablist" aria-label="Process research mode">
        <button type="button" role="tab" aria-selected={mode === 'ASK'} onClick={() => setMode('ASK')} className={`px-3 py-2 text-sm ${mode === 'ASK' ? 'border-b-2 border-ink font-medium' : 'text-inkLight'}`}>Ask</button>
        <button type="button" role="tab" aria-selected={mode === 'BROWSE'} onClick={() => setMode('BROWSE')} className={`px-3 py-2 text-sm ${mode === 'BROWSE' ? 'border-b-2 border-ink font-medium' : 'text-inkLight'}`}>Browse</button>
      </div>
      {mode === 'ASK' ? <ProcessAsk onAsk={onAsk} /> : <ProcessBrowse navigation={navigation} selectedPattern={navigation?.selected_pattern_key} onSelectPattern={onBrowse} />}
      {sentence ? (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1"><ProcessFilterSentence sentence={sentence} onEditSubject={onEditSubject} onEditSegment={(segment) => { setEditingSegment(segment); setEditing(true); onEditFilter?.(segment); }} onClearSegment={onClearFilter} /></div>
          <button type="button" onClick={() => { setEditingSegment(null); setEditing(true); }} aria-label="Add or edit filters" className="rounded border border-border px-3 py-2 text-sm">Filters</button>
        </div>
      ) : null}
      {editing ? <ProcessFilterEditor fields={filterFields} selected={editorSelection(editingSegment)} onApply={(filter) => { onEditFilter?.(filter); setEditing(false); }} onClose={() => setEditing(false)} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProcessCoverageState coverage={presentation?.coverage} counts={presentation?.counts} emptyResult={presentation?.empty_result} />
        <div className="flex flex-wrap gap-3" aria-label="Research controls">
          {permittedViews.length > 1 ? <><button type="button" aria-pressed={view === PASSAGE_VIEW} onClick={() => setView(PASSAGE_VIEW)} className="text-sm underline">Passages</button><button type="button" aria-pressed={view === TABLE_VIEW} onClick={() => setView(TABLE_VIEW)} className="text-sm underline">Table</button></> : null}
          {onSave ? <button type="button" onClick={() => onSave(presentation)} className="text-sm underline">Save</button> : null}
          {onRerun ? <button type="button" onClick={() => onRerun(presentation)} className="text-sm underline">Rerun</button> : null}
        </div>
      </div>
      <div className={sourceReader ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)] lg:items-start lg:gap-4' : ''}>
        <div className="min-w-0 space-y-4">{results}<ProcessRelatedPassages passages={relatedPassages} onOpen={onOpenRelated} /></div>
        {sourceReader ? <ProcessSourceReader reader={sourceReader} desktopPane onClose={onCloseReader} onContextAction={onReaderContextAction} /> : null}
      </div>
    </main>
  );
}
