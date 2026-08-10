'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

let ioc;
test.before(async () => {
  ioc = await import(path.join(
    '..', 'components', 'review', 'table-configs', 'ioc-exceptions.config.js',
  ));
});

function card(id, capacity) {
  return {
    id,
    provision_type: 'COVENANT_INTERIM_OPERATING',
    provision_subtype: 'IOC-DEBT',
    section_ref: '6.1',
    short_title: 'Indebtedness and loans',
    primary_quote: 'incur any indebtedness',
    features: { restrictionComponents: ['INDEBTEDNESS'] },
    party: capacity === null ? null : {
      role: 'IOC_COVENANT_OBLIGOR',
      value: capacity === 'TARGET' ? 'Company' : 'Parent',
      capacity,
    },
  };
}

test('IOC configs prefer governed party capacity over the legacy single-band default', () => {
  const target = card('target-ioc', 'TARGET');
  const buyer = card('buyer-ioc', 'BUYER');
  const reviewDeal = { cards: [target, buyer] };

  assert.deepEqual(ioc.iocCardsForParty(reviewDeal, 'Company'), [target]);
  assert.deepEqual(ioc.iocCardsForParty(reviewDeal, 'Parent'), [buyer]);
  assert.equal(ioc.iocExceptionsConfig.selectRows(reviewDeal).length, 1);
  assert.equal(ioc.parentIocExceptionsConfig.selectRows(reviewDeal).length, 1);
});

test('IOC configs retain the text split only for cards without governed party data', () => {
  const legacy = card('legacy-ioc', null);
  const reviewDeal = { cards: [legacy] };

  assert.deepEqual(ioc.iocCardsForParty(reviewDeal, 'Company'), [legacy]);
  assert.deepEqual(ioc.iocCardsForParty(reviewDeal, 'Parent'), []);
});

test('IOC configs fail closed on unsupported governed party capacity', () => {
  const joint = card('joint-ioc', 'JOINT_MULTI_PARTY');
  assert.throws(
    () => ioc.iocCardsForParty({ cards: [joint] }, 'Company'),
    /governed target or buyer covenant obligor/,
  );
});
