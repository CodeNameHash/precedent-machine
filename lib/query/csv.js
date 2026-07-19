// Client-side CSV serialization for the five query-result kinds (WP-2 /
// M4-04 deliverable 4). Pure function — no DOM/browser APIs — so it can be
// unit tested and reused from the page component, which handles the actual
// download trigger.

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function scalarOf(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value;
}

function resultToCsvRows(result) {
  if (!result) return [];
  if (result.kind === 'DEAL_COMPARE') {
    const header = ['Provision', ...result.columns.map((col) => col.deal_name), ...result.columns.map((col) => `${col.deal_name} — Quote`), ...result.columns.map((col) => `${col.deal_name} — Section`)];
    const rows = result.rows.map((row) => {
      const values = row.cells.map((cell) => cell.key_fields.map((f) => `${f.label}: ${scalarOf(f.value)}`).join(' | '));
      const quotes = row.cells.map((cell) => cell.primary_quote?.text || '');
      const sections = row.cells.map((cell) => cell.primary_quote?.section_ref || '');
      return [row.provision_type, ...values, ...quotes, ...sections];
    });
    return [header, ...rows];
  }
  if (result.kind === 'PROVISION_CROSS_CUT') {
    const header = ['Deal', 'Signing', ...result.columns.map((c) => c.label), ...result.columns.map((c) => `${c.label} — Quote`)];
    const rows = result.rows.map((row) => [
      row.deal_name,
      row.signing_date || '',
      ...row.cells.map((cell) => scalarOf(cell.value)),
      ...row.cells.map((cell) => cell.verbatim_quote || ''),
    ]);
    return [header, ...rows];
  }
  if (result.kind === 'MARKET_RANGE') {
    const header = ['Deal', 'Value', 'Section'];
    const rows = (result.deal_points || []).map((point) => [point.deal_name, scalarOf(point.value), point.quote_section_ref || '']);
    return [header, ...rows];
  }
  if (result.kind === 'FILTER_THEN_LIST') {
    const header = ['Deal', 'Signing', 'Total Deal Value', 'Consideration Type', 'Matched Fields', 'Matched Values'];
    const rows = result.rows.map((row) => [
      row.deal_name,
      row.signing_date || '',
      scalarOf(row.columns.total_deal_value),
      row.columns.consideration_type || '',
      row.matched_provision_hits.map((h) => h.field).join(' | '),
      row.matched_provision_hits.map((h) => scalarOf(h.value)).join(' | '),
    ]);
    return [header, ...rows];
  }
  if (result.kind === 'DEAL_TO_MARKET') {
    const header = ['Field', 'Deal Value', 'Baseline', 'Status'];
    const rows = result.scorecard.map((row) => [
      row.field_label,
      scalarOf(row.deal_value),
      row.baseline_stats ? JSON.stringify(row.baseline_stats) : '',
      row.status,
    ]);
    return [header, ...rows];
  }
  return [];
}

function csvFilename(kind) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = String(kind || 'query').toLowerCase().replace(/_/g, '-');
  return `mergertrace-${slug}-${date}.csv`;
}

module.exports = { toCsv, resultToCsvRows, csvFilename };
