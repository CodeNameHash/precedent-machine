import { useState } from 'react';

export const REPO_URL = 'https://github.com/CodeNameHash/precedent-machine';

function repoHref(file) {
  const kind = file.type === 'dir' ? 'tree' : 'blob';
  return `${REPO_URL}/${kind}/main/${file.path}`;
}

function FileLink({ file, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(file)}
      className="rounded border border-border bg-bg px-2 py-1 font-mono text-xs text-inkLight hover:border-accent hover:text-ink"
    >
      {file.path}
    </button>
  );
}

function RepoBrowserModal({ file, onClose }) {
  if (!file) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="processing-flow-file-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-w-lg rounded border border-border bg-white p-5 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="font-display text-sm text-ink">{file.path}</h3>
        <p className="mt-2 text-xs text-inkLight">
          Owning file for this stage. Opens in the repo browser.
        </p>
        <a
          href={repoHref(file)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded border border-accent bg-white px-3 py-1.5 text-xs text-accent hover:bg-accent hover:text-white"
        >
          View in repo browser
        </a>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 ml-2 rounded border border-border bg-white px-3 py-1.5 text-xs text-inkLight hover:border-accent hover:text-ink"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function StageCard({ stage }) {
  const [openFile, setOpenFile] = useState(null);
  const metrics = stage.metrics || {};

  return (
    <div className="space-y-3 rounded border border-border bg-white p-4" data-testid={`processing-flow-stage-${stage.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base text-ink">{stage.id}. {stage.name}</h3>
          <p className="mt-1 text-sm leading-6 text-inkLight">{stage.description}</p>
        </div>
      </div>

      <div>
        <h4 className="font-ui text-[11px] uppercase tracking-wide text-inkFaint">Owning files</h4>
        <div className="mt-1 flex flex-wrap gap-2">
          {stage.files.map((file) => (
            <FileLink key={file.path} file={file} onOpen={setOpenFile} />
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-ui text-[11px] uppercase tracking-wide text-inkFaint">Taxonomy nodes emitted / consumed</h4>
        <p className="mt-1 text-xs leading-5 text-inkLight">{stage.taxonomyNodes}</p>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <h4 className="font-ui text-[11px] uppercase tracking-wide text-inkFaint">Last-run metrics</h4>
          <span className="rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] uppercase text-inkFaint" title="Static placeholder — no metrics pipeline is wired up yet">
            stub
          </span>
        </div>
        <dl className="mt-1 grid grid-cols-3 gap-2 text-xs text-inkLight">
          <div>
            <dt className="text-inkFaint">Median duration</dt>
            <dd>{metrics.medianDurationMs ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-inkFaint">Failures (24h)</dt>
            <dd>{metrics.failuresLast24h ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-inkFaint">Quarantine count</dt>
            <dd>{metrics.quarantineCount ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <RepoBrowserModal file={openFile} onClose={() => setOpenFile(null)} />
    </div>
  );
}
