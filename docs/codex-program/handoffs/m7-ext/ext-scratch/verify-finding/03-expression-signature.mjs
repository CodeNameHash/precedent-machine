'use strict';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRootFrom } from './repo-root.mjs';

const repoRoot = repoRootFrom(import.meta.url);
const REQUIRED_NON_SYNTHETIC = 'ALL_OF(APPLIES_TO,FAMILY_MARKER)';
const PROFILE_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-approved-profile-set.json',
);

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const profileSet = loadJson(PROFILE_SET_PATH);
const profiles = Array.isArray(profileSet.profiles) ? profileSet.profiles : [];
const signatureCounts = new Map();
let matchingRequired = 0;
let missingOrNonString = 0;
for (const profile of profiles) {
  const signature = profile?.required_expression_signature;
  if (typeof signature !== 'string') {
    missingOrNonString += 1;
    continue;
  }
  signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
  if (signature === REQUIRED_NON_SYNTHETIC) matchingRequired += 1;
}

const signatureHistogram = [...signatureCounts.entries()]
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  .map(([signature, count]) => ({ signature, count }));

process.stdout.write(`${JSON.stringify({
  profile_count: profiles.length,
  required_non_synthetic_signature: REQUIRED_NON_SYNTHETIC,
  profiles_whose_signature_equals_required: matchingRequired,
  profiles_with_missing_or_non_string_signature: missingOrNonString,
  distinct_signature_count: signatureCounts.size,
  signature_histogram_top_15: signatureHistogram.slice(0, 15),
}, null, 2)}\n`);
