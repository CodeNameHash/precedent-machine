const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

/* ─────────────────────────────────────────────────────────────────────────
   INTERPRETATIONS made building scripts/curation/mint-cards.js against
   spec-mint-cards.md + the coordinator's region-creation extension
   (documented here since this is the executable spec for the tool's
   behavior):

   1. extracted_by: the spec text says 'mint-cards', but
      supabase/schema-03-card-model.sql's CHECK constraint only allows
      ('CODEX','CLAUDE','BOTH'). The literal value would be rejected by the
      live DB, so minted rows use extracted_by: 'CODEX' and carry the
      'mint-cards' identity in provenance.extractor_name / review_notes
      instead.

   2. region_id / region_hash — REGION CREATION (supersedes the earlier
      refusal-by-default gate): provision_cards.region_id is NOT NULL (FK to
      parser_regions) and the schema is not relaxed. mint-cards now creates
      the parser_regions row itself, ingest-style:
        region_key = `mint:<provision_id>` (deterministic; makes reruns
        detectable via UNIQUE(deal_id, region_key)), region_type =
        'body.section.provision', start_char=0 / end_char=full_text.length
        (span-valid; true offsets unknown — recorded honestly as
        metadata.offsets='synthetic'), section_ref=null,
        title=provision.category, raw_text=full_text,
        text_hash=spanHash(full_text), metadata={source:'mint-cards',
        provision_id, offsets}.
      The card carries region_id = the inserted region's id (resolved at
      write time via .insert().select('id').single()) and region_hash = the
      same text_hash. In the PLANNED (dry-run) card row region_id is still
      null; executeWrites fills it before the card insert.

   3. excerpt_id / section_ref fallback: the `provisions` table
      (supabase/schema.sql) carries no section/heading column, so
      store-cards.js's real sectionPath() derivation isn't reachable from a
      bare provisions row. Per the spec's own explicit fallback,
      sha256(full_text).slice(0,12) (spanHash, imported from
      lib/schema/provision-card.js) is used for BOTH hash slots of the
      `<section> | <short_title> | <hash>` convention, with excerpt index
      0 — deterministic and unique per (dealId, short_title, full_text).

   4. party_scope "else NULL": party_scope is NOT NULL / CHECK-constrained in
      the schema, so a literal NULL was never on the table either. The
      store-cards.js partyScope() helper (exported for this purpose) is used
      as-is; it already has a documented default (N_A / MUTUAL) baked in and
      never returns null.

   5. Per-deal, not per-run, all-or-nothing: unlike prune-cards.js (one bad
      decision zeroes writes for the WHOLE run), the spec explicitly scopes
      refusal to the offending deal ("refuse that deal entirely ... zero
      writes for it"). A POST-CHECK-FAILED deal (or a deal whose inserts
      error mid-flight) does not affect other, clean deals in the same run.

   6. Region-hash collision guards (pre-flight, skip + report, never write):
      (a) a candidate whose spanHash(full_text) equals an EXISTING card's
      region_hash in the deal is SKIPPED-REGION-HASH-TAKEN (the
      provision_cards UNIQUE(deal_id, region_hash) constraint would trip);
      (b) two candidates in one deal with identical full_text are BOTH
      skipped the same way — this also means the spec's "two card-less
      provisions with the same category (identical duplicates)" scenario is
      stopped by this guard BEFORE the post-mint invariant even runs (both
      SKIPPED, not minted); (c) an existing parser_regions row keyed
      `mint:<provision_id>` marks a rerun — its id is REUSED instead of
      inserting a duplicate region.

   7. Insert-error handling: the coordinator specified "any insert error
      aborts the remainder of that deal with a clear report line (per-deal
      all-or-nothing stays)". Without DB transactions, region rows already
      inserted before the error cannot be rolled back by this tool — the
      abort stops all FURTHER writes for that deal, records the error in
      executed.dealErrors (and the CLI exits 1), and the mandatory pre-write
      backup (which now includes parser_regions) is the rollback mechanism
      for any partial rows.

   8. Backup: dumpBackup is local to mint-cards.js (not the prune-cards
      import) because it must also dump parser_regions for affected deals so
      a rollback can delete minted regions; gate semantics (refuse existing
      path, throw on dump failure) are identical to prune's.
   ───────────────────────────────────────────────────────────────────────── */

const {
  codedFeatureKeys,
  mintRegionKey,
  buildMintedRegionRow,
  buildMintedCardRow,
  selectMintCandidates,
  applyRegionHashGuards,
  runPostMintCheck,
  buildDealMintPlan,
  buildRunPlan,
  plannedInserts,
  summarize,
  checkBackupGate,
  executeWrites,
} = require('../scripts/curation/mint-cards');

const DEAL_A = '885edae5-49e8-464a-9f33-edd229119d7c';
const DEAL_B = 'c7c16365-c9cf-4bfb-93a6-1575084d717c';

// Mirrors lib/schema/provision-card.js spanHash for fixture expectations.
function sha12(text) {
  return crypto.createHash('sha256')
    .update(String(text || '').replace(/\s+/g, ' ').trim())
    .digest('hex')
    .slice(0, 12);
}

function provision(overrides = {}) {
  return {
    id: 'prov-1',
    type: 'REP-T',
    category: 'Absence of Changes',
    full_text: 'Section 3.10 Absence of Changes. Since the date hereof, there has been no material adverse change of any kind whatsoever.',
    ai_metadata: { features: { absenceOfChangesType: 'HYBRID' } },
    created_at: '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

function card(overrides = {}) {
  return {
    id: 'card-1',
    excerpt_id: 'excerpt-1',
    provision_instance_id: 'instance-1',
    region_id: 'region-1',
    region_hash: 'aaaaaaaaaaaa',
    provision_type: 'REPRESENTATION',
    short_title: 'Some Other Card',
    region_full_text: 'Unrelated existing card text, not connected to the fixtures below.',
    ...overrides,
  };
}

// Mock supabase client whose call log records every (table, op) touch.
// parser_regions inserts return sequential ids via .select('id').single().
function mockSb(calls) {
  let regionSeq = 0;
  return {
    from(table) {
      return {
        insert(rows) {
          calls.push([table, 'insert', rows]);
          if (table === 'parser_regions') {
            regionSeq += 1;
            const id = `minted-region-${regionSeq}`;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id }, error: null }),
              }),
            };
          }
          return Promise.resolve({ error: null });
        },
        update: (...a) => { calls.push([table, 'update', ...a]); return { eq: () => Promise.resolve({ error: null }) }; },
        delete: (...a) => { calls.push([table, 'delete', ...a]); return { eq: () => Promise.resolve({ error: null }) }; },
      };
    },
  };
}

// A POST-CHECK-FAILED deal: only provX is coded (a candidate), but an
// uncoded impostor provision shares its category AND full_text — the minted
// card's title/text keys hit BOTH provisions, so the ladder cannot uniquely
// match it back and the post-mint invariant fails the deal.
function postCheckFailingDeal() {
  const shared = 'The Company covenants to maintain in full force and effect all material permits and licenses.';
  const provX = provision({ id: 'pcf-x', category: 'Permits Covenant', full_text: shared });
  const provImpostor = provision({ id: 'pcf-impostor', category: 'Permits Covenant', full_text: shared, ai_metadata: {} });
  return { provisions: [provX, provImpostor] };
}

// ---------------------------------------------------------------------------
// 1. Target selection: coded-only, SECTION-LEFTOVER excluded.
// ---------------------------------------------------------------------------

test('selectMintCandidates: a card-less provision with coded features becomes a candidate', () => {
  const provisions = [provision()];
  const { candidates, skipped } = selectMintCandidates(DEAL_A, [], provisions);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].id, 'prov-1');
  assert.deepEqual(skipped, []);
});

test('selectMintCandidates: a card-less provision with NO coded features is not a candidate', () => {
  const provisions = [provision({ ai_metadata: {} })];
  const { candidates, skipped } = selectMintCandidates(DEAL_A, [], provisions);
  assert.equal(candidates.length, 0);
  assert.equal(skipped.length, 0);
});

test('selectMintCandidates: SECTION-LEFTOVER type is excluded even when it carries coded features', () => {
  const provisions = [provision({ type: 'SECTION-LEFTOVER' })];
  const { candidates, skipped } = selectMintCandidates(DEAL_A, [], provisions);
  assert.equal(candidates.length, 0);
  assert.equal(skipped.length, 0);
});

test('selectMintCandidates: a provision covered by an existing card (matched by the ladder) is not a candidate at all', () => {
  const prov = provision();
  const matchedCard = card({
    id: 'matched-1',
    excerpt_id: 'matched-excerpt-1',
    short_title: prov.category,
    provision_type: 'REPRESENTATION',
    region_full_text: prov.full_text,
  });
  const { candidates, skipped } = selectMintCandidates(DEAL_A, [matchedCard], [prov]);
  assert.equal(candidates.length, 0);
  assert.equal(skipped.length, 0);
});

// ---------------------------------------------------------------------------
// 2. Target selection: ambiguity-involved and title-taken skips.
// ---------------------------------------------------------------------------

test('selectMintCandidates: a provision involved in a match-ladder ambiguity is SKIPPED-AMBIGUOUS', () => {
  const provA = provision({ id: 'prov-a', category: 'Dup Title', full_text: 'Provision A full text, distinct content entirely on its own.' });
  const provB = provision({ id: 'prov-b', category: 'Dup Title', full_text: 'Provision B full text, distinct content entirely on its own, too.' });
  // Two cards share the SAME title as both provisions, but their own text
  // matches NEITHER provision — title collides (rung 1 fails, 2v2), and no
  // other rung can disambiguate, so the ladder reports a genuine ambiguity.
  const cardX = card({ id: 'card-x', excerpt_id: 'excerpt-x', short_title: 'Dup Title', region_full_text: 'Card X body, unrelated to either provision above.' });
  const cardY = card({ id: 'card-y', excerpt_id: 'excerpt-y', short_title: 'Dup Title', region_full_text: 'Card Y body, also unrelated to either provision above.' });

  const { candidates, skipped, matchPlan } = selectMintCandidates(DEAL_A, [cardX, cardY], [provA, provB]);
  assert.ok(matchPlan.ambiguities.length > 0);
  assert.equal(candidates.length, 0);
  assert.equal(skipped.length, 2);
  assert.ok(skipped.every((s) => s.status === 'SKIPPED-AMBIGUOUS'));
  const skippedIds = skipped.map((s) => s.provision.id).sort();
  assert.deepEqual(skippedIds, ['prov-a', 'prov-b']);
});

test('selectMintCandidates: a provision whose category equals an EXISTING card short_title is SKIPPED-TITLE-TAKEN', () => {
  // Different provision_type bucket than `prov` below (MISC_BOILERPLATE vs
  // REPRESENTATION), so the match ladder never even compares them —
  // otherwise the shared title would resolve as a unique rung-1 MATCH
  // instead of leaving `prov` unmatched for the title-taken guard to catch.
  const existingCard = card({
    id: 'title-holder',
    excerpt_id: 'title-holder-excerpt',
    provision_type: 'MISC_BOILERPLATE',
    short_title: 'Absence of Changes',
  });
  const prov = provision(); // category === 'Absence of Changes'
  const { candidates, skipped } = selectMintCandidates(DEAL_A, [existingCard], [prov]);
  assert.equal(candidates.length, 0);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].status, 'SKIPPED-TITLE-TAKEN');
  assert.equal(skipped[0].provision.id, prov.id);
});

// ---------------------------------------------------------------------------
// 3. Region construction.
// ---------------------------------------------------------------------------

test('buildMintedRegionRow: all fields per spec — mint:<id> key, body.section.provision, synthetic 0..len span, text_hash, honest metadata', () => {
  const prov = provision();
  const row = buildMintedRegionRow(DEAL_A, prov);
  assert.equal(row.deal_id, DEAL_A);
  assert.equal(row.region_key, `mint:${prov.id}`);
  assert.equal(mintRegionKey(prov.id), `mint:${prov.id}`);
  assert.equal(row.region_type, 'body.section.provision');
  assert.equal(row.start_char, 0);
  assert.equal(row.end_char, prov.full_text.length);
  assert.ok(row.end_char > row.start_char); // parser_regions_span_valid CHECK
  assert.equal(row.section_ref, null);
  assert.equal(row.title, prov.category);
  assert.equal(row.raw_text, prov.full_text);
  assert.equal(row.text_hash, sha12(prov.full_text));
  assert.deepEqual(row.metadata, { source: 'mint-cards', provision_id: prov.id, offsets: 'synthetic' });
});

// ---------------------------------------------------------------------------
// 4. Card construction.
// ---------------------------------------------------------------------------

test('buildMintedCardRow: short_title==category, provision_type mapped, region_hash == region text_hash, region_id deferred to write time, needs_review true', () => {
  const prov = provision();
  const row = buildMintedCardRow(DEAL_A, prov);
  const regionRow = buildMintedRegionRow(DEAL_A, prov);
  assert.equal(row.short_title, prov.category);
  assert.equal(row.provision_type, 'REPRESENTATION'); // REP-T -> REP -> REPRESENTATION
  assert.equal(row.region_id, null); // filled by executeWrites from the region insert
  assert.equal(row.region_hash, regionRow.text_hash); // same hash on both rows
  assert.equal(row.needs_review, true);
  assert.equal(row.extracted_by, 'CODEX'); // see interpretation #1
  assert.equal(row.kind, 'standard');
  assert.deepEqual(row.references, []);
  assert.equal(row.region_full_text, prov.full_text);
  assert.equal(row.primary_quote, prov.full_text);
  assert.ok(row.provenance && row.provenance.extractor_name === 'mint-cards');
});

test('buildMintedCardRow: excerpt_id is deterministic (same inputs -> same id) and unique per distinct text', () => {
  const prov = provision();
  const rowA1 = buildMintedCardRow(DEAL_A, prov);
  const rowA2 = buildMintedCardRow(DEAL_A, prov);
  assert.equal(rowA1.excerpt_id, rowA2.excerpt_id);
  assert.ok(rowA1.excerpt_id.startsWith(`${DEAL_A}:`));
  assert.ok(rowA1.excerpt_id.endsWith(':0'));
  assert.equal(rowA1.provision_instance_id, rowA2.provision_instance_id);

  const provOther = provision({ id: 'prov-2', full_text: 'A totally different provision body, unrelated in every way.' });
  const rowB = buildMintedCardRow(DEAL_A, provOther);
  assert.notEqual(rowA1.excerpt_id, rowB.excerpt_id);
});

// ---------------------------------------------------------------------------
// 5. Region-hash collision guards (a) and (b).
// ---------------------------------------------------------------------------

test('applyRegionHashGuards (a): a candidate whose text hash matches an EXISTING card region_hash is SKIPPED-REGION-HASH-TAKEN', () => {
  const prov = provision();
  const collidingCard = card({ region_hash: sha12(prov.full_text) });
  const { kept, skipped } = applyRegionHashGuards([prov], [collidingCard]);
  assert.equal(kept.length, 0);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].status, 'SKIPPED-REGION-HASH-TAKEN');
  assert.equal(skipped[0].provision.id, prov.id);
});

test('applyRegionHashGuards (b): two candidates with identical full_text are BOTH skipped, not minted', () => {
  const provA = provision({ id: 'same-a', category: 'Cat A' });
  const provB = provision({ id: 'same-b', category: 'Cat B' }); // same full_text as provA
  const { kept, skipped } = applyRegionHashGuards([provA, provB], []);
  assert.equal(kept.length, 0);
  assert.equal(skipped.length, 2);
  assert.ok(skipped.every((s) => s.status === 'SKIPPED-REGION-HASH-TAKEN'));
});

test('applyRegionHashGuards: a non-colliding candidate passes through untouched', () => {
  const prov = provision();
  const { kept, skipped } = applyRegionHashGuards([prov], [card()]);
  assert.equal(kept.length, 1);
  assert.equal(skipped.length, 0);
});

test('buildDealMintPlan: guard (b) end-to-end — two card-less provisions with the same category AND identical text are BOTH SKIPPED, not minted; deal stays clean', () => {
  const provA = provision({ id: 'twin-a', category: 'Twin Provision', full_text: 'Identical duplicate body text shared by both twin provisions here.' });
  const provB = provision({ id: 'twin-b', category: 'Twin Provision', full_text: 'Identical duplicate body text shared by both twin provisions here.' });
  const plan = buildDealMintPlan(DEAL_A, [], [provA, provB], []);
  assert.equal(plan.ok, true); // skips are reportable outcomes, not failures
  assert.equal(plan.entries.length, 2);
  assert.ok(plan.entries.every((e) => e.status === 'SKIPPED-REGION-HASH-TAKEN' && e.write === null));
  assert.equal(plannedInserts({ dealPlans: [plan] }).length, 0);
});

// ---------------------------------------------------------------------------
// 6. Rerun-reuse (guard c).
// ---------------------------------------------------------------------------

test('buildDealMintPlan: an existing parser_regions row keyed mint:<provision_id> marks a rerun — its id is planned for reuse', () => {
  const prov = provision();
  const regions = [{ id: 'preexisting-region-9', region_key: `mint:${prov.id}` }];
  const plan = buildDealMintPlan(DEAL_A, [], [prov], regions);
  assert.equal(plan.ok, true);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'MINTED');
  assert.equal(entry.write.reuseRegionId, 'preexisting-region-9');
});

test('buildDealMintPlan: unrelated parser_regions rows do NOT trigger reuse', () => {
  const prov = provision();
  const regions = [{ id: 'other-region', region_key: 'body:1.01' }];
  const plan = buildDealMintPlan(DEAL_A, [], [prov], regions);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'MINTED');
  assert.equal(entry.write.reuseRegionId, null);
});

test('executeWrites: a rerun-reuse entry inserts NO parser_regions row and anchors the card to the existing region id', async () => {
  const prov = provision();
  const regions = [{ id: 'preexisting-region-9', region_key: `mint:${prov.id}` }];
  const runPlan = buildRunPlan([DEAL_A], { [DEAL_A]: { cards: [], provisions: [prov], regions } });

  const calls = [];
  const sb = mockSb(calls);
  const result = await executeWrites(sb, runPlan);
  assert.equal(result.minted, 1);
  assert.equal(result.regionsInserted, 0);
  assert.equal(result.regionsReused, 1);
  assert.deepEqual(result.dealErrors, []);
  const regionInserts = calls.filter(([t]) => t === 'parser_regions');
  assert.equal(regionInserts.length, 0);
  const cardInserts = calls.filter(([t]) => t === 'provision_cards');
  assert.equal(cardInserts.length, 1);
  assert.equal(cardInserts[0][2][0].region_id, 'preexisting-region-9');
});

// ---------------------------------------------------------------------------
// 7. Post-mint invariant.
// ---------------------------------------------------------------------------

test('runPostMintCheck: a minted card that matches its own source provision at rung 2 (exact text) passes', () => {
  const prov = provision();
  const row = buildMintedCardRow(DEAL_A, prov);
  const matchPlan = { ambiguities: [] };
  const result = runPostMintCheck(DEAL_A, [], [prov], [{ provision: prov, row }], matchPlan);
  assert.equal(result.ok, true);
});

test('runPostMintCheck: same category but DISTINCT texts resolve 1:1 at rung 2 — minting both is allowed (rung-1 collision alone is not a failure)', () => {
  const shared = 'The Company shall comply with the identical obligation text in every respect';
  const provA = provision({ id: 'twin-a', category: 'Twin Provision', full_text: `${shared} alpha.` });
  const provB = provision({ id: 'twin-b', category: 'Twin Provision', full_text: `${shared} beta.` });

  const { candidates, matchPlan } = selectMintCandidates(DEAL_A, [], [provA, provB]);
  assert.equal(candidates.length, 2);
  assert.deepEqual(matchPlan.ambiguities, []);

  const mintedPairs = candidates.map((p) => ({ provision: p, row: buildMintedCardRow(DEAL_A, p) }));
  const result = runPostMintCheck(DEAL_A, [], [provA, provB], mintedPairs, matchPlan);
  assert.equal(result.ok, true);
});

test('runPostMintCheck: a minted card that would match a DIFFERENT provision is refused', () => {
  const shared = 'The parties shall cooperate fully and in good faith with respect to all regulatory filings and approvals.';
  const provA = provision({ id: 'head-a', category: 'Regulatory Cooperation', full_text: shared });
  const impostor = { ...provA, id: 'impostor-1' }; // same category/text, different id
  const provB = provision({ id: 'head-b', category: 'Regulatory Cooperation B', full_text: 'Entirely different provision body about something else.' });
  const row = buildMintedCardRow(DEAL_A, provA);
  const result = runPostMintCheck(DEAL_A, [], [impostor, provB], [{ provision: provA, row }], { ambiguities: [] });
  assert.equal(result.ok, false);
  assert.match(result.reason, /DIFFERENT provision/);
});

test('buildDealMintPlan: POST-CHECK-FAILED refuses the WHOLE deal (zero writes) when a minted card cannot be uniquely matched back', () => {
  const { provisions } = postCheckFailingDeal();
  const plan = buildDealMintPlan(DEAL_A, [], provisions, []);
  assert.equal(plan.ok, false);
  assert.equal(plan.entries.length, 1); // only provX was a coded candidate
  assert.equal(plan.entries[0].status, 'POST-CHECK-FAILED');
  assert.equal(plan.entries[0].write, null);
  assert.equal(plannedInserts({ dealPlans: [plan] }).length, 0);
});

// ---------------------------------------------------------------------------
// 8. Full happy path via buildDealMintPlan.
// ---------------------------------------------------------------------------

test('buildDealMintPlan: a clean candidate MINTS with paired region + card rows', () => {
  const prov = provision();
  const plan = buildDealMintPlan(DEAL_A, [], [prov], []);
  assert.equal(plan.ok, true);
  assert.equal(plan.entries.length, 1);
  const [entry] = plan.entries;
  assert.equal(entry.status, 'MINTED');
  assert.equal(entry.provisionId, prov.id);
  assert.ok(entry.codedFeatureKeys.includes('absenceOfChangesType'));
  assert.equal(entry.write.op, 'insert');
  assert.equal(entry.write.cardRow.short_title, prov.category);
  assert.equal(entry.write.cardRow.region_id, null); // resolved at write time
  assert.equal(entry.write.regionRow.region_key, `mint:${prov.id}`);
  assert.equal(entry.write.regionRow.text_hash, entry.write.cardRow.region_hash);
  assert.equal(entry.write.reuseRegionId, null);
});

test('codedFeatureKeys: reports the actual coded feature keys, not just a boolean', () => {
  const prov = provision();
  assert.deepEqual(codedFeatureKeys(prov), ['absenceOfChangesType']);
  assert.deepEqual(codedFeatureKeys(provision({ ai_metadata: {} })), []);
});

// ---------------------------------------------------------------------------
// 9. All-or-nothing PER DEAL (not per-run — see interpretation #5).
// ---------------------------------------------------------------------------

test('plannedInserts: a refused deal (POST-CHECK-FAILED) does not zero out writes for another, clean deal in the same run', () => {
  const { provisions: badProvisions } = postCheckFailingDeal();
  const provClean = provision({ id: 'clean-1', category: 'Clean Deal Provision', full_text: 'A perfectly ordinary, unique provision body for the clean deal.' });

  const runPlan = buildRunPlan(
    [DEAL_A, DEAL_B],
    {
      [DEAL_A]: { cards: [], provisions: badProvisions, regions: [] },
      [DEAL_B]: { cards: [], provisions: [provClean], regions: [] },
    },
  );

  const dealAPlan = runPlan.dealPlans.find((p) => p.dealId === DEAL_A);
  const dealBPlan = runPlan.dealPlans.find((p) => p.dealId === DEAL_B);
  assert.equal(dealAPlan.ok, false);
  assert.ok(dealAPlan.entries.some((e) => e.status === 'POST-CHECK-FAILED'));
  assert.equal(dealBPlan.ok, true);

  const writes = plannedInserts(runPlan);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].dealId, DEAL_B);
  assert.equal(writes[0].provisionId, 'clean-1');
});

test('summarize: counts every status bucket across a run', () => {
  const { provisions: badProvisions } = postCheckFailingDeal();
  const provClean = provision({ id: 'clean-1', category: 'Clean Deal Provision', full_text: 'A perfectly ordinary, unique provision body for the clean deal.' });
  const provDupA = provision({ id: 'dup-a', category: 'Dup A', full_text: 'Shared duplicate text body for the region hash guard, exactly equal.' });
  const provDupB = provision({ id: 'dup-b', category: 'Dup B', full_text: 'Shared duplicate text body for the region hash guard, exactly equal.' });

  const runPlan = buildRunPlan(
    [DEAL_A, DEAL_B],
    {
      [DEAL_A]: { cards: [], provisions: badProvisions, regions: [] },
      [DEAL_B]: { cards: [], provisions: [provClean, provDupA, provDupB], regions: [] },
    },
  );
  const counts = summarize(runPlan);
  assert.equal(counts.postCheckFailed, 1);
  assert.equal(counts.minted, 1);
  assert.equal(counts.skippedRegionHashTaken, 2);
});

// ---------------------------------------------------------------------------
// 10. Backup gate (imported from prune-cards.js unchanged).
// ---------------------------------------------------------------------------

test('checkBackupGate: --apply without --backup refuses', () => {
  const result = checkBackupGate({ apply: true, backup: null }, () => false);
  assert.equal(result.ok, false);
});

test('checkBackupGate: an existing backup path refuses', () => {
  const result = checkBackupGate({ apply: true, backup: 'reports/exists.json' }, (p) => p === 'reports/exists.json');
  assert.equal(result.ok, false);
});

test('checkBackupGate: a fresh backup path under --apply is ok; dry-run needs no backup at all', () => {
  const applyResult = checkBackupGate({ apply: true, backup: 'reports/fresh.json' }, () => false);
  assert.equal(applyResult.ok, true);
  const dryRunResult = checkBackupGate({ apply: false, backup: null }, () => false);
  assert.equal(dryRunResult.ok, true);
});

// ---------------------------------------------------------------------------
// 11. executeWrites: table restriction, insert ordering, error handling.
// ---------------------------------------------------------------------------

test('executeWrites: touches ONLY parser_regions (insert) and provision_cards (insert), all region inserts strictly before the card insert per deal', async () => {
  const prov1 = provision({ id: 'prov-x1', category: 'Provision X1', full_text: 'First unique clean provision body text for the ordering test.' });
  const prov2 = provision({ id: 'prov-x2', category: 'Provision X2', full_text: 'Second unique clean provision body text for the ordering test.' });
  const runPlan = buildRunPlan([DEAL_A], { [DEAL_A]: { cards: [], provisions: [prov1, prov2], regions: [] } });
  assert.equal(plannedInserts(runPlan).length, 2);

  const calls = [];
  const sb = mockSb(calls);
  const result = await executeWrites(sb, runPlan);
  assert.equal(result.minted, 2);
  assert.equal(result.regionsInserted, 2);
  assert.deepEqual(result.dealErrors, []);

  // Table restriction: only these two tables, only inserts.
  assert.ok(calls.every(([table, op]) => op === 'insert' && (table === 'parser_regions' || table === 'provision_cards')));
  // Ordering: ALL region inserts precede the card insert.
  assert.deepEqual(calls.map(([t]) => t), ['parser_regions', 'parser_regions', 'provision_cards']);
  // The card rows carry the region ids returned by the region inserts.
  const cardRows = calls[2][2];
  assert.deepEqual(cardRows.map((r) => r.region_id).sort(), ['minted-region-1', 'minted-region-2']);
});

test('executeWrites: a region insert error aborts the remainder of that deal (no card insert) but other deals still write', async () => {
  const provBad = provision({ id: 'bad-1', category: 'Bad Deal Provision', full_text: 'Provision body in the deal whose region insert will fail.' });
  const provGood = provision({ id: 'good-1', category: 'Good Deal Provision', full_text: 'Provision body in the deal that writes cleanly end to end.' });

  const runPlan = buildRunPlan(
    [DEAL_A, DEAL_B],
    {
      [DEAL_A]: { cards: [], provisions: [provBad], regions: [] },
      [DEAL_B]: { cards: [], provisions: [provGood], regions: [] },
    },
  );

  // The mock errors on the FIRST parser_regions insert (DEAL_A's only one),
  // succeeds afterwards (DEAL_B's).
  const calls = [];
  let regionCalls = 0;
  const sb = {
    from(table) {
      return {
        insert(rows) {
          calls.push([table, 'insert', rows]);
          if (table === 'parser_regions') {
            regionCalls += 1;
            const failing = regionCalls === 1;
            return {
              select: () => ({
                single: () => Promise.resolve(
                  failing
                    ? { data: null, error: { message: 'duplicate key value violates unique constraint' } }
                    : { data: { id: `region-${regionCalls}` }, error: null },
                ),
              }),
            };
          }
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const result = await executeWrites(sb, runPlan);
  assert.equal(result.minted, 1); // DEAL_B only
  assert.equal(result.dealErrors.length, 1);
  assert.equal(result.dealErrors[0].dealId, DEAL_A);
  assert.match(result.dealErrors[0].error, /parser_regions insert failed/);

  // DEAL_A never reached its provision_cards insert.
  const cardInserts = calls.filter(([t]) => t === 'provision_cards');
  assert.equal(cardInserts.length, 1);
  assert.equal(cardInserts[0][2][0].deal_id, DEAL_B);
});

test('executeWrites: zero DB calls when every deal in the run is refused', async () => {
  const { provisions: badProvisions } = postCheckFailingDeal();
  const runPlan = buildRunPlan([DEAL_A], { [DEAL_A]: { cards: [], provisions: badProvisions, regions: [] } });
  const calls = [];
  const sb = mockSb(calls);
  const result = await executeWrites(sb, runPlan);
  assert.equal(result.minted, 0);
  assert.equal(result.regionsInserted, 0);
  assert.equal(calls.length, 0);
});

// ---------------------------------------------------------------------------
// 12. Backup dump includes parser_regions (mint-local dumpBackup).
// ---------------------------------------------------------------------------

test('dumpBackup: dumps provision_cards + claims + parser_regions per deal, refuses an existing path', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { dumpBackup } = require('../scripts/curation/mint-cards');

  const reads = [];
  const sb = {
    from(table) {
      return {
        select: () => ({
          eq: (col, val) => {
            reads.push([table, val]);
            return {
              order: () => ({
                range: () => Promise.resolve({ data: [{ table, deal: val }], error: null }),
              }),
            };
          },
        }),
      };
    },
  };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mint-cards-test-'));
  const backupPath = path.join(dir, 'backup.json');
  try {
    const payload = await dumpBackup(sb, [DEAL_A], backupPath);
    assert.deepEqual(Object.keys(payload).sort(), ['claims', 'dealIds', 'deals', 'dumpedAt', 'parser_regions', 'provision_cards', 'provisions']);
    assert.deepEqual(payload.deals[DEAL_A], [{ table: 'deals', deal: DEAL_A }]);
    assert.deepEqual(payload.provisions[DEAL_A], [{ table: 'provisions', deal: DEAL_A }]);
    assert.deepEqual(payload.parser_regions[DEAL_A], [{ table: 'parser_regions', deal: DEAL_A }]);
    assert.ok(reads.some(([t]) => t === 'parser_regions'));
    assert.ok(fs.existsSync(backupPath));

    // Second call against the SAME path must refuse.
    await assert.rejects(
      () => dumpBackup(sb, [DEAL_A], backupPath),
      /already exists, refusing to overwrite/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('fetchAllRowsByColumn: reads beyond the PostgREST 1,000-row response cap', async () => {
  const { fetchAllRowsByColumn } = require('../scripts/curation/mint-cards');
  const ranges = [];
  const sb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            range: (start) => {
              ranges.push(start);
              const rows = start === 0
                ? Array.from({ length: 1000 }, (_, index) => ({ id: index }))
                : [{ id: 1000 }];
              return Promise.resolve({ data: rows, error: null });
            },
          }),
        }),
      }),
    }),
  };
  const rows = await fetchAllRowsByColumn(sb, 'claims', 'deal_id', DEAL_A);
  assert.equal(rows.length, 1001);
  assert.deepEqual(ranges, [0, 1000]);
});
