const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.resolve(__dirname, '..');
const reviewPagePath = path.join(repoRoot, 'pages/review/[id].js');
const apiPath = path.join(repoRoot, 'pages/api/review/[id]/cards.js');
const reviewPageSource = fs.readFileSync(reviewPagePath, 'utf8');
const apiSource = fs.readFileSync(apiPath, 'utf8');

test('review page imports the provision card table', () => {
  assert.match(reviewPageSource, /import ProvisionCardTable from '..\/..\/components\/review\/ProvisionCardTable';/);
});

test('review page mounts the first schema structured table config before cards', () => {
  assert.match(reviewPageSource, /import ProvisionTable from '..\/..\/components\/review\/ProvisionTable';/);
  assert.match(reviewPageSource, /import \{ structureMechanicsConfig \} from '..\/..\/components\/review\/table-configs\/structure-mechanics\.config';/);
  assert.match(reviewPageSource, /import \{ considerationHeroConfig \} from '..\/..\/components\/review\/table-configs\/consideration-hero\.config';/);
  assert.match(reviewPageSource, /import \{ antitrustRegulatoryConfig \} from '..\/..\/components\/review\/table-configs\/antitrust-regulatory\.config';/);
  assert.match(reviewPageSource, /import \{ approvalsVotesConfig \} from '..\/..\/components\/review\/table-configs\/approvals-votes\.config';/);
  assert.match(reviewPageSource, /import \{ generalCovenantsConfig \} from '..\/..\/components\/review\/table-configs\/general-covenants\.config';/);
  assert.match(reviewPageSource, /import \{ maeDefinitionsConfig \} from '..\/..\/components\/review\/table-configs\/mae-definitions\.config';/);
  assert.match(reviewPageSource, /import \{ representationsQualifiersConfig \} from '..\/..\/components\/review\/table-configs\/representations-qualifiers\.config';/);
  assert.match(reviewPageSource, /import \{ terminationFeesConfig \} from '..\/..\/components\/review\/table-configs\/termination-fees\.config';/);
  assert.match(reviewPageSource, /import \{ terminationRightsConfig \} from '..\/..\/components\/review\/table-configs\/termination-rights\.config';/);
  assert.match(reviewPageSource, /import \{ advisersFeesExpensesConfig \} from '..\/..\/components\/review\/table-configs\/advisers-fees-expenses\.config';/);
  assert.match(reviewPageSource, /import \{ conditionsMConfig \} from '..\/..\/components\/review\/table-configs\/conditions-m\.config';/);
  assert.match(reviewPageSource, /import \{ conditionsBConfig \} from '..\/..\/components\/review\/table-configs\/conditions-b\.config';/);
  assert.match(reviewPageSource, /import \{ conditionsSConfig \} from '..\/..\/components\/review\/table-configs\/conditions-s\.config';/);
  assert.match(reviewPageSource, /import \{ employeeBenefitsConfig \} from '..\/..\/components\/review\/table-configs\/employee-benefits\.config';/);
  assert.match(reviewPageSource, /import \{ iocExceptionsConfig \} from '..\/..\/components\/review\/table-configs\/ioc-exceptions\.config';/);
  assert.match(reviewPageSource, /import \{ materialContractsConfig \} from '..\/..\/components\/review\/table-configs\/material-contracts\.config';/);
  assert.match(reviewPageSource, /import \{ nosolFiduciaryConfig \} from '..\/..\/components\/review\/table-configs\/nosol-fiduciary\.config';/);
  assert.match(reviewPageSource, /import \{ nosolInterveningConfig \} from '..\/..\/components\/review\/table-configs\/nosol-intervening\.config';/);
  assert.match(reviewPageSource, /import \{ nosolNoshopConfig \} from '..\/..\/components\/review\/table-configs\/nosol-noshop\.config';/);
  assert.match(reviewPageSource, /import \{ nosolSuperiorConfig \} from '..\/..\/components\/review\/table-configs\/nosol-superior\.config';/);
  assert.match(reviewPageSource, /import \{ noOtherRepsFraudConfig \} from '..\/..\/components\/review\/table-configs\/no-other-reps-fraud\.config';/);
  assert.match(reviewPageSource, /import \{ secMeetingConfig \} from '..\/..\/components\/review\/table-configs\/sec-meeting\.config';/);
  assert.match(reviewPageSource, /import \{ tailFeeConfig \} from '..\/..\/components\/review\/table-configs\/tail-fee\.config';/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{structureMechanicsConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{considerationHeroConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{antitrustRegulatoryConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{approvalsVotesConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{generalCovenantsConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{maeDefinitionsConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{representationsQualifiersConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{terminationFeesConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{terminationRightsConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{advisersFeesExpensesConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{conditionsMConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{conditionsBConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{conditionsSConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{materialContractsConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{iocExceptionsConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{tailFeeConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{nosolNoshopConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{nosolSuperiorConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{nosolInterveningConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{nosolFiduciaryConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{employeeBenefitsConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{secMeetingConfig\} reviewDeal=\{schemaReviewDeal/);
  assert.match(reviewPageSource, /<ProvisionTable config=\{noOtherRepsFraudConfig\} reviewDeal=\{schemaReviewDeal/);
  const mountedConfigs = [
    'structureMechanicsConfig',
    'considerationHeroConfig',
    'conditionsMConfig',
    'conditionsBConfig',
    'conditionsSConfig',
    'approvalsVotesConfig',
    'representationsQualifiersConfig',
    'maeDefinitionsConfig',
    'materialContractsConfig',
    'iocExceptionsConfig',
    'generalCovenantsConfig',
    'tailFeeConfig',
    'terminationFeesConfig',
    'terminationRightsConfig',
    'nosolNoshopConfig',
    'nosolSuperiorConfig',
    'nosolInterveningConfig',
    'nosolFiduciaryConfig',
    'antitrustRegulatoryConfig',
    'employeeBenefitsConfig',
    'secMeetingConfig',
    'advisersFeesExpensesConfig',
    'noOtherRepsFraudConfig',
  ];
  const mountPositions = mountedConfigs.map((config) => reviewPageSource.indexOf(`<ProvisionTable config={${config}}`));
  assert.ok(mountPositions.every((position) => position >= 0));
  assert.deepEqual(mountPositions, [...mountPositions].sort((a, b) => a - b));
  assert.ok(
    mountPositions.at(-1) < reviewPageSource.indexOf('<ProvisionCardTable reviewDeal={schemaReviewDeal'),
    'structured schema tables should render before the raw card list',
  );
});

test('review page renders the schema card table without a legacy fallback threshold', () => {
  assert.doesNotMatch(reviewPageSource, /SCHEMA_RENDER_MIN_CARDS/);
  assert.doesNotMatch(reviewPageSource, /schemaCardCount >=/);
  assert.match(reviewPageSource, /<ProvisionCardTable reviewDeal=\{schemaReviewDeal/);
});

test('review page no longer supports the retired legacy render query override', () => {
  assert.doesNotMatch(reviewPageSource, /renderModeParam/);
  assert.doesNotMatch(reviewPageSource, /forcedRenderMode/);
  assert.doesNotMatch(reviewPageSource, /renderModeParam === 'legacy'/);
});

test('review page fetches card-backed deal data through the API route', () => {
  assert.match(reviewPageSource, /\/api\/review\/\$\{encodeURIComponent\(dealId\)\}\/cards/);
});

test('review cards API delegates to the server-side card query helper', () => {
  assert.match(apiSource, /import \{ fetchReviewDealCards \} from '..\/..\/..\/..\/lib\/queries\/review-deal';/);
  assert.match(apiSource, /const mode = rawMode === 'admin' \? 'admin' : 'user';/);
  assert.match(apiSource, /const reviewDeal = await fetchReviewDealCards\(dealId, sb, \{ mode \}\);/);
});
