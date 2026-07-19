// Item 3 (UI Feedback Round 3): shared column-width tokens so every table's
// TERM (first) column resolves to the SAME real width at every viewport,
// instead of three competing systems (th `width` hints under auto layout,
// a hardcoded `w-[14rem]` + `whitespace-nowrap` box, and GroupedSubRows'
// own CSS grid `minmax(8rem,14rem)`) each independently deciding.
//
// `table-fixed` + a <colgroup> col honors a PERCENTAGE width exactly
// (unlike `<th width>` under auto layout, which is only ever a hint the
// browser overrides from cell content) -- so every config's Term column
// gets the SAME percentage, capped at the same max-width. `maxWidth` on a
// <col> is honored by Chromium under table-fixed; browsers that ignore it
// still get the percentage, so equality (the thing that matters most) holds
// everywhere and the cap is a bonus, not a requirement.
export const TERM_COL_WIDTH = '30%';
export const TERM_COL_MAX = '14rem';

// GroupedSubRows uses a CSS grid, not a <table>, so it expresses the same
// pair as a grid-template-columns fragment: minmax(8rem,30%) keeps a floor
// so the label column doesn't collapse to nothing in a narrow group, while
// still resolving to the same ~30% share as every <table>-based sibling.
export const TERM_GRID_COLUMN = 'minmax(8rem,30%)';
