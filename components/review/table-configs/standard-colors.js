// Shared standard -> colour system. One stable colour per legal STANDARD,
// applied consistently within a table AND across every table in the app, so a
// reader can scan for e.g. "commercially reasonable efforts" by colour
// everywhere it appears. The palette is also a rough strength ladder
// (emerald = strongest / most deal-protective, down to slate), so within one
// table the distinct standards stay visually distinct.
//
// Every standard chip in a config should pass `color={standardColorKey(std)}`
// to PillCell; headings/text can use STANDARD_TEXT[key]. When standardColorKey
// returns null (not a recognised standard), the caller's default tone applies.

export const STANDARD_COLORS = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  sky: 'border-sky-200 bg-sky-50 text-sky-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  teal: 'border-teal-200 bg-teal-50 text-teal-800',
  violet: 'border-violet-200 bg-violet-50 text-violet-800',
  slate: 'border-slate-300 bg-slate-100 text-slate-700',
};

export const STANDARD_TEXT = {
  emerald: 'text-emerald-700',
  sky: 'text-sky-700',
  amber: 'text-amber-700',
  teal: 'text-teal-700',
  violet: 'text-violet-700',
  slate: 'text-slate-600',
};

// Resolves a standard (a code, a tagged {code,standard,label} object, or a
// friendly label string) to a stable palette key. Order matters: the more
// specific patterns are tested first.
export function standardColorKey(input) {
  const t = String((input && (input.code || input.standard || input.label)) || input || '').toLowerCase();
  if (!t) return null;

  // --- Efforts ladder (antitrust, covenants, no-shop) ---
  if (/commercially[\s_-]*reasonable|\bcre\b/.test(t)) return 'amber';
  if (/reasonable[\s_-]*best[\s_-]*efforts|\brbe\b/.test(t)) return 'sky';
  if (/best[\s_-]*efforts/.test(t)) return 'violet';
  if (/reasonable[\s_-]*efforts/.test(t)) return 'slate';
  if (/hell[\s_-]*or[\s_-]*high[\s_-]*water|hohw|\bflat\b|absolute|unconditional/.test(t)) return 'emerald';

  // --- Accuracy / materiality (bring-down, reps qualifiers) ---
  if (/de[\s_-]*minimis/.test(t)) return 'teal';
  if (/all[\s_-]*material[\s_-]*respects|material[\s_-]*respects/.test(t)) return 'sky';
  if (/would[\s_-]*not[\s_-]*(have|cause).*mae|mae[\s_-]*qualified|material[\s_-]*adverse[\s_-]*effect/.test(t)) return 'amber';
  if (/all[\s_-]*respects/.test(t)) return 'emerald';

  // --- Benefit comparability (employee benefits) ---
  if (/no[\s_-]*less[\s_-]*favou?rable/.test(t)) return 'emerald';
  if (/substantially[\s_-]*comparable/.test(t)) return 'teal';
  if (/comparable/.test(t)) return 'sky';

  return null;
}
