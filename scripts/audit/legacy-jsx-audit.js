#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const parser = require('next/dist/compiled/babel/parser');

const REVIEW_PAGE = 'pages/review-v1/[id].js';
const INVENTORY_OUT = 'docs/audit/m2-09-legacy-inventory.md';
const PRIMITIVES_OUT = 'docs/audit/m2-09-primitives-needed.md';

const EXPECTED_LEGACY_NAMES = [
  'RepMaterialContractsTable',
  'IocGeneralExceptionsTable',
  'IocNegativeCovenantsTable',
  'IocAffirmativeCovenantsTable',
  'CategoryFeatureSummaryTable',
  'BringDownTiersTable',
  'CompensationItemsTable',
  'NosolFourTables',
  'EmployeeBenefitsTable',
  'SecMeetingTable',
  'NoOtherRepsFraudTable',
  'ConsiderationTables',
  'StructTable',
];

const NAME_PATTERN = /(Table|Tables|IocGeneral|IocNegative|IocAffirmative|CategoryFeatureSummaryTable|BringDownTiersTable|CompensationItemsTable|NosolFourTables|EmployeeBenefitsTable|SecMeetingTable|NoOtherRepsFraudTable|ConsiderationTables|StructTable)/;
const IGNORED_CALLS = new Set([
  'Array',
  'Boolean',
  'Date',
  'Math',
  'Number',
  'Object',
  'RegExp',
  'Set',
  'String',
  'console',
  'parseFloat',
  'parseInt',
]);

function parseSource(source) {
  return parser.parse(source, {
    sourceType: 'module',
    plugins: [
      'jsx',
      'classProperties',
      'dynamicImport',
      'exportDefaultFrom',
      'nullishCoalescingOperator',
      'objectRestSpread',
      'optionalChaining',
    ],
  });
}

function walk(node, visitor, parent = null) {
  if (!node || typeof node !== 'object') return;
  if (visitor(node, parent) === false) return;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visitor, node);
    } else if (value && typeof value === 'object' && typeof value.type === 'string') {
      walk(value, visitor, node);
    }
  }
}

function nodeText(source, node) {
  if (!node?.start && node?.start !== 0) return '';
  return source.slice(node.start, node.end).replace(/\s+/g, ' ').trim();
}

function jsxName(name) {
  if (!name) return '';
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') return `${jsxName(name.object)}.${jsxName(name.property)}`;
  if (name.type === 'JSXNamespacedName') return `${jsxName(name.namespace)}:${jsxName(name.name)}`;
  return '';
}

function attrValue(source, attr) {
  if (!attr?.value) return true;
  if (attr.value.type === 'StringLiteral') return attr.value.value;
  if (attr.value.type === 'JSXExpressionContainer') return nodeText(source, attr.value.expression);
  return nodeText(source, attr.value);
}

function calleeName(node) {
  if (!node) return '';
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') return `${calleeName(node.object)}.${calleeName(node.property)}`;
  if (node.type === 'OptionalMemberExpression') return `${calleeName(node.object)}.${calleeName(node.property)}`;
  return '';
}

function functionName(node, parent) {
  if (node.type === 'FunctionDeclaration') return node.id?.name || '';
  if ((node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') && parent?.type === 'VariableDeclarator') {
    return parent.id?.name || '';
  }
  return '';
}

function hasJsx(node) {
  let found = false;
  walk(node, (child) => {
    if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

function collectTableComponents(file, source) {
  const ast = parseSource(source);
  const components = [];
  walk(ast, (node, parent) => {
    if (!['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) return true;
    const name = functionName(node, parent);
    if (!name || !NAME_PATTERN.test(name) || !hasJsx(node)) return true;
    components.push(auditFunction(file, source, name, node));
    return false;
  });
  return components;
}

function auditFunction(file, source, name, node) {
  const result = {
    file,
    name,
    startLine: node.loc.start.line,
    endLine: node.loc.end.line,
    jsxElements: new Map(),
    derivedValues: new Map(),
    handlers: new Map(),
    conditionals: new Map(),
    helpers: new Map(),
  };
  walk(node.body || node, (child, parent) => {
    if (child === node) return true;
    if (child.type === 'JSXOpeningElement') {
      const tag = jsxName(child.name);
      const attrs = {};
      for (const attr of child.attributes || []) {
        if (attr.type !== 'JSXAttribute') continue;
        const key = jsxName(attr.name);
        if (['className', 'data-testid', 'key', 'title', 'role'].includes(key) || /^on[A-Z]/.test(key)) {
          attrs[key] = attrValue(source, attr);
        }
        if (/^on[A-Z]/.test(key)) {
          add(result.handlers, key, `${tag} ${key} -> ${attrs[key] || 'handler'}`, child.loc.start.line);
        }
      }
      add(result.jsxElements, tag, `${tag}${Object.keys(attrs).length ? ` ${JSON.stringify(attrs)}` : ''}`, child.loc.start.line);
    }
    if (child.type === 'VariableDeclarator' && child.id?.type === 'Identifier' && child.init) {
      const text = nodeText(source, child.init);
      if (/\.map\(|\.reduce\(|\.filter\(|\.flatMap\(|useMemo\(|sort\(|group|bucket|rollup|threshold|summary|rows/i.test(text)) {
        add(result.derivedValues, child.id.name, `${child.id.name} = ${text.slice(0, 180)}`, child.loc.start.line);
      }
    }
    if (child.type === 'CallExpression') {
      const callee = calleeName(child.callee);
      if (callee === 'useMemo') add(result.derivedValues, `useMemo:${child.loc.start.line}`, nodeText(source, child).slice(0, 180), child.loc.start.line);
      const root = callee.split('.')[0];
      if (root && !IGNORED_CALLS.has(root) && !['map', 'filter', 'reduce', 'flatMap', 'sort', 'join', 'push'].includes(root)) {
        add(result.helpers, callee, callee, child.loc.start.line);
      }
    }
    if (['IfStatement', 'ConditionalExpression'].includes(child.type)) {
      add(result.conditionals, `${child.type}:${child.loc.start.line}`, nodeText(source, child.test || child).slice(0, 180), child.loc.start.line);
    }
    if (child.type === 'LogicalExpression' && child.operator === '&&') {
      add(result.conditionals, `&&:${child.loc.start.line}`, nodeText(source, child.left).slice(0, 180), child.loc.start.line);
    }
    return true;
  });
  return normaliseComponent(result);
}

function add(map, key, text, line) {
  if (!map.has(key)) map.set(key, { text, lines: [] });
  map.get(key).lines.push(line);
}

function normaliseComponent(component) {
  const convert = (map) => Array.from(map.values()).map((entry) => ({
    text: entry.text,
    lines: Array.from(new Set(entry.lines)).sort((a, b) => a - b),
  })).sort((a, b) => a.lines[0] - b.lines[0] || a.text.localeCompare(b.text));
  return {
    ...component,
    jsxElements: convert(component.jsxElements),
    derivedValues: convert(component.derivedValues),
    handlers: convert(component.handlers),
    conditionals: convert(component.conditionals),
    helpers: convert(component.helpers),
  };
}

function auditFiles(repoRoot = process.cwd()) {
  const files = [
    REVIEW_PAGE,
    ...findTableFiles(path.join(repoRoot, 'components/review')).map((file) => path.relative(repoRoot, file)),
  ];
  return files.flatMap((file) => {
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    return collectTableComponents(file, source);
  }).sort((a, b) => a.file.localeCompare(b.file) || a.startLine - b.startLine);
}

function missingExpectedNames(components) {
  const names = new Set(components.map((component) => component.name));
  return EXPECTED_LEGACY_NAMES.filter((name) => !names.has(name));
}

function findTableFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findTableFiles(full);
    return /Table.*\.(jsx?|tsx?)$/.test(entry.name) ? [full] : [];
  });
}

function primitiveRows(components) {
  const rules = [
    ['PillCell', /pill|badge|chip|bucket|canonical|code/i],
    ['ThresholdCellWithHoverQuote', /threshold|amount|dollar|percent|hover|quote|HoverSource|getCitableQuotes|isCitableValue/i],
    ['CoverageChecklist', /coverage|checklist|expected|missing|NotIncludedStrip|not included|included/i],
    ['GroupedSubRows', /subrow|sub-row|group|section|tbody|rowspan|colSpan|accordion|collapsible/i],
    ['RomanNumeralOrdinal', /roman|romanizeLower|ordinal|\(i\)|\(ii\)/i],
    ['EvidenceHoverSource', /HoverSource|getCitableQuotes|isCitableValue|primary_quote|quote|source|openSource|onClick/i],
    ['EmptyStateBranch', /empty|missing|none|not included|No |Absent|Silent/i],
    ['ComputedRollupHeader', /useMemo|summary|rollup|reduce|count|total|coverage/i],
  ];
  return rules.map(([primitive, pattern]) => {
    const families = components.filter((component) => pattern.test(componentBlob(component))).map((component) => component.name);
    return {
      primitive,
      families: Array.from(new Set(families)).sort(),
    };
  }).filter((row) => row.families.length > 0);
}

function componentBlob(component) {
  return [
    component.name,
    ...component.jsxElements.map((entry) => entry.text),
    ...component.derivedValues.map((entry) => entry.text),
    ...component.handlers.map((entry) => entry.text),
    ...component.conditionals.map((entry) => entry.text),
    ...component.helpers.map((entry) => entry.text),
  ].join('\n');
}

function mdCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function bulletList(items, empty = 'None found.') {
  if (!items.length) return `- ${empty}`;
  return items.map((item) => `- L${item.lines.join(', L')}: ${item.text}`).join('\n');
}

function inventoryMarkdown(components, generatedAt) {
  const missingNames = missingExpectedNames(components);
  const lines = [
    `# M2-09 Legacy JSX Inventory — ${generatedAt}`,
    '',
    'AST-derived inventory for WP-M2-09 Step 1a. Scope: inline review-page table functions plus `components/review/*Table*` modules.',
    '',
    `Components audited: ${components.length}.`,
    '',
  ];
  if (missingNames.length) {
    lines.push('Named legacy components not present as live JSX functions on current main:');
    lines.push('');
    for (const name of missingNames) lines.push(`- ${name}`);
    lines.push('');
  }
  for (const component of components) {
    lines.push(`## ${component.name}`);
    lines.push('');
    lines.push(`Source: \`${component.file}:${component.startLine}-${component.endLine}\``);
    lines.push('');
    lines.push('### JSX Elements');
    lines.push(bulletList(component.jsxElements));
    lines.push('');
    lines.push('### Derived Values / Rollups');
    lines.push(bulletList(component.derivedValues));
    lines.push('');
    lines.push('### Hover / Click Handlers');
    lines.push(bulletList(component.handlers));
    lines.push('');
    lines.push('### Conditional Branches / Empty States');
    lines.push(bulletList(component.conditionals));
    lines.push('');
    lines.push('### Helper Dependencies');
    lines.push(bulletList(component.helpers));
    lines.push('');
  }
  return lines.join('\n');
}

function primitivesMarkdown(rows, generatedAt) {
  const lines = [
    `# M2-09 Render Primitives Needed — ${generatedAt}`,
    '',
    'Deduplicated primitive list inferred from `docs/audit/m2-09-legacy-inventory.md`.',
    '',
    '| Primitive | Families requiring it |',
    '|---|---|',
  ];
  for (const row of rows) {
    lines.push(`| ${mdCell(row.primitive)} | ${mdCell(row.families.join(', '))} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function writeFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${text.replace(/\s+$/, '')}\n`);
}

function main() {
  const generatedAt = new Date().toISOString();
  const components = auditFiles();
  const primitives = primitiveRows(components);
  writeFile(INVENTORY_OUT, inventoryMarkdown(components, generatedAt));
  writeFile(PRIMITIVES_OUT, primitivesMarkdown(primitives, generatedAt));
  process.stdout.write(`Legacy JSX audit: ${components.length} components, ${primitives.length} primitives\n`);
}

if (require.main === module) main();

module.exports = {
  EXPECTED_LEGACY_NAMES,
  auditFiles,
  collectTableComponents,
  missingExpectedNames,
  primitiveRows,
  primitivesMarkdown,
  inventoryMarkdown,
};
