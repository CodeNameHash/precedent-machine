/**
 * sidebar-groups.js — Canonical sidebar grouping for provision types.
 *
 * Mirrors the constant historically embedded in pages/review/[id].js so the
 * comparison view (and any future surfaces) can share the same grouping +
 * type-color hex map without duplicating it.
 */

export const SIDEBAR_GROUPS = [
  { label: 'Structure & Mechanics', types: ['STRUCT'] },
  { label: 'Consideration', types: ['CONSID'] },
  { label: 'Representations', children: [
    { label: 'Company / Target', type: 'REP-T' },
    { label: 'Buyer / Parent', type: 'REP-B' },
    // P8 item 3: synthetic group — emitted only when matching REP-T
    // provisions exist (detected at render time). Same data-presence model
    // as MAE-DEF. Pure UI synthesis; no new parser provision type.
    { label: 'Material Contracts', type: '__MATERIAL_CONTRACTS' },
  ]},
  { label: 'Material Adverse Effect', types: ['MAE-DEF'] },
  { label: 'Interim Operating Covenants', children: [
    { label: 'Company / Target', type: 'IOC-T' },
    { label: 'Buyer / Parent', type: 'IOC-B' },
  ]},
  { label: 'No-Solicitation / No-Shop', children: [
    { label: 'Company / Target', type: 'NOSOL-T' },
    { label: 'Buyer / Parent', type: 'NOSOL-B' },
  ]},
  { label: 'Antitrust / Regulatory', types: ['ANTI'] },
  { label: 'Conditions to Closing', types: ['COND-M', 'COND-B', 'COND-S', 'COND'], singleType: 'COND-M' },
  { label: 'Termination Rights', types: ['TERMR-M', 'TERMR-B', 'TERMR-T', 'TERMR'], singleType: 'TERMR-M' },
  { label: 'Termination Fees', types: ['TERMF'] },
  { label: 'Other Covenants', types: ['COV'] },
  { label: 'Definitions', types: ['DEF'] },
  { label: 'Miscellaneous / Boilerplate', types: ['MISC'] },
  { label: 'Other', types: ['OTHER'] },
];

/* Recital provision-type hex colors (mirrors TYPE_HEX in review/[id].js). */
export const TYPE_HEX = {
  STRUCT:   '#7459A6',
  CONSID:   '#2F8B7E',
  DEF:      '#4E6FA6',
  IOC:      '#B5862E',
  'IOC-T':  '#B5862E',
  'IOC-B':  '#B5862E',
  NOSOL:    '#A8538C',
  'NOSOL-T':'#A8538C',
  'NOSOL-B':'#A8538C',
  ANTI:     '#2F8FA8',
  COND:     '#5660B0',
  'COND-M': '#5660B0',
  'COND-B': '#5660B0',
  'COND-S': '#5660B0',
  TERMR:    '#C0673A',
  'TERMR-M':'#C0673A',
  'TERMR-B':'#C0673A',
  'TERMR-T':'#C0673A',
  TERMF:    '#B14E63',
  REP:      '#3F8A6A',
  'REP-T':  '#3F8A6A',
  'REP-B':  '#3F8A6A',
  '__MATERIAL_CONTRACTS': '#3F8A6A',
  COV:      '#6E8AA8',
  MAE:      '#8B5B3A',
  'MAE-T':  '#8B5B3A',
  'MAE-B':  '#8B5B3A',
  MISC:     '#8A8782',
  OTHER:    '#8A8782',
};

export function typeHex(code) {
  return TYPE_HEX[code] || '#8A8782';
}

/* All types in document/sidebar order — useful for sorting flat provision lists. */
export function sidebarTypeOrder() {
  const order = [];
  for (const g of SIDEBAR_GROUPS) {
    if (g.children) {
      for (const c of g.children) order.push(c.type);
    } else {
      for (const t of g.types) order.push(t);
    }
  }
  return order;
}

/* Find the group + child label that owns a provision type. */
export function findGroupForType(type) {
  for (const g of SIDEBAR_GROUPS) {
    if (g.children) {
      const c = g.children.find((c) => c.type === type);
      if (c) return { group: g, child: c };
    } else if ((g.types || []).includes(type)) {
      return { group: g, child: null };
    }
  }
  return null;
}
