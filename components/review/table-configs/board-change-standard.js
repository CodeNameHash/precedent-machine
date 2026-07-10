// Shared board-change-standard label map. ONE definition consumed by
// nosol-fiduciary.config.js, nosol-intervening.config.js, and
// nosol-superior.config.js. Previously this map was defined identically in all
// three configs. The codes here are the extraction-assigned boardChangeStandard
// enum; unknown codes fall back to each config's local prettifyCode (codes are
// hover-title only, never rendered verbatim).
export const BOARD_CHANGE_STANDARD_LABELS = {
  INCONSISTENT_FIDUCIARY: 'Inconsistent with fiduciary duties',
};
