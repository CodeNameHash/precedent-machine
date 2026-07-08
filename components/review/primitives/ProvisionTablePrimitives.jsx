import taxonomy from '../../../lib/taxonomy.js';
import {
  getCitableQuotes,
  getCitableText,
  getCitableValue,
  isCitableValue,
} from '../../../lib/citable.js';
import { HoverSource } from '../shared.js';

const { MATERIAL_CONTRACT_BUCKET_CODES, MATERIAL_CONTRACT_BUCKET_META } = taxonomy;

const PILL_TONES = {
  neutral: 'border-border bg-bg text-ink',
  present: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  missing: 'border-border bg-bg/60 text-inkFaint',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
};

function textValue(value) {
  const inner = isCitableValue(value) ? getCitableValue(value) : value;
  if (inner === null || inner === undefined || inner === '') return null;
  if (typeof inner === 'boolean') return inner ? 'Yes' : 'No';
  if (Array.isArray(inner)) return inner.map(textValue).filter(Boolean).join(', ');
  if (typeof inner === 'object') return inner.label || inner.text || inner.code || inner.value || JSON.stringify(inner);
  return String(inner);
}

function evidenceQuote(value, evidence, source) {
  if (typeof evidence === 'string' && evidence.trim()) return evidence.trim();
  const citable = getCitableText(value);
  if (citable) return citable;
  const quotes = Array.isArray(evidence) ? evidence : getCitableQuotes(evidence);
  if (quotes.length) return quotes[0];
  return source?.primary_quote || source?.full_text || source?.region_full_text || null;
}

function romanize(index) {
  const numbers = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
    [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ];
  let n = Number(index) + 1;
  let out = '';
  for (const [value, numeral] of numbers) {
    while (n >= value) {
      out += numeral;
      n -= value;
    }
  }
  return out || String(index + 1);
}

export function EvidenceHoverSource({ value, evidence, source, quote, highlight, children, as = 'span', className }) {
  const resolved = quote || evidenceQuote(value, evidence, source);
  return (
    <HoverSource quote={resolved} highlight={highlight === undefined ? textValue(value) : highlight} as={as} className={className}>
      {children}
    </HoverSource>
  );
}

export function PillCell({ value, label, tone = 'neutral', evidence, source, quote, highlight, className = '' }) {
  const text = label || textValue(value) || 'Not captured';
  const classes = PILL_TONES[tone] || PILL_TONES.neutral;
  return (
    <EvidenceHoverSource value={value} evidence={evidence} source={source} quote={quote} highlight={highlight}>
      <span className={`inline-flex max-w-full items-center rounded border px-2 py-0.5 text-[11px] font-medium ${classes} ${className}`.trim()}>
        <span className="truncate">{text}</span>
      </span>
    </EvidenceHoverSource>
  );
}

export function ThresholdCellWithHoverQuote({ value, threshold, evidence, source, label = 'No threshold', className = '' }) {
  const text = textValue(threshold ?? value);
  if (!text) return <span className="text-inkFaint italic">{label}</span>;
  return (
    <EvidenceHoverSource value={threshold ?? value} evidence={evidence} source={source} as="span">
      <span className={`font-mono text-[11px] text-ink ${className}`.trim()}>{text}</span>
    </EvidenceHoverSource>
  );
}

export function CoverageChecklist({ items = [], emptyCopy = 'No checklist items captured.' }) {
  const rows = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!rows.length) return <EmptyStateBranch copy={emptyCopy} />;
  return (
    <ul className="space-y-1" data-testid="coverage-checklist">
      {rows.map((item, index) => (
        <li key={item.id || item.label || index} className="flex items-start gap-2">
          <PillCell label={item.present ? 'Present' : 'Missing'} tone={item.present ? 'present' : 'missing'} evidence={item.evidence} source={item.source} />
          <span className="min-w-0 flex-1 text-xs text-ink">{item.label || textValue(item.value) || `Item ${index + 1}`}</span>
        </li>
      ))}
    </ul>
  );
}

export function GroupedSubRows({ groups = [], emptyCopy = 'No grouped rows captured.' }) {
  const visibleGroups = Array.isArray(groups) ? groups.filter((group) => group && Array.isArray(group.rows) && group.rows.length) : [];
  if (!visibleGroups.length) return <EmptyStateBranch copy={emptyCopy} />;
  return (
    <div className="space-y-2" data-testid="grouped-sub-rows">
      {visibleGroups.map((group, groupIndex) => (
        <div key={group.id || group.label || groupIndex} className="rounded border border-border bg-bg/30">
          <div className="border-b border-border px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-inkFaint">
            {group.label || `Group ${groupIndex + 1}`}
          </div>
          <div className="divide-y divide-border">
            {group.rows.map((row, rowIndex) => (
              <div key={row.id || row.label || rowIndex} className="grid grid-cols-[minmax(8rem,14rem)_1fr] gap-2 px-2 py-1.5">
                <span className="text-[11px] font-medium text-ink">{row.label || `Row ${rowIndex + 1}`}</span>
                <EvidenceHoverSource value={row.value} evidence={row.evidence} source={row.source} as="span" className="text-xs text-ink">
                  {row.children || textValue(row.value) || row.detail || <span className="text-inkFaint italic">Not captured</span>}
                </EvidenceHoverSource>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RomanNumeralOrdinal({ index = 0, children, className = '' }) {
  return (
    <span className={`inline-flex items-baseline gap-1 ${className}`.trim()} data-testid="roman-numeral-ordinal">
      <span className="text-[10px] font-medium uppercase text-inkFaint">({romanize(index)})</span>
      <span>{children}</span>
    </span>
  );
}

export function EmptyStateBranch({ copy = 'No matching provisions found.', children }) {
  return (
    <div className="rounded border border-dashed border-border bg-bg/40 px-3 py-2 text-xs italic text-inkFaint" data-testid="empty-state-branch">
      {children || copy}
    </div>
  );
}

export function ComputedRollupHeader({ label, value, detail, evidence, source, tone = 'info' }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded border border-border bg-bg/50 px-2 py-1.5" data-testid="computed-rollup-header">
      <span className="text-[10px] font-medium uppercase tracking-wider text-inkFaint">{label}</span>
      <PillCell value={value} tone={tone} evidence={evidence} source={source} />
      {detail ? <span className="text-[11px] text-inkFaint">{detail}</span> : null}
    </div>
  );
}

export {
  getCitableQuotes,
  getCitableText,
  getCitableValue,
  isCitableValue,
  MATERIAL_CONTRACT_BUCKET_CODES,
  MATERIAL_CONTRACT_BUCKET_META,
};

