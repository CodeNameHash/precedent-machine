'use strict';

function displayIdentityParties(parties, fallback = 'Not identified') {
  if (!Array.isArray(parties)) return fallback;
  const labels = parties.map((party) => {
    if (typeof party === 'string') return party.trim();
    if (!party || typeof party.name !== 'string') return '';
    const name = party.name.trim();
    const role = typeof party.role === 'string'
      ? party.role.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
      : '';
    return name && role ? `${name} (${role})` : name;
  }).filter(Boolean);
  return labels.length ? labels.join(' / ') : fallback;
}

module.exports = { displayIdentityParties };
