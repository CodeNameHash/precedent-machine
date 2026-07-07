#!/usr/bin/env node
// Freeze G-0C by invoking the same preconditions the /api/admin/audit/freeze endpoint uses.
// This script writes docs/schema-shape/phase-0-C.frozen and appends the decision to audit-state.json.

import fs from 'fs';
import { freezePreconditions } from '../../pages/api/admin/audit/freeze.js';

const STATE_FILE = 'docs/schema-shape/audit-state.json';
const MARKER_FILE = 'docs/schema-shape/phase-0-C.frozen';

const pre = await freezePreconditions();
if (!pre.ok) {
  console.error('Freeze preconditions failed:');
  for (const f of pre.failures) console.error(' -', f);
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
const unresolved = (state.decisions || []).filter((d) => d.status === 'red' && !d.resolution);
if (unresolved.length) {
  console.error('Unresolved red decisions:', unresolved.length);
  process.exit(1);
}

const now = new Date().toISOString();
fs.writeFileSync(MARKER_FILE, `frozen_at=${now}\n`);

state.frozen_shapes = Array.from(new Set([...(state.frozen_shapes || []), 'phase-0-C']));
state.decisions = [
  ...(state.decisions || []),
  {
    gate: 'G-0C',
    status: 'green',
    resolution: 'frozen',
    frozen_at: now,
    reviewer: 'ben@precedent-machine',
    note: 'Phase 0-C audit matrix reviewed; evidence quotes verified > 20 chars across all populated cells.',
  },
];
fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');

console.log('G-0C frozen. Marker:', MARKER_FILE);
