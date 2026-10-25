'use strict';

// The lawyer preview read model (work package 38, plan finding (251)).
//
// The preview read is fast on the bytes and slow on the database: work
// package 32 projected what the page renders (45.7 MB to 3.9 MB) and the
// page still takes about 16 s on a finished 97-section run, because every
// request reads the run's section results, closures, routings, proposals,
// components, headlines, conclusions and full-section spans and rebuilds
// the same projection (finding (244): 31 sections take 8 s, a light query
// 0.7 s; finding (241): 40 s on a 38.9 MB read before that). The rows of a
// finished run do not change without a review save, so the projection is
// stored once per run (public.product_preview_reads) and served as one row.
//
// The rule, here, as code:
// - only a finished run (READY or FAILED) has a stable projection; a run
//   still analysing commits sections as it goes and the page polls it, so
//   it reads live;
// - a stored model is served only when it is not stale and its schema
//   version is the one this code builds;
// - every review save marks the run's model stale (a lawyer's decision or
//   edit changes the page), so the next read rebuilds once and the run
//   after it is cached again. Publishing is a review save, so the badge
//   follows too.
//
// Nothing here decides anything about the facts: the stored payload is the
// preview read's own shape, and a store without the model (an older
// deployment, a test double) leaves the handler on the live read.

// The workspace the model stores is the payload the preview route returns.
const PREVIEW_WORKSPACE_VERSION = 'PRODUCT_PREVIEW_WORKSPACE/V1';
const FINISHED_RUN_STATUSES = Object.freeze(['READY', 'FAILED']);

function runIsFinished(run) {
  return FINISHED_RUN_STATUSES.includes(String(run?.status || ''));
}

// Whether a stored row may be served instead of reading the run's analysis.
// The staleness flag is written by lib/product/phase-3-store.js saveReview.
function previewReadModelUsable({ run, row }) {
  if (!runIsFinished(run)) return false;
  if (!row || typeof row !== 'object') return false;
  if (row.stale === true) return false;
  const payload = row.payload;
  if (!payload || typeof payload !== 'object') return false;
  if (payload.schema_version !== PREVIEW_WORKSPACE_VERSION) return false;
  return true;
}

module.exports = {
  PREVIEW_WORKSPACE_VERSION, FINISHED_RUN_STATUSES,
  previewReadModelUsable, runIsFinished,
};
