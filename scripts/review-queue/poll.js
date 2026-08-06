#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (value == null || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    args[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    index += 1;
  }
  return args;
}

function handoffPath(options = {}) {
  const root = options.root || process.env.REVIEW_QUEUE_ROOT || process.cwd();
  return options.handoffFile || path.join(root, 'archive', 'HANDOFF.md');
}

function parseResolutionLine(line) {
  const prefix = 'REVIEW_QUEUE_RESOLUTION ';
  if (!line.startsWith(prefix)) return null;
  return JSON.parse(line.slice(prefix.length));
}

function readResolutions(options = {}) {
  const file = handoffPath(options);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return parseResolutionLine(line);
      } catch (error) {
        return {
          parse_error: error.message,
          raw: line,
        };
      }
    })
    .filter(Boolean);
}

function matchesResolution(resolution, args = {}) {
  if (args.id && resolution.id === args.id) return true;
  if (args.pr) {
    const marker = `#${Number(args.pr)}`;
    return String(resolution.codex_action || '').includes(marker);
  }
  return !args.id && !args.pr;
}

function run(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  const resolutions = readResolutions(options).filter((resolution) => matchesResolution(resolution, args));
  return {
    found: resolutions.length > 0,
    resolutions,
  };
}

function main() {
  try {
    const result = run();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.found) process.exit(1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }
}

if (require.main === module) main();

module.exports = {
  handoffPath,
  matchesResolution,
  parseArgs,
  parseResolutionLine,
  readResolutions,
  run,
};
