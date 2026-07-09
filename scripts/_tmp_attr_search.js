const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const { createClient } = require('@supabase/supabase-js');
const DEAL_ID = '885edae5-49e8-464a-9f33-edd229119d7c';

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: claims, error } = await supabase.from('claims').select('*').eq('deal_id', DEAL_ID);
  if (error) { console.error(error); process.exit(1); }
  const targets = [
    'superiorProposalTest','superiorProposalThresholdPct','superiorProposalPercentage','superiorProposalDeterminer',
    'notChangeOfRecommendationItems','tenderOfferDisclosureScope','tenderOfferDisclosurePermitted','legallyRequiredDisclosurePermitted','safeDisclosureCarveoutLanguage',
    'representativesStandard','representativeBreachIsCompanyBreach','representativeBreachConditions',
    'standstillWaiverConditions','dontAskDontWaive','standstillWaiverPermitted','antiClubbingWaiverPermitted',
    'forceTheVote','parentTerminationRightForNonsolicitBreach',
    'initialMatchPeriodDays','matchingPeriod','subsequentMatchPeriodDays','subsequentMatchingPeriod','noticePeriod','noticeContent',
    'fiduciaryEngageStandard','engagementStandard','fiduciaryFinalStandard','changeRecStandard','boardChangeForSuperiorProposal',
  ];
  for (const t of targets) {
    const hits = claims.filter((c) => c.attribute === t);
    console.log(`${t}: ${hits.length} claim(s)`, hits.length ? hits.map(h => h.provision_instance_id.split('|')[1] || h.provision_instance_id).slice(0,3) : '');
  }
}
main();
