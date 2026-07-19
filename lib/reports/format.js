// Shared display formatting for the /admin/reports UI (index.js + [kind].js).
function fmtDate(value) {
  if (!value) return 'Not run yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

module.exports = { fmtDate };
