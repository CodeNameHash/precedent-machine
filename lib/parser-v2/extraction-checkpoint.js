/* ─────────────────────────────────────────────────────────────────────────
   lib/parser-v2/extraction-checkpoint.js — stage checkpoints for the ingest
   pipeline's LLM-heavy phases.

   The expensive part of a full ingest is the extraction calls (classify +
   the four strategies + inline defs); everything after is deterministic and
   re-runs in seconds. Before this, those results lived only in memory, so a
   post-processing or store failure threw away hours of LLM work (Bioverativ
   Phase-3 canary, 2026-07-16). Each stage's raw output is now written to
   disk as it completes; a rerun with --resume reloads completed stages and
   only re-runs what actually failed.

   Semantics:
   - save() always runs (cheap, atomic tmp+rename, best-effort — a disk
     error must never fail the ingest).
   - load() returns data ONLY when the checkpoint was created with
     resume: true AND the stored inputHash matches the current input text
     hash — a changed agreement text silently invalidates old stages.
   - Resume is deliberately opt-in per run: checkpoints know nothing about
     CODE changes (new prompts, new post-passes), so reuse is an operator
     decision, not a default.
   - clear() removes the deal's checkpoint dir; callers do this after a
     successful store so stale stages can't leak into a later rerun.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function inputHashFor(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

function createExtractionCheckpoint({ dir, key, inputHash, resume = false }) {
  if (!dir || !key || !inputHash) {
    throw new Error('createExtractionCheckpoint requires dir, key, and inputHash');
  }
  const base = path.join(dir, String(key));
  const fileFor = (stage) => path.join(base, `${String(stage).replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);

  return {
    dir: base,

    load(stage) {
      if (!resume) return null;
      let raw;
      try {
        raw = JSON.parse(fs.readFileSync(fileFor(stage), 'utf-8'));
      } catch {
        return null; // no checkpoint for this stage
      }
      if (!raw || raw.inputHash !== inputHash) {
        console.warn(`[checkpoint] ${stage}: input text changed since checkpoint was written — ignoring`);
        return null;
      }
      console.warn(`[checkpoint] ${stage}: resuming from ${fileFor(stage)} (saved ${raw.savedAt})`);
      return raw.data;
    },

    save(stage, data) {
      try {
        fs.mkdirSync(base, { recursive: true });
        const target = fileFor(stage);
        const tmp = `${target}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify({ inputHash, stage, savedAt: new Date().toISOString(), data }));
        fs.renameSync(tmp, target);
      } catch (err) {
        console.warn(`[checkpoint] save ${stage} failed (continuing): ${err.message}`);
      }
    },

    clear() {
      try {
        fs.rmSync(base, { recursive: true, force: true });
      } catch { /* best effort */ }
    },
  };
}

module.exports = { createExtractionCheckpoint, inputHashFor };
