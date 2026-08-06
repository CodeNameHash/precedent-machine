/**
 * sidebar-groups.js — Plain-JS mirror of the sidebar grouping/color tables.
 *
 * components/review/shared.js holds the real, actively-rendered
 * SIDEBAR_GROUPS + TYPE_HEX -- it is what Sidebar.js, FullDocumentView.js
 * and the review pages import. This module is a CommonJS-importable copy
 * of the same tables, kept only so tests/review-layout.test.js (which
 * cannot import shared.js directly, because shared.js contains JSX) has
 * something to load and diff shared.js's source text against.
 *
 * No application code imports this module today: SIDEBAR_GROUPS here exists
 * to be checked against shared.js by that one test; typeHex, TYPE_HEX,
 * sidebarTypeOrder and findGroupForType are unused everywhere, including by
 * the test. If a future non-JSX surface needs these tables, this is where
 * it would import them from -- until then, keep it in sync with shared.js
 * by hand.
 */

// Metsera fb2 block 4a: canonical section order — Structure → Consideration →
// Reps → MAE → Material Contracts → IOC → No-Sol → Antitrust → SEC Filing /
// Meeting → Conditions → Termination Rights → Termination Fees → rest.
// Seller/Target children sit before Buyer/Parent (block 4b). Keep in sync
// with the richer copy in components/review/shared.js (the review page's
// source of truth).
export const SIDEBAR_GROUPS = [
  { label: 'Structure & Mechanics', types: ['STRUCT'] },
  { label: 'Consideration', types: ['CONSID'] },
  { label: 'Representations', children: [
    { label: 'Company / Target', type: 'REP-T' },
    { label: 'Buyer / Parent', type: 'REP-B' },
  ]},
  { label: 'Material Adverse Effect', children: [
    { label: 'Company Material Adverse Effect', type: 'MAE-DEF' },
    { label: 'Parent Material Adverse Effect', type: 'MAE-DEF-P' },
  ]},
  // P8 item 3: synthetic group — emitted only when matching REP-T provisions
  // exist (detected at render time). Pure UI synthesis; no parser type.
  { label: 'Material Contracts', types: ['__MATERIAL_CONTRACTS'] },
  { label: 'Interim Operating Covenants', children: [
    { label: 'Company / Target', type: 'IOC-T' },
    { label: 'Buyer / Parent', type: 'IOC-B' },
  ]},
  { label: 'No-Solicitation / No-Shop', children: [
    { label: 'Company / Target', type: 'NOSOL-T' },
    { label: 'Buyer / Parent', type: 'NOSOL-B' },
    { label: 'Mutual / Reciprocal', type: 'NOSOL-M' },
  ]},
  { label: 'Antitrust / Regulatory', types: ['ANTI'] },
  { label: 'SEC Filing / Meeting Requirements', types: ['__SEC_MEETING'] },
  { label: 'Conditions to Closing', types: ['COND-M', 'COND-B', 'COND-S', 'COND'], singleType: 'COND-M' },
  { label: 'Termination Rights', types: ['TERMR-M', 'TERMR-B', 'TERMR-T', 'TERMR'], singleType: 'TERMR-M' },
  { label: 'Termination Fees', types: ['TERMF'] },
  // FB3 missed item 1: keep in sync with components/review/shared.js.
  { label: 'Employee Benefits', types: ['__EMPLOYEE_BENEFITS'] },
  { label: 'Other Covenants', types: ['COV'] },
  { label: 'Miscellaneous / Boilerplate', types: ['MISC'] },
  { label: 'No Other Reps / Fraud / Willful Breach (Abry)', types: ['__ABRY'] },
  // FB3 chrome: Definitions moved to the bottom of the page (after Misc) —
  // it's a reference glossary, not something read in document order. Keep in
  // sync with components/review/shared.js.
  { label: 'Definitions', types: ['DEF'] },
  { label: 'Other', types: ['OTHER'] },
];

/* Corpus provision-type hex colors (mirrors TYPE_HEX in review/[id].js). */
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
  'NOSOL-M':'#A8538C',
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
  '__ABRY': '#8A8782',
  '__SEC_MEETING': '#6E8AA8',
  '__EMPLOYEE_BENEFITS': '#6E8AA8',
  COV:      '#6E8AA8',
  MAE:      '#8B5B3A',
  'MAE-T':  '#8B5B3A',
  'MAE-B':  '#8B5B3A',
  'MAE-DEF':'#8B5B3A',
  'MAE-DEF-P':'#8B5B3A',
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
