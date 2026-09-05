'use strict';

function displaySectionReference(reference) {
  const scoped = String(reference || '').match(/^(Exhibit|Annex)-([A-Za-z0-9]+)::(.+)$/);
  if (scoped) return `${scoped[1]} ${scoped[2]}, Section ${scoped[3]}`;
  return `Section ${reference}`;
}

module.exports = { displaySectionReference };
