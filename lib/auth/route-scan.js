// lib/auth/route-scan.js
//
// Filesystem-driven enumeration of pages/api/** routes. Node-only (uses
// `fs`) — never imported by middleware.js or any page; only by
// tests/auth-route-enforcement.test.js and, if regenerated,
// docs/API-ROUTE-CLASSIFICATION.md's route list.
//
// Why this exists: the acceptance test for S2 has to prove a route "nobody
// remembered to classify" is refused automatically, not just the routes
// someone remembered to write a test for. That only works if the test's
// route list comes from walking the actual pages/api/ directory at test
// time rather than from a hand-maintained array that a new file could
// silently fail to join.
const fs = require('fs');
const path = require('path');

/**
 * Recursively list every `.js` file under `apiDir`, relative to it,
 * posix-separated (`admin/reprocess-cond.js`, not `admin\reprocess-cond.js`).
 */
function listApiRouteFiles(apiDir) {
  const out = [];
  function walk(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), rel);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        out.push(rel);
      }
    }
  }
  walk(apiDir, '');
  return out.sort();
}

/**
 * `admin/review-queue/[id]/resolve.js` -> `/api/admin/review-queue/[id]/resolve`
 * `admin/review-queue/index.js`        -> `/api/admin/review-queue`
 * `saved-queries.js`                   -> `/api/saved-queries`
 */
function filePathToRoutePath(relFilePath) {
  let withoutExt = relFilePath.replace(/\.js$/, '');
  if (withoutExt.endsWith('/index')) {
    withoutExt = withoutExt.slice(0, -'/index'.length);
  } else if (withoutExt === 'index') {
    withoutExt = '';
  }
  return `/api/${withoutExt}`;
}

/**
 * Replace every `[segment]` in a route path with `placeholder`, so a
 * template like `/api/review/[id]/cards` becomes a real, fetchable URL.
 */
function instantiateDynamicSegments(routePath, placeholder = '00000000-0000-4000-8000-000000000000') {
  return routePath.replace(/\[[^\]]+\]/g, placeholder);
}

/**
 * The full, current list of API routes as { file, routePath, requestPath }.
 * `routePath` keeps `[id]`-style placeholders (matches what a human reads
 * in the inventory doc); `requestPath` is what a test actually fetches.
 */
function enumerateApiRoutes(apiDir) {
  return listApiRouteFiles(apiDir).map((file) => {
    const routePath = filePathToRoutePath(file);
    return { file, routePath, requestPath: instantiateDynamicSegments(routePath) };
  });
}

module.exports = {
  listApiRouteFiles,
  filePathToRoutePath,
  instantiateDynamicSegments,
  enumerateApiRoutes,
};
