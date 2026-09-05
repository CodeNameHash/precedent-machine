'use strict';

function asciiFold(value) {
  return String(value).replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

function canonicalRoleKeys(roles, allowedRoles) {
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) throw new TypeError('roles must be an object');
  if (!Array.isArray(allowedRoles) || allowedRoles.some((role) => typeof role !== 'string')) throw new TypeError('allowedRoles must be an array of strings');
  const result = {};
  const collisions = [];
  const schemaTargets = new Map();
  for (const allowed of allowedRoles) {
    const folded = asciiFold(allowed);
    const targets = schemaTargets.get(folded) || [];
    targets.push(allowed);
    schemaTargets.set(folded, targets);
  }
  const groups = new Map();
  for (const [key, value] of Object.entries(roles)) {
    const targets = schemaTargets.get(asciiFold(key)) || [];
    if (targets.length !== 1) {
      Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true });
      if (targets.length > 1) collisions.push({ target: targets, keys: [key] });
      continue;
    }
    const target = targets[0];
    const entries = groups.get(target) || [];
    entries.push({ key, value });
    groups.set(target, entries);
  }
  for (const [target, entries] of groups) {
    if (entries.length === 1) Object.defineProperty(result, target, { value: entries[0].value, enumerable: true, writable: true, configurable: true });
    else {
      for (const entry of entries) Object.defineProperty(result, entry.key, { value: entry.value, enumerable: true, writable: true, configurable: true });
      collisions.push({ target: [target], keys: entries.map((entry) => entry.key) });
    }
  }
  return { roles: result, collisions };
}

module.exports = { canonicalRoleKeys };
