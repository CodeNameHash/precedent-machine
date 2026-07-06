import { useMemo, useState } from 'react';
import FlagBadge from './FlagBadge';

function decisionTone(decision) {
  if (!decision) return 'PENDING_REVIEW';
  if (decision === 'approve') return 'APPROVED';
  if (decision === 'reject') return 'REJECTED';
  if (decision === 'merge') return 'MERGED';
  if (decision === 'rename') return 'RENAMED';
  if (decision === 'defer') return 'DEFERRED';
  return 'PENDING_REVIEW';
}

function suggestedTarget(field) {
  if (field.proposed_canonical_key) return field.proposed_canonical_key;
  const match = String(field.proposed_action || '').match(/^merge into (.+)$/);
  return match ? match[1] : null;
}

function shortLabel(field) {
  return field.label || field.description || field.main_concept || '-';
}

const ACRONYMS = new Set([
  'anti',
  'arc',
  'cfius',
  'cond',
  'cov',
  'cvr',
  'def',
  'dgcl',
  'ec',
  'erisa',
  'espp',
  'fda',
  'fdi',
  'gaap',
  'hsr',
  'ioc',
  'ip',
  'mae',
  'misc',
  'nosol',
  'rep',
  'rsa',
  'rsu',
  'sec',
  'struct',
  'termf',
  'termr',
  'uk',
]);

const GROUP_RULES = [
  [/discussionInitiationNotice/i, 'Discussion Initiation Notice'],
  [/fiduciary|engage|engagement|boardChange|changeRec|superiorProposal|interveningEvent/i, 'Fiduciary Out'],
  [/goShop|excludedParties/i, 'Go-Shop'],
  [/match|noticePeriod|materialImprovement/i, 'Matching Rights'],
  [/standstill|dontAsk/i, 'Standstill'],
  [/information|noticeContent|bidderIdentity|financingPapers|communicationsDrafts/i, 'Notice And Information'],
  [/representative|ceaseDiscussions/i, 'Representatives'],
  [/acquisitionProposal|acquisitionTransaction/i, 'Acquisition Proposal'],
  [/tenderOffer/i, 'Tender Offer'],
  [/disproportionate|carveout/i, 'MAE Carve-Outs'],
  [/mae|materialAdverse|preventDelay/i, 'MAE'],
  [/divestiture|burden|burdensome|hellOrHighWater|remedy/i, 'Divestiture'],
  [/hsr|filing|regulatory|approval|foreign/i, 'Regulatory Filings'],
  [/litigation|lawsuit/i, 'Regulatory Litigation'],
  [/clearSkies|timingAgreement|pull.*refile/i, 'Regulatory Conduct'],
  [/condition|bringDown|stockholderApproval|frustration|injunction|enjoining/i, 'Closing Conditions'],
  [/perShare|consideration|exchangeRatio|collar|proration|election/i, 'Consideration'],
  [/vesting|equity|instrument|award|option|rsu|psu|espp/i, 'Equity Awards'],
  [/termination|fee|tail|expense|reverseFee|soleRemedy/i, 'Termination Fees'],
];

function splitKey(value) {
  return String(value || '')
    .replace(/^rubric[._-]/i, 'rubric.')
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleWord(word) {
  const lower = word.toLowerCase();
  if (ACRONYMS.has(lower)) return lower.toUpperCase();
  if (/^[A-Z0-9]+$/.test(word) && word.length <= 5) return word;
  return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`;
}

function readableKey(value) {
  const split = splitKey(value);
  if (!split) return '-';
  return split.split(' ').map(titleWord).join(' ');
}

function reviewName(field, decision) {
  if (decision?.decision === 'rename' && decision.rename_to) return readableKey(decision.rename_to);
  return readableKey(field.key);
}

function groupName(field, decision) {
  const hay = [field.key, decision?.rename_to, field.label, field.applies_to, field.provision_type].filter(Boolean).join(' ');
  const rule = GROUP_RULES.find(([pattern]) => pattern.test(hay));
  if (rule) return rule[1];
  const applies = String(field.applies_to || field.provision_type || '').split(',').find(Boolean);
  return applies ? readableKey(applies) : 'Other';
}

function scrollNearViewportEdge(event) {
  const edge = 96;
  const step = 22;
  if (event.clientY < edge) window.scrollBy({ top: -step, behavior: 'auto' });
  if (window.innerHeight - event.clientY < edge) window.scrollBy({ top: step, behavior: 'auto' });
}

function buildRows(fields, decisions) {
  const childrenByTarget = new Map();
  const sortedFields = [...fields].sort((a, b) => {
    const aDecision = decisions[a.key];
    const bDecision = decisions[b.key];
    return groupName(a, aDecision).localeCompare(groupName(b, bDecision))
      || reviewName(a, aDecision).localeCompare(reviewName(b, bDecision))
      || a.key.localeCompare(b.key);
  });
  for (const field of fields) {
    const target = decisions[field.key]?.decision === 'merge' ? decisions[field.key].merge_into : null;
    if (!target) continue;
    if (!childrenByTarget.has(target)) childrenByTarget.set(target, []);
    childrenByTarget.get(target).push(field);
  }

  const childKeys = new Set();
  for (const children of childrenByTarget.values()) {
    for (const child of children) childKeys.add(child.key);
  }

  const rows = [];
  for (const field of sortedFields) {
    if (childKeys.has(field.key)) continue;
    rows.push({ field, depth: 0 });
    const children = [...(childrenByTarget.get(field.key) || [])].sort((a, b) => reviewName(a, decisions[a.key]).localeCompare(reviewName(b, decisions[b.key])));
    for (const child of children) {
      rows.push({ field: child, depth: 1, parentKey: field.key });
    }
  }

  for (const [target, children] of childrenByTarget.entries()) {
    if (fields.some((field) => field.key === target)) continue;
    const virtual = { key: target, label: 'External merge target' };
    rows.push({ field: virtual, depth: 0, virtual: true });
    for (const child of [...children].sort((a, b) => reviewName(a, decisions[a.key]).localeCompare(reviewName(b, decisions[b.key])))) {
      rows.push({ field: child, depth: 1, parentKey: target });
    }
  }

  return rows;
}

export default function RegistryMergeBoard({ fields, decisions, onDecision }) {
  const [draggedKey, setDraggedKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState(null);
  const byKey = useMemo(() => new Map(fields.map((field) => [field.key, field])), [fields]);
  const rows = useMemo(() => buildRows(fields, decisions), [fields, decisions]);

  async function save(payload) {
    setSavingKey(payload.key);
    setError(null);
    try {
      await onDecision(payload);
    } catch (err) {
      setError(err.message || 'Decision save failed');
    } finally {
      setSavingKey(null);
    }
  }

  async function dropOn(targetKey) {
    const sourceKey = draggedKey;
    setDraggedKey(null);
    if (!sourceKey || sourceKey === targetKey) return;
    const source = byKey.get(sourceKey);
    if (!source) return;
    await save({
      key: source.key,
      decision: 'merge',
      merge_into: targetKey,
      rename_to: source.key,
      defer_to_phase: '',
    });
  }

  return (
    <div data-testid="registry-merge-board">
      {error && <div className="mb-3 text-xs font-ui text-seller">{error}</div>}
      <div className="overflow-x-auto rounded border border-border bg-white">
        <div className="grid min-w-[1180px] grid-cols-[minmax(240px,1.15fr)_180px_minmax(280px,1.35fr)_120px_190px_96px] border-b border-border bg-bg/60 px-3 py-2 text-[10px] font-ui uppercase tracking-wide text-inkFaint">
          <div>Name</div>
          <div>Group</div>
          <div>Label</div>
          <div>Status</div>
          <div>Merge target</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-border">
          {rows.map(({ field, depth, parentKey, virtual }) => {
            const decision = decisions[field.key]?.decision;
            const mergeInto = decisions[field.key]?.merge_into || suggestedTarget(field) || '';
            const saving = savingKey === field.key;
            const dragging = draggedKey === field.key;
            const name = reviewName(field, decision ? decisions[field.key] : null);
            const group = groupName(field, decision ? decisions[field.key] : null);
            return (
              <div
                key={`${parentKey || 'root'}:${field.key}`}
                draggable={!virtual}
                onDragStart={(event) => {
                  if (virtual) return;
                  setDraggedKey(field.key);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', field.key);
                }}
                onDragEnd={() => setDraggedKey(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  scrollNearViewportEdge(event);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  dropOn(field.key);
                }}
                className={`grid min-h-[38px] min-w-[1180px] grid-cols-[minmax(240px,1.15fr)_180px_minmax(280px,1.35fr)_120px_190px_96px] items-center gap-3 px-3 py-1.5 text-xs transition-colors ${
                  dragging ? 'bg-accent/10 opacity-70' : depth ? 'bg-bg/30' : 'bg-white hover:bg-bg/40'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-4 shrink-0 text-inkFaint">{depth ? '->' : '::'}</span>
                  <div className="min-w-0">
                    <div className={`truncate font-ui font-semibold ${virtual ? 'text-inkFaint' : 'text-ink'}`}>{name}</div>
                    {!virtual && <div className="truncate text-[10px] font-ui text-inkFaint">{field.key}</div>}
                  </div>
                </div>
                <div className="truncate font-ui text-[11px] text-inkLight" title={group}>{group}</div>
                <div className="truncate text-inkLight" title={shortLabel(field)}>{shortLabel(field)}</div>
                <div className="flex items-center gap-1">
                  <FlagBadge value={decisionTone(decision)} />
                </div>
                <div className="truncate text-inkFaint" title={mergeInto}>
                  {decision === 'merge' ? readableKey(mergeInto) : mergeInto ? `suggested: ${readableKey(mergeInto)}` : '-'}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    title="Approve"
                    disabled={saving || virtual}
                    onClick={() => save({ key: field.key, decision: 'approve', merge_into: '', rename_to: field.key, defer_to_phase: '' })}
                    className="h-7 w-7 rounded border border-border text-xs font-ui text-buyer hover:border-buyer disabled:opacity-40"
                  >
                    A
                  </button>
                  <button
                    type="button"
                    title="Reject"
                    disabled={saving || virtual}
                    onClick={() => save({ key: field.key, decision: 'reject', merge_into: '', rename_to: field.key, defer_to_phase: '' })}
                    className="h-7 w-7 rounded border border-border text-xs font-ui text-seller hover:border-seller disabled:opacity-40"
                  >
                    R
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
