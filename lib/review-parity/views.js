'use strict';

/**
 * lib/review-parity/views.js
 *
 * Produces the two row views the engine compares.
 *
 * THE SEAM. Both sides are rendered through the SAME table config's
 * selectRows(). Only the cards differ:
 *
 *   legacy view  reviewDeal.cards = production provision_cards
 *   V2 view      reviewDeal.cards = the cards a Canonical V2 product
 *                projection emits (lib/canonical-v2/*-product-projection.js
 *                emit legacy-shaped cards precisely so they can render
 *                through the existing configs)
 *
 * Comparing selectRows() output rather than the projection's raw payload is
 * what makes a finding mean "the review table would say something
 * different", which is the only claim worth proving before a switch. It
 * also means a difference is attributable to the DATA, never to the
 * renderer, because the renderer is held constant.
 *
 * A mapping may override this with v2.view = 'projection_cards' to compare
 * projection cards directly, for families where the switch is specified
 * somewhere other than the config.
 *
 * Renderers (renderCell / renderFooter) are never invoked. They build React
 * elements, which are neither deterministic to serialise nor semantically
 * interesting -- selectRows() output is the row model, and the row model is
 * the information.
 */

const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

let esmLoader = null;

/**
 * ESM/JSX loader. The table configs are ESM with JSX; the harness (like the
 * rest of tests/) is CommonJS. This is the same swc+jiti bridge every
 * dark-bridge suite in tests/ already uses -- reused rather than inventing a
 * second loading mechanism, so the harness loads a config exactly the way
 * the existing suites do.
 */
function loadEsmModule(absolutePath) {
  if (!esmLoader) {
    // eslint-disable-next-line global-require
    const swc = require('next/dist/build/swc');
    const transform = ({ source, filename }) => {
      try {
        const result = swc.transformSync(source, {
          filename,
          jsc: {
            parser: { syntax: 'ecmascript', jsx: true, dynamicImport: true },
            transform: { react: { runtime: 'automatic' } },
          },
          module: { type: 'commonjs' },
        });
        return { code: result.code };
      } catch (error) {
        return { code: '', error };
      }
    };
    // eslint-disable-next-line global-require
    esmLoader = require('jiti')(path.join(REPO_ROOT, 'review-parity-loader.js'), {
      interopDefault: true,
      extensions: ['.js', '.jsx', '.json'],
      transform,
      cache: false,
    });
  }
  return esmLoader(absolutePath);
}

class ViewError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ViewError';
    this.code = code;
    this.details = details;
  }
}

function resolveRepoPath(relative) {
  const resolved = path.resolve(REPO_ROOT, relative);
  if (resolved !== REPO_ROOT && !resolved.startsWith(REPO_ROOT + path.sep)) {
    throw new ViewError('PATH_ESCAPES_REPO', `path escapes the repository: ${relative}`);
  }
  return resolved;
}

function loadTableConfig(modulePath, exportName) {
  const absolute = resolveRepoPath(modulePath);
  let module;
  try {
    module = loadEsmModule(absolute);
  } catch (error) {
    throw new ViewError('CONFIG_LOAD_FAILED', `could not load ${modulePath}: ${error && error.message}`, { modulePath });
  }
  const config = module && module[exportName];
  if (!config || typeof config.selectRows !== 'function') {
    throw new ViewError('CONFIG_MISSING_EXPORT', `${modulePath} does not export a table config named "${exportName}" with selectRows()`, {
      modulePath,
      exportName,
      available: module ? Object.keys(module).sort() : [],
    });
  }
  return config;
}

function loadProjection(modulePath, exportName) {
  const absolute = resolveRepoPath(modulePath);
  // Projections are CommonJS.
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const module = require(absolute);
  const fn = module && module[exportName];
  if (typeof fn !== 'function') {
    throw new ViewError('PROJECTION_MISSING_EXPORT', `${modulePath} does not export a function named "${exportName}"`, {
      modulePath,
      exportName,
      available: module ? Object.keys(module).sort() : [],
    });
  }
  return fn;
}

/**
 * Wrap cards into the minimal reviewDeal shape a table config reads.
 * `extra` lets a caller pass the server-stamped flags a config consults
 * (e.g. canonical_v2_preview_enabled); it defaults to nothing, i.e. the
 * production-default gate state.
 */
function toReviewDeal(dealId, cards, extra = {}) {
  return { dealId, cardCount: cards.length, cards, definitions: cards.filter((card) => card && card.kind === 'definition'), ...extra };
}

function selectRowsSafely(config, reviewDeal, side) {
  let rows;
  try {
    rows = config.selectRows(reviewDeal);
  } catch (error) {
    throw new ViewError('SELECT_ROWS_THREW', `${side} selectRows() threw: ${error && error.message}`, { side });
  }
  if (rows === null || rows === undefined) return [];
  if (!Array.isArray(rows)) {
    throw new ViewError('SELECT_ROWS_NOT_ARRAY', `${side} selectRows() returned ${typeof rows}, expected an array`, { side });
  }
  return rows;
}

/** Legacy view: production provision cards through the table config. */
function buildLegacyRows({ mapping, deal_id: dealId, cards, review_deal_extra: extra = {} }) {
  if (!Array.isArray(cards)) throw new ViewError('LEGACY_CARDS_NOT_ARRAY', 'legacy cards must be an array');
  const config = loadTableConfig(mapping.legacy.config_module, mapping.legacy.config_export);
  return selectRowsSafely(config, toReviewDeal(dealId, cards, extra), 'legacy');
}

/**
 * V2 view. Accepts, in order of preference:
 *   { cards }                 already-materialised projection cards
 *   { projection }            a projection payload; its .cards are used
 *   { resolution }            run the mapping's projection over a resolution
 */
function buildV2Rows({ mapping, deal_id: dealId, cards, projection, resolution, review_deal_extra: extra = {} }) {
  let v2Cards = cards;

  if (!Array.isArray(v2Cards) && projection) {
    if (!Array.isArray(projection.cards)) {
      throw new ViewError('PROJECTION_HAS_NO_CARDS', 'projection payload has no cards array', {
        schema_version: projection.schema_version || null,
      });
    }
    v2Cards = projection.cards;
  }

  if (!Array.isArray(v2Cards) && resolution) {
    if (!mapping.v2.projection_module) {
      throw new ViewError('NO_PROJECTION_DECLARED', 'a resolution was supplied but the mapping declares no v2.projection_module');
    }
    const project = loadProjection(mapping.v2.projection_module, mapping.v2.projection_export);
    let produced;
    try {
      produced = project({ resolution, deal_id: dealId });
    } catch (error) {
      throw new ViewError('PROJECTION_THREW', `projection threw: ${error && error.message}`, {
        module: mapping.v2.projection_module,
      });
    }
    if (!produced || !Array.isArray(produced.cards)) {
      throw new ViewError('PROJECTION_HAS_NO_CARDS', 'projection returned no cards array');
    }
    v2Cards = produced.cards;
  }

  if (!Array.isArray(v2Cards)) {
    throw new ViewError('V2_SOURCE_MISSING', 'V2 side needs one of: cards, projection, resolution');
  }

  if (mapping.v2.view === 'projection_cards') return v2Cards;

  const config = loadTableConfig(mapping.v2.config_module, mapping.v2.config_export);
  return selectRowsSafely(config, toReviewDeal(dealId, v2Cards, extra), 'v2');
}

module.exports = {
  REPO_ROOT,
  ViewError,
  buildLegacyRows,
  buildV2Rows,
  loadEsmModule,
  loadProjection,
  loadTableConfig,
  resolveRepoPath,
  toReviewDeal,
};
