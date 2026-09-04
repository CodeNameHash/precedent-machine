// The task register defaults to the work that is not finished (status filter
// 'remaining' = anything but done), on Ben's instruction 2026-09-04; 'All
// statuses' restores the full 33. Each task shows its plain-English line
// above its technical scope, in both the detail panel and the register.
//
// Serves everywhere -- local, Vercel preview, Vercel production. It was
// local-only until 2026-09-04, when Ben ruled it may serve on previews and
// production (DECISIONS.md #27); the localOnlyGate(env) that enforced that
// is gone from lib/programme/derive.js along with its test. Access control
// is middleware.js, which gates every page and every /api/** route on a
// session cookie -- this page is no more reachable unauthenticated than any
// other admin route.
//
// This page explains Precedent Machine's own development programme --
// tasks, dependencies, gates, milestones and authority requirements -- all
// derived from lib/programme/roadmap.js (data, with source citations) and
// lib/programme/derive.js (pure graph functions). It never reads or writes
// anything in this repository beyond those two modules: no filesystem
// write, no database, no network call. Proposed edits to a task's scope or
// timing live in component state plus localStorage and export as a JSON
// file for Git review; nothing here mutates docs/core/PLAN.md or any other
// governed document.

import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';

import styles from './programme.module.css';

export async function getServerSideProps() {
  const {
    BASE_COMMIT, AS_OF, TASKS, MILESTONES, GATES, LATER_FEATURES, CONTROLS, OPEN_BEN_RULINGS,
  } = require('../../lib/programme/roadmap');
  const {
    topologicalOrder, levels, parallelSets, currentPosition, nextExecutable, blockedBy, criticalPath,
  } = require('../../lib/programme/derive');

  const order = topologicalOrder(TASKS);
  const levelMap = Object.fromEntries(levels(TASKS));
  const blocked = Object.fromEntries(TASKS.map((t) => [t.id, blockedBy(t.id, TASKS)]));

  return {
    props: {
      baseCommit: BASE_COMMIT,
      asOf: AS_OF,
      tasks: TASKS,
      milestones: MILESTONES,
      gates: GATES,
      laterFeatures: LATER_FEATURES,
      controls: CONTROLS,
      openBenRulings: OPEN_BEN_RULINGS,
      order,
      levelMap,
      parallel: parallelSets(TASKS),
      current: currentPosition(TASKS),
      next: nextExecutable(TASKS),
      blocked,
      criticalPathResult: criticalPath(TASKS),
    },
  };
}

const STATUS_LABEL = {
  remaining: 'In progress & to come',
  done: 'Done',
  in_progress: 'In progress',
  blocked: 'Blocked',
  not_started: 'Not started',
};

const OWNER_LABEL = {
  lead: 'Lead',
  ext: 'External agent',
  ben: 'Ben',
  ci: 'CI',
};

const GROUP_LABEL = {
  foundation: 'Foundation (M0-M4)',
  'm7-v1': 'M7 (V1, superseded)',
  'm7-v2-repair': 'M7 V2 repair',
  certification: 'M9 / M10',
  'product-stage': 'Product Stage',
  package: 'Deal Terms package',
};

const COL_WIDTH = 210;
const ROW_HEIGHT = 78;
const NODE_W = 178;
const NODE_H = 56;
const MARGIN = 24;

const LOCAL_STORAGE_KEY = 'precedent-machine-programme-proposals-v1';

function readStoredProposals() {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeStoredProposals(proposals) {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(proposals));
  } catch (err) {
    // Best effort only; a blocked or full store means proposals live only
    // for this render, which is still safe (nothing here is authoritative).
  }
}

function taskById(tasks) {
  const m = new Map();
  for (const t of tasks) m.set(t.id, t);
  return m;
}

function daysLabel(task) {
  const e = task.estimate;
  if (e.basis) {
    return e.minDays === e.maxDays ? `${e.minDays}d` : `${e.minDays}-${e.maxDays}d`;
  }
  return 'unknown';
}

function FlowDiagram({ tasks, levelMap, current, next, selectedId, onSelect }) {
  const ids = useMemo(() => taskById(tasks), [tasks]);
  const byLevel = useMemo(() => {
    const m = new Map();
    for (const t of tasks) {
      const lvl = levelMap[t.id];
      if (!m.has(lvl)) m.set(lvl, []);
      m.get(lvl).push(t);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.id.localeCompare(b.id));
    return m;
  }, [tasks, levelMap]);

  const maxLevel = Math.max(...Object.values(levelMap));
  const maxRows = Math.max(...[...byLevel.values()].map((arr) => arr.length));
  const width = MARGIN * 2 + (maxLevel + 1) * COL_WIDTH;
  const height = MARGIN * 2 + Math.max(maxRows, 1) * ROW_HEIGHT;

  const posOf = (id) => {
    const lvl = levelMap[id];
    const arr = byLevel.get(lvl);
    const rowIdx = arr.findIndex((t) => t.id === id);
    const rowsInLevel = arr.length;
    const yOffset = (Math.max(maxRows, 1) - rowsInLevel) * (ROW_HEIGHT / 2);
    return {
      x: MARGIN + lvl * COL_WIDTH,
      y: MARGIN + yOffset + rowIdx * ROW_HEIGHT,
    };
  };

  const nextSet = new Set(next);
  const currentSet = new Set(current);

  const edges = [];
  for (const t of tasks) {
    for (const depId of t.dependsOn) {
      edges.push([depId, t.id]);
    }
  }

  const statusClass = (t) => {
    if (currentSet.has(t.id)) return styles.nodeCurrent;
    if (t.status === 'done') return styles.nodeDone;
    if (nextSet.has(t.id)) return styles.nodeNext;
    return styles.nodeFuture;
  };

  return (
    <div className={styles.flowScroll}>
      <svg width={width} height={height} className={styles.flowSvg} role="img" aria-label="Programme dependency flow">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#9C988F" />
          </marker>
        </defs>
        {edges.map(([fromId, toId]) => {
          const a = posOf(fromId);
          const b = posOf(toId);
          const x1 = a.x + NODE_W;
          const y1 = a.y + NODE_H / 2;
          const x2 = b.x;
          const y2 = b.y + NODE_H / 2;
          const midX = (x1 + x2) / 2;
          const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2 - 6} ${y2}`;
          const dimmed = selectedId && fromId !== selectedId && toId !== selectedId;
          return (
            <path
              key={`${fromId}->${toId}`}
              d={d}
              className={dimmed ? styles.edgeDim : styles.edge}
              markerEnd="url(#arrow)"
            />
          );
        })}
        {tasks.map((t) => {
          const { x, y } = posOf(t.id);
          const selected = selectedId === t.id;
          return (
            <g
              key={t.id}
              transform={`translate(${x},${y})`}
              className={`${styles.node} ${statusClass(t)} ${selected ? styles.nodeSelected : ''}`}
              onClick={() => onSelect(t.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelect(t.id); }}
            >
              <rect width={NODE_W} height={NODE_H} rx="2" />
              <text x="8" y="17" className={styles.nodeOwner}>{OWNER_LABEL[t.owner]}</text>
              <text x={NODE_W - 8} y="17" className={styles.nodeDays} textAnchor="end">{daysLabel(t)}</text>
              <foreignObject x="8" y="22" width={NODE_W - 16} height={NODE_H - 26}>
                <div className={styles.nodeTitle}>{t.title}</div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TaskDetail({ task, tasks, blockedInfo, onPropose }) {
  const ids = useMemo(() => taskById(tasks), [tasks]);
  const [scopeDraft, setScopeDraft] = useState(task.scope);
  const [minDraft, setMinDraft] = useState(task.estimate.minDays ?? '');
  const [maxDraft, setMaxDraft] = useState(task.estimate.maxDays ?? '');
  const [rationale, setRationale] = useState('');

  useEffect(() => {
    setScopeDraft(task.scope);
    setMinDraft(task.estimate.minDays ?? '');
    setMaxDraft(task.estimate.maxDays ?? '');
    setRationale('');
  }, [task.id]);

  const depTasks = task.dependsOn.map((id) => ids.get(id)).filter(Boolean);

  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <span className={`${styles.badge} ${styles[`status_${task.status}`]}`}>{STATUS_LABEL[task.status]}</span>
        <span className={styles.badgeMuted}>{GROUP_LABEL[task.group] || task.group}</span>
        <span className={styles.badgeMuted}>{OWNER_LABEL[task.owner]}{task.externalChannel ? ` · ${task.externalChannel}` : ''}</span>
      </div>
      <h2 className={styles.detailTitle}>{task.title}</h2>
      <p className={styles.plainEnglish}>{task.plainEnglish}</p>
      <p className={styles.detailScopeLabel}>Technical scope</p>
      <p className={styles.detailScope}>{task.scope}</p>

      <dl className={styles.detailGrid}>
        <dt>Depends on</dt>
        <dd>
          {depTasks.length === 0 ? '(none)' : (
            <ul className={styles.plainList}>
              {depTasks.map((d) => <li key={d.id}>{d.title} — {STATUS_LABEL[d.status]}</li>)}
            </ul>
          )}
        </dd>

        <dt>Blocked by</dt>
        <dd>
          {!blockedInfo.blocked ? 'Nothing — ready when its own status moves off not_started.' : (
            <ul className={styles.plainList}>
              {blockedInfo.unmetDependencies.map((id) => <li key={id}>{ids.get(id) ? ids.get(id).title : id}</li>)}
              {blockedInfo.waitsOnBen ? <li>Waits on Ben{task.benQuestions.length ? ` (${task.benQuestions.join(', ')})` : ''}</li> : null}
              {task.blockedReason ? <li>{task.blockedReason}</li> : null}
            </ul>
          )}
        </dd>

        <dt>Estimate</dt>
        <dd>
          {task.estimate.basis
            ? `${daysLabel(task)} working days — ${task.estimate.basis}`
            : `Unknown — ${task.estimate.unknownReason}`}
        </dd>

        <dt>Authority record</dt>
        <dd>{task.authorityRecord || '(none named)'}</dd>

        <dt>Evidence</dt>
        <dd>{task.evidence}</dd>

        <dt>Sources</dt>
        <dd>
          <ul className={styles.plainList}>
            {task.sources.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </dd>
      </dl>

      <form
        className={styles.proposeForm}
        onSubmit={(e) => {
          e.preventDefault();
          if (scopeDraft !== task.scope) {
            onPropose(task.id, 'scope', task.scope, scopeDraft, rationale);
          }
          const minNum = minDraft === '' ? null : Number(minDraft);
          const maxNum = maxDraft === '' ? null : Number(maxDraft);
          if (minNum !== (task.estimate.minDays ?? null)) {
            onPropose(task.id, 'estimate.minDays', task.estimate.minDays ?? null, minNum, rationale);
          }
          if (maxNum !== (task.estimate.maxDays ?? null)) {
            onPropose(task.id, 'estimate.maxDays', task.estimate.maxDays ?? null, maxNum, rationale);
          }
          setRationale('');
        }}
      >
        <div className={styles.proposeHeading}>Propose a scope or timing change</div>
        <label className={styles.proposeLabel}>
          Scope
          <textarea value={scopeDraft} onChange={(e) => setScopeDraft(e.target.value)} rows={3} />
        </label>
        <div className={styles.proposeRow}>
          <label className={styles.proposeLabel}>
            Min days
            <input type="number" min="0" value={minDraft} onChange={(e) => setMinDraft(e.target.value)} />
          </label>
          <label className={styles.proposeLabel}>
            Max days
            <input type="number" min="0" value={maxDraft} onChange={(e) => setMaxDraft(e.target.value)} />
          </label>
        </div>
        <label className={styles.proposeLabel}>
          Rationale
          <input type="text" value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Why does this change?" />
        </label>
        <button type="submit" className={styles.proposeButton}>Add to proposal set</button>
        <p className={styles.proposeNote}>
          This never edits docs/core/PLAN.md or any file in this repository. It stages a change here, in
          your browser, for export as a JSON proposal file below.
        </p>
      </form>
    </div>
  );
}

function AnswersPanel({ tasks, current, next, criticalPathResult, blocked }) {
  const ids = useMemo(() => taskById(tasks), [tasks]);
  const currentTasks = current.map((id) => ids.get(id));
  const nextTasks = next.map((id) => ids.get(id));
  const benWaiting = tasks.filter((t) => t.waitsOnBen && t.status !== 'done');

  const milestoneDistance = (label, targetId) => {
    const target = ids.get(targetId);
    const done = target.status === 'done';
    return { label, targetId, title: target.title, done };
  };
  const distances = [
    milestoneDistance('First real run (Phase 1 exit)', 'repair-phase1-issue-only-run'),
    milestoneDistance('Five-deal gate (M7 V2 seal)', 'work7-verify-signoff'),
    milestoneDistance('Shared 50-deal proof', 'pkg-fifty-deal-proof'),
    milestoneDistance('Production cutover', 'product-stage-9'),
  ];

  return (
    <div className={styles.answers}>
      <div className={styles.answerBlock}>
        <div className={styles.answerLabel}>Current position</div>
        {currentTasks.map((t) => <div key={t.id} className={styles.answerValue}>{t.title}</div>)}
      </div>
      <div className={styles.answerBlock}>
        <div className={styles.answerLabel}>Next executable ({nextTasks.length})</div>
        {nextTasks.map((t) => <div key={t.id} className={styles.answerValue}>{t.title}</div>)}
      </div>
      <div className={styles.answerBlock}>
        <div className={styles.answerLabel}>What's blocking the current task</div>
        {currentTasks.map((t) => {
          const b = blocked[t.id];
          return (
            <div key={t.id} className={styles.answerValue}>
              {b.blocked ? (b.reason || b.unmetDependencies.join(', ') || 'Ben decision session 1 (Q1-Q19)') : 'Nothing upstream — in progress now.'}
            </div>
          );
        })}
      </div>
      <div className={styles.answerBlock}>
        <div className={styles.answerLabel}>Waiting on Ben ({benWaiting.length} tasks)</div>
        <div className={styles.answerValue}>
          {benWaiting.slice(0, 4).map((t) => t.title).join('; ')}{benWaiting.length > 4 ? `; +${benWaiting.length - 4} more` : ''}
        </div>
      </div>
      <div className={styles.answerBlock}>
        <div className={styles.answerLabel}>Known dates end at</div>
        <div className={styles.answerValue}>
          {criticalPathResult.truncatedAt ? ids.get(criticalPathResult.truncatedAt).title : '(fully known)'}
          {' — '}
          {criticalPathResult.knownMinDays}-{criticalPathResult.knownMaxDays} working days from here to that point, then unknown.
        </div>
      </div>
      <div className={styles.answerBlock}>
        <div className={styles.answerLabel}>Distance to the four milestones</div>
        <ul className={styles.plainList}>
          {distances.map((d) => (
            <li key={d.targetId}>{d.label}: {d.done ? 'reached' : `not yet — waiting on "${d.title}"`}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TaskTable({ tasks, selectedId, onSelect, filters, setFilters }) {
  const filtered = tasks.filter((t) => (
    (filters.group === 'all' || t.group === filters.group)
    && (filters.status === 'all'
      || (filters.status === 'remaining' ? t.status !== 'done' : t.status === filters.status))
    && (filters.owner === 'all' || t.owner === filters.owner)
    && (filters.q === '' || t.title.toLowerCase().includes(filters.q.toLowerCase()) || t.id.includes(filters.q.toLowerCase()))
  ));

  const groups = ['all', ...new Set(tasks.map((t) => t.group))];
  const owners = ['all', ...new Set(tasks.map((t) => t.owner))];
  const statuses = ['remaining', 'all', ...new Set(tasks.map((t) => t.status))];

  return (
    <div className={styles.registerWrap}>
      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Search title or id…"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className={styles.filterInput}
        />
        <select value={filters.group} onChange={(e) => setFilters({ ...filters, group: e.target.value })}>
          {groups.map((g) => <option key={g} value={g}>{g === 'all' ? 'All groups' : (GROUP_LABEL[g] || g)}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          {statuses.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : STATUS_LABEL[s]}</option>)}
        </select>
        <select value={filters.owner} onChange={(e) => setFilters({ ...filters, owner: e.target.value })}>
          {owners.map((o) => <option key={o} value={o}>{o === 'all' ? 'All owners' : OWNER_LABEL[o]}</option>)}
        </select>
        <span className={styles.filterCount}>{filtered.length} / {tasks.length}</span>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Task</th>
              <th>Group</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Estimate</th>
              <th>Depends on</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className={t.id === selectedId ? styles.rowSelected : undefined}
                onClick={() => onSelect(t.id)}
              >
                <td className={styles.titleCell}>
                  <span className={styles.rowTitle}>{t.title}</span>
                  <span className={styles.rowPlain}>{t.plainEnglish}</span>
                </td>
                <td>{GROUP_LABEL[t.group] || t.group}</td>
                <td>{OWNER_LABEL[t.owner]}</td>
                <td><span className={`${styles.badge} ${styles[`status_${t.status}`]}`}>{STATUS_LABEL[t.status]}</span></td>
                <td>{daysLabel(t)}</td>
                <td>{t.dependsOn.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MilestonesPanel({ milestones, tasks }) {
  const ids = useMemo(() => taskById(tasks), [tasks]);
  return (
    <div className={styles.milestones}>
      {milestones.map((m) => (
        <div key={m.id} className={styles.milestoneCard}>
          <div className={styles.milestoneTitle}>{m.title}</div>
          <div className={styles.milestoneMeta}>
            <span className={styles.badgeMuted}>{m.releaseState}</span>
            <span className={styles.badgeMuted}>{m.userFacing === true ? 'user-facing' : m.userFacing === 'internal' ? 'internal display' : 'not user-facing'}</span>
            <span className={`${styles.badge} ${styles[`status_${m.status}`]}`}>{STATUS_LABEL[m.status]}</span>
          </div>
          <p className={styles.milestoneScope}>{m.scope}</p>
          <div className={styles.milestoneMeta}>
            Public only after: {ids.get(m.publicRequires) ? ids.get(m.publicRequires).title : m.publicRequires}
          </div>
        </div>
      ))}
    </div>
  );
}

function GatesAndControls({ gates, controls }) {
  return (
    <div className={styles.twoCol}>
      <div>
        <h3 className={styles.sectionSubhead}>Gates</h3>
        <ul className={styles.plainList}>
          {gates.map((g) => (
            <li key={g.id} className={styles.gateItem}>
              <strong>{g.name}</strong> <span className={styles.badgeMuted}>{g.kind}</span>
              <div className={styles.gateDesc}>{g.description}</div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className={styles.sectionSubhead}>Standing controls (through M9)</h3>
        <ul className={styles.plainList}>
          {controls.map((c) => (
            <li key={c.id}><strong>{c.label}:</strong> {c.state}{c.note ? ` — ${c.note}` : ''}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LaterFeaturesAndRulings({ laterFeatures, openBenRulings }) {
  return (
    <div className={styles.twoCol}>
      <div>
        <h3 className={styles.sectionSubhead}>Later features &amp; document-analysis branches</h3>
        <p className={styles.sectionNote}>Not scheduled. Registered for later attention.</p>
        <ul className={styles.plainList}>
          {laterFeatures.map((f) => (
            <li key={f.id} className={styles.gateItem}>
              <strong>{f.title}</strong>
              <div className={styles.gateDesc}>{f.description}</div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className={styles.sectionSubhead}>Open Ben rulings</h3>
        <ul className={styles.plainList}>
          {openBenRulings.map((r) => <li key={r.id}>{r.text}</li>)}
        </ul>
      </div>
    </div>
  );
}

function ProposalsPanel({ proposals, onRemove, onExport, onClear, baseCommit }) {
  return (
    <div className={styles.proposals}>
      <div className={styles.proposalsHeader}>
        <h3 className={styles.sectionSubhead}>Proposal set ({proposals.length})</h3>
        <div>
          <button type="button" className={styles.proposeButton} onClick={onExport} disabled={proposals.length === 0}>
            Export JSON
          </button>
          <button type="button" className={styles.clearButton} onClick={onClear} disabled={proposals.length === 0}>
            Clear
          </button>
        </div>
      </div>
      {proposals.length === 0 ? (
        <p className={styles.sectionNote}>No proposed changes yet. Open a task and use the form to propose a scope or timing edit.</p>
      ) : (
        <ul className={styles.plainList}>
          {proposals.map((p) => (
            <li key={p.id} className={styles.proposalItem}>
              <div><strong>{p.task_id}</strong> · {p.field}: <code>{String(p.from)}</code> → <code>{String(p.to)}</code></div>
              {p.rationale ? <div className={styles.proposalRationale}>{p.rationale}</div> : null}
              <button type="button" className={styles.removeButton} onClick={() => onRemove(p.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.sectionNote}>base_commit for export: <code>{baseCommit.slice(0, 12)}</code>. Nothing here has touched any file in this repository.</p>
    </div>
  );
}

export default function ProgrammePage(props) {
  const {
    baseCommit, asOf, tasks, milestones, gates, laterFeatures, controls, openBenRulings,
    levelMap, parallel, current, next, blocked, criticalPathResult,
  } = props;

  const [selectedId, setSelectedId] = useState(current[0] || tasks[0].id);
  const [filters, setFilters] = useState({ group: 'all', status: 'remaining', owner: 'all', q: '' });
  const [proposals, setProposals] = useState([]);
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);

  useEffect(() => {
    setProposals(readStoredProposals());
    setLoadedFromStorage(true);
  }, []);

  useEffect(() => {
    if (loadedFromStorage) writeStoredProposals(proposals);
  }, [proposals, loadedFromStorage]);

  const ids = useMemo(() => taskById(tasks), [tasks]);
  const selectedTask = ids.get(selectedId) || tasks[0];

  function addProposal(taskId, field, from, to, rationale) {
    setProposals((prev) => [...prev, {
      id: `${taskId}:${field}:${Date.now()}`,
      task_id: taskId,
      field,
      from,
      to,
      rationale: rationale || '',
    }]);
  }

  function removeProposal(id) {
    setProposals((prev) => prev.filter((p) => p.id !== id));
  }

  function exportProposals() {
    const payload = {
      schema_version: 'PRECEDENT_MACHINE_PROGRAMME_PROPOSAL/V1',
      base_commit: baseCommit,
      generated_at: new Date().toISOString(),
      proposals: proposals.map(({ id, ...rest }) => rest),
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `programme-proposal-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      // Export is a convenience; failing silently here still leaves the
      // proposal set intact in state and localStorage.
    }
  }

  const multiLevelSets = parallel.filter((p) => p.taskIds.length > 1);

  return (
    <>
      <Head>
        <title>Programme Roadmap</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <div className={styles.kicker}>Precedent Machine · local only</div>
            <h1 className={styles.h1}>Programme roadmap</h1>
          </div>
          <div className={styles.headerMeta}>
            <div>As of {asOf}</div>
            <div>Base commit <code>{baseCommit.slice(0, 12)}</code></div>
            <div>{tasks.length} tasks · {gates.length} gates · {milestones.length} package milestones</div>
          </div>
        </header>

        <AnswersPanel tasks={tasks} current={current} next={next} criticalPathResult={criticalPathResult} blocked={blocked} />

        <section className={styles.section}>
          <h2 className={styles.sectionHead}>Dependency &amp; programme-flow view</h2>
          <p className={styles.sectionNote}>
            Left to right by dependency depth. Blue = current position, green outline = next executable now,
            grey fill = done, white = future. {multiLevelSets.length} points in the graph have more than one
            task at the same depth — those are where work can genuinely run in parallel today or later.
          </p>
          <FlowDiagram tasks={tasks} levelMap={levelMap} current={current} next={next} selectedId={selectedId} onSelect={setSelectedId} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHead}>Task register</h2>
          <div className={styles.registerLayout}>
            <TaskTable tasks={tasks} selectedId={selectedId} onSelect={setSelectedId} filters={filters} setFilters={setFilters} />
            <TaskDetail task={selectedTask} tasks={tasks} blockedInfo={blocked[selectedTask.id]} onPropose={addProposal} />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHead}>Package milestones</h2>
          <MilestonesPanel milestones={milestones} tasks={tasks} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHead}>Gates &amp; standing controls</h2>
          <GatesAndControls gates={gates} controls={controls} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHead}>Later features &amp; open rulings</h2>
          <LaterFeaturesAndRulings laterFeatures={laterFeatures} openBenRulings={openBenRulings} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHead}>Proposals</h2>
          <ProposalsPanel proposals={proposals} onRemove={removeProposal} onExport={exportProposals} onClear={() => setProposals([])} baseCommit={baseCommit} />
        </section>
      </main>
    </>
  );
}

ProgrammePage.noLayout = true;
