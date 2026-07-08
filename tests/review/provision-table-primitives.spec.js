const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const primitivePath = 'components/review/primitives/ProvisionTablePrimitives.jsx';
const provisionTablePath = 'components/review/ProvisionTable.jsx';

function source(path = primitivePath) {
  return fs.readFileSync(path, 'utf8');
}

test('ProvisionTable exposes shared primitives to renderCell context', () => {
  const body = source(provisionTablePath);
  assert.match(body, /import \* as ProvisionTablePrimitives/);
  assert.match(body, /const ctx = \{ reviewDeal, config, primitives: ProvisionTablePrimitives \};/);
  assert.match(body, /column\.renderCell\(row, ctx\)/);
});

test('EvidenceHoverSource reuses HoverSource and citable evidence helpers', () => {
  const body = source();
  assert.match(body, /import \{ HoverSource \} from '\.\.\/shared\.js';/);
  assert.match(body, /getCitableQuotes/);
  assert.match(body, /getCitableText/);
  assert.match(body, /export function EvidenceHoverSource/);
  assert.match(body, /<HoverSource quote=\{resolved\}/);
});

test('PillCell renders the shared pill shape through EvidenceHoverSource', () => {
  const body = source();
  assert.match(body, /export function PillCell/);
  assert.match(body, /<EvidenceHoverSource value=\{value\}/);
  assert.match(body, /inline-flex max-w-full items-center rounded border/);
});

test('ThresholdCellWithHoverQuote renders thresholds with hover evidence', () => {
  const body = source();
  assert.match(body, /export function ThresholdCellWithHoverQuote/);
  assert.match(body, /textValue\(threshold \?\? value\)/);
  assert.match(body, /font-mono text-\[11px\] text-ink/);
});

test('CoverageChecklist, GroupedSubRows, and empty branch expose stable test ids', () => {
  const body = source();
  assert.match(body, /export function CoverageChecklist/);
  assert.match(body, /data-testid="coverage-checklist"/);
  assert.match(body, /export function GroupedSubRows/);
  assert.match(body, /data-testid="grouped-sub-rows"/);
  assert.match(body, /export function EmptyStateBranch/);
  assert.match(body, /data-testid="empty-state-branch"/);
});

test('RomanNumeralOrdinal and ComputedRollupHeader cover legacy ordinal and rollup shapes', () => {
  const body = source();
  assert.match(body, /function romanize/);
  assert.match(body, /export function RomanNumeralOrdinal/);
  assert.match(body, /data-testid="roman-numeral-ordinal"/);
  assert.match(body, /export function ComputedRollupHeader/);
  assert.match(body, /data-testid="computed-rollup-header"/);
});

test('material-contract bucket taxonomy is re-exported for table configs', () => {
  const body = source();
  assert.match(body, /MATERIAL_CONTRACT_BUCKET_CODES/);
  assert.match(body, /MATERIAL_CONTRACT_BUCKET_META/);
  assert.match(body, /export \{[\s\S]*MATERIAL_CONTRACT_BUCKET_CODES,[\s\S]*MATERIAL_CONTRACT_BUCKET_META,[\s\S]*\};/);
});

