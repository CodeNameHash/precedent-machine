'use strict';

/**
 * Pinned Step 2X-A mis-nest fixture list.
 *
 * Six sections where segmentSubClauses produces a same-style parent-child
 * link (the mis-nest signature). Extracted from admitted canonical text via
 * rebuildAdmittedSourcePrimitives + sectionizeAdmittedSource on 2026-08-08.
 * The service must return UNDETERMINED/SAME_STYLE_CHAIN for spans under
 * these tainted paths.
 */

const fs = require('node:fs');
const path = require('node:path');

const FIXTURE_DIR = path.join(__dirname, 'step-2x-a-misnest-sections');

const MISNEST_SECTIONS = Object.freeze([
  Object.freeze({ deal: 'concho', section_reference: 'Annex-A', fixture_file: 'concho-Annex-A.txt' }),
  Object.freeze({ deal: 'modiv', section_reference: '8.12', fixture_file: 'modiv-8.12.txt' }),
  Object.freeze({ deal: 'modiv', section_reference: '8.3', fixture_file: 'modiv-8.3.txt' }),
  Object.freeze({ deal: 'redhat', section_reference: '3.01', fixture_file: 'redhat-3.01.txt' }),
  Object.freeze({ deal: 'skywater', section_reference: '3.21', fixture_file: 'skywater-3.21.txt' }),
  Object.freeze({ deal: 'topbuild', section_reference: '2.1', fixture_file: 'topbuild-2.1.txt' }),
]);

function loadMisnestSectionText(entry) {
  return fs.readFileSync(path.join(FIXTURE_DIR, entry.fixture_file), 'utf8');
}

function loadMisnestManifest() {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'manifest.json'), 'utf8'));
}

module.exports = {
  FIXTURE_DIR,
  MISNEST_SECTIONS,
  loadMisnestSectionText,
  loadMisnestManifest,
};
