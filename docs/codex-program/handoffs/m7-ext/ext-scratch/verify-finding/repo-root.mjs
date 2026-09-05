'use strict';

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function repoRootFrom(moduleUrl) {
  let current = dirname(fileURLToPath(moduleUrl));
  for (let i = 0; i < 12; i += 1) {
    if (
      existsSync(resolve(current, 'package.json'))
      && existsSync(resolve(current, 'lib/canonical-v2/m7-v2-deterministic-generator.js'))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`could not locate repository root from ${moduleUrl}`);
}
