#!/usr/bin/env node
/**
 * Enrich N1 legal decisions board with Ben's simple bucket presentation:
 * (1) buckets we already had — names only
 * (2) buckets we want to add — each with one real clause excerpt + deal count
 *
 * Usage: node scripts/codex-program/build-legal-board-bucket-presentation.js
 */

const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "../..");
const BOARD_PATH = path.join(
  REPO,
  "docs/codex-program/notes/N1-OPEN-LEGAL-DECISIONS-BOARD-DATA-2026-08-25.json"
);
const CANVAS_PATH = path.join(
  process.env.HOME || "",
  ".cursor/projects/Users-bengoodchild-precedent-machine-restored-20260812/canvases/n1-legal-decisions.canvas.tsx"
);
const M4_DIR = path.join(
  REPO,
  "evidence/canonical-v2/stage-2y-structure-migration/shadow/m4"
);
const M2_DIR = path.join(
  REPO,
  "evidence/canonical-v2/stage-2y-structure-migration/shadow/m2"
);

const textCache = new Map();
/** @type {Map<string, {deal:string, section:string, text:string}>} */
let operativeByClaimId = null;

function humanBucket(label) {
  if (!label) return "Unassigned";
  return label
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function truncate(text, max = 420) {
  if (!text) return "";
  const t = String(text).replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function sliceUtf8Bytes(text, start, end) {
  const buf = Buffer.from(text, "utf8");
  return buf.slice(start, end).toString("utf8");
}

function findReviewPacketPath(decision) {
  const lines = decision.technical_detail?.subtype_lines || [];
  for (const line of lines) {
    const m = line.match(/source_review_packet:\s*(.+)$/);
    if (m) return path.join(REPO, m[1].trim());
  }
  for (const p of decision.evidence_paths || []) {
    if (p.includes("review-packet")) return path.join(REPO, p);
  }
  return null;
}

function loadAgreementText(agreementId) {
  if (!agreementId) return null;
  if (textCache.has(agreementId)) return textCache.get(agreementId);
  const idxPath = path.join(M2_DIR, `${agreementId}.agreement-index.json`);
  if (!fs.existsSync(idxPath)) {
    textCache.set(agreementId, null);
    return null;
  }
  const idx = JSON.parse(fs.readFileSync(idxPath, "utf8"));
  const text = idx.source_binding?.canonical_text || null;
  textCache.set(agreementId, text);
  return text;
}

function buildOperativeIndex(neededClaimIds) {
  const needed = new Set(neededClaimIds.filter(Boolean));
  const index = new Map();
  if (!needed.size) return index;

  for (const file of fs.readdirSync(M4_DIR)) {
    if (!file.endsWith(".agreement-analysis.json")) continue;
    if (needed.size === 0) break;
    const agreementId = file.replace(".agreement-analysis.json", "");
    const m4 = JSON.parse(
      fs.readFileSync(path.join(M4_DIR, file), "utf8")
    );
    const claims = (m4.claims || []).filter((c) =>
      needed.has(c.analysis_claim_id)
    );
    if (!claims.length) continue;

    const edges = Array.isArray(m4.evidence_edges)
      ? m4.evidence_edges
      : Object.values(m4.evidence_edges || {});
    const text = loadAgreementText(agreementId);
    if (!text) continue;

    for (const claim of claims) {
      const edge =
        edges.find(
          (e) =>
            e.analysis_claim_id === claim.analysis_claim_id &&
            e.evidence_role === "OPERATIVE_TEXT"
        ) ||
        edges.find((e) => e.analysis_claim_id === claim.analysis_claim_id);
      if (!edge?.source_span) continue;
      const { start_byte, end_byte } = edge.source_span;
      index.set(claim.analysis_claim_id, {
        deal: claim.deal,
        section: claim.section_reference,
        text: truncate(sliceUtf8Bytes(text, start_byte, end_byte)),
      });
      needed.delete(claim.analysis_claim_id);
    }
  }
  return index;
}

function operativeTextForClaim(m4ClaimId) {
  if (!m4ClaimId || !operativeByClaimId) return null;
  return operativeByClaimId.get(m4ClaimId) || null;
}

function excerptFallback(decision, deal, section) {
  const excerpt = (decision.excerpts || []).find(
    (e) =>
      (e.deal || "").toLowerCase() === String(deal || "").toLowerCase() &&
      String(e.section) === String(section || "")
  );
  if (!excerpt?.text) return null;
  // Prefer a shorter window from existing board excerpts.
  return truncate(excerpt.text, 420);
}

function buildPresentation(decision, reviewPacket) {
  const items = reviewPacket?.profile_review_items || [];
  if (!items.length) return null;

  const calibrationBuckets = [
    ...new Set(items.map((i) => i.calibration_proposed_subtype).filter(Boolean)),
  ];

  const byBucket = {};
  for (const item of items) {
    const bucket =
      item.derived_classification_bucket || item.classification_path?.[1] || "";
    if (!bucket) continue;
    if (!byBucket[bucket]) {
      byBucket[bucket] = {
        label: bucket,
        plain_english: humanBucket(bucket),
        deals: new Set(),
        items: [],
      };
    }
    byBucket[bucket].deals.add((item.deal || "").toLowerCase());
    byBucket[bucket].items.push(item);
  }

  const bucketsHad = calibrationBuckets.map((label) => ({
    name: humanBucket(label),
    label,
  }));

  const bucketsToAdd = Object.values(byBucket)
    .filter((b) => !calibrationBuckets.includes(b.label))
    .sort((a, b) => a.plain_english.localeCompare(b.plain_english))
    .map((b) => {
      // Prefer a claim with m4 id so we can pull operative text.
      const preferred =
        b.items.find((i) => (i.m4_claim_ids || []).length > 0) || b.items[0];
      const m4Id = (preferred.m4_claim_ids || [])[0];
      const fromClaim = operativeTextForClaim(m4Id);
      const deal = (preferred.deal || "").replace(/^./, (c) => c.toUpperCase());
      const section = preferred.section_reference || "";
      const clauseText =
        fromClaim?.text ||
        excerptFallback(decision, preferred.deal, section) ||
        null;

      return {
        name: b.plain_english,
        label: b.label,
        deal_count: b.deals.size,
        deal_names: [...b.deals]
          .filter(Boolean)
          .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
          .sort(),
        example: {
          deal: fromClaim?.deal
            ? fromClaim.deal.charAt(0).toUpperCase() + fromClaim.deal.slice(1)
            : deal,
          section: fromClaim?.section || section,
          text: clauseText,
        },
      };
    });

  // If everything stayed in calibration buckets (no "adding"), still show
  // populated calibration buckets as "in use" with examples — Ben needs to see
  // what the split looks like. Treat populated non-calibration as adding;
  // when adding is empty, surface populated calibration buckets as the proposal.
  let proposed = bucketsToAdd;
  if (proposed.length === 0) {
    proposed = Object.values(byBucket)
      .sort((a, b) => a.plain_english.localeCompare(b.plain_english))
      .map((b) => {
        const preferred =
          b.items.find((i) => (i.m4_claim_ids || []).length > 0) || b.items[0];
        const m4Id = (preferred.m4_claim_ids || [])[0];
        const fromClaim = operativeTextForClaim(m4Id);
        const deal = (preferred.deal || "").replace(/^./, (c) =>
          c.toUpperCase()
        );
        const section = preferred.section_reference || "";
        return {
          name: b.plain_english,
          label: b.label,
          deal_count: b.deals.size,
          deal_names: [...b.deals]
            .filter(Boolean)
            .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
            .sort(),
          example: {
            deal: fromClaim?.deal
              ? fromClaim.deal.charAt(0).toUpperCase() + fromClaim.deal.slice(1)
              : deal,
            section: fromClaim?.section || section,
            text:
              fromClaim?.text ||
              excerptFallback(decision, preferred.deal, section) ||
              null,
          },
        };
      });
  }

  return {
    buckets_had: bucketsHad,
    buckets_to_add: proposed,
  };
}

function enrichDecision(decision) {
  if (decision.priority !== "review_stamp_only") {
    const { bucket_presentation, ...rest } = decision;
    return rest;
  }

  const reviewPath = findReviewPacketPath(decision);
  if (!reviewPath || !fs.existsSync(reviewPath)) {
    const { bucket_presentation, ...rest } = decision;
    return rest;
  }

  const reviewPacket = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  const presentation = buildPresentation(decision, reviewPacket);
  if (!presentation) {
    const { bucket_presentation, ...rest } = decision;
    return rest;
  }

  return { ...decision, bucket_presentation: presentation };
}

function slimDecisionForCanvas(src) {
  return {
    id: src.id,
    family_key: src.family_key,
    priority: src.priority,
    legal_question: src.legal_question,
    situation: src.situation,
    already_decided: src.already_decided,
    rows_plain: [],
    holds: src.holds ?? 0,
    affected_row_count: src.affected_row_count ?? 0,
    options: src.options,
    risks: (src.risks || []).slice(0, 2),
    related: src.related || [],
    primary_evidence: src.primary_evidence || "",
    evidence_paths: (src.evidence_paths || []).slice(0, 1),
    excerpts: [],
    bucket_presentation: src.bucket_presentation
      ? {
          buckets_had: src.bucket_presentation.buckets_had,
          buckets_to_add: src.bucket_presentation.buckets_to_add,
        }
      : undefined,
  };
}

function syncCanvas(board) {
  if (!fs.existsSync(CANVAS_PATH)) {
    console.warn("Canvas not found:", CANVAS_PATH);
    return;
  }

  let canvas = fs.readFileSync(CANVAS_PATH, "utf8");

  // Replace type block for bucket presentation.
  canvas = canvas.replace(
    /type BucketEstablished = \{[\s\S]*?type BucketPresentation = \{[\s\S]*?\};/,
    `type BucketHad = {
  name: string;
  label: string;
};

type BucketToAdd = {
  name: string;
  label: string;
  deal_count: number;
  deal_names: string[];
  example: {
    deal: string;
    section: string;
    text?: string | null;
  };
};

type BucketPresentation = {
  buckets_had: BucketHad[];
  buckets_to_add: BucketToAdd[];
};`
  );

  canvas = canvas.replace(
    /bucket_presentation\?: BucketPresentation;/,
    "bucket_presentation?: BucketPresentation;"
  );

  // Replace UI between "What is already decided" block end and risks / ruling.
  const uiStart = canvas.indexOf("<H3>What is already decided</H3>");
  const uiEnd = canvas.indexOf("{selected.risks.length > 0 ? (");
  if (uiStart < 0 || uiEnd < 0) {
    throw new Error("Could not locate canvas UI anchors to patch");
  }

  const before = canvas.slice(0, uiStart);
  const after = canvas.slice(uiEnd);
  const newUi = [
    "<H3>What is already decided</H3>",
    '      <Text tone="secondary">{selected.already_decided}</Text>',
    "",
    "      {selected.bucket_presentation ? (",
    "        <Stack gap={16}>",
    "          <Stack gap={6}>",
    "            <H3>1. Buckets we already had</H3>",
    "            {selected.bucket_presentation.buckets_had.length > 0 ? (",
    "              selected.bucket_presentation.buckets_had.map((b) => (",
    '                <Text key={b.label} size="small">',
    "                  • {b.name}",
    "                </Text>",
    "              ))",
    "            ) : (",
    '              <Text size="small" tone="secondary">',
    "                None named in calibration for this family.",
    "              </Text>",
    "            )}",
    "          </Stack>",
    "",
    "          <Stack gap={10}>",
    "            <H3>2. Buckets we want to add</H3>",
    '            <Text tone="secondary" size="small">',
    "              Each proposed bucket, with one example of the actual clause",
    "              language that drives it, and how many deals have it.",
    "            </Text>",
    "            {selected.bucket_presentation.buckets_to_add.map((b) => (",
    "              <Card key={b.label}>",
    "                <CardHeader>",
    "                  {b.name} · in {b.deal_count} deal",
    '                  {b.deal_count === 1 ? "" : "s"}',
    "                  {b.deal_names.length",
    '                    ? ` (${b.deal_names.join(", ")})`',
    '                    : ""}',
    "                </CardHeader>",
    "                <CardBody>",
    "                  <Stack gap={8}>",
    '                    <Text size="small" tone="secondary">',
    "                      Example — {b.example.deal}",
    '                      {b.example.section ? ` §${b.example.section}` : ""}',
    "                    </Text>",
    "                    {b.example.text ? (",
    "                      <Code>{b.example.text}</Code>",
    "                    ) : (",
    '                      <Text size="small" tone="secondary">',
    "                        (No operative clause text loaded for this example.)",
    "                      </Text>",
    "                    )}",
    "                  </Stack>",
    "                </CardBody>",
    "              </Card>",
    "            ))}",
    "          </Stack>",
    "        </Stack>",
    "      ) : null}",
    "",
    "      ",
  ].join("\n");

  canvas = before + newUi + after;

  // Sync decisions payload.
  const m = canvas.match(/const DECISIONS: Decision\[\] = (\[[\s\S]*?\]);/);
  if (!m) throw new Error("Could not find DECISIONS array in canvas");
  const canvasDecisions = JSON.parse(m[1]);
  const byId = new Map(board.decisions.map((d) => [d.id, d]));
  const merged = canvasDecisions.map((d) => {
    const src = byId.get(d.id);
    return src ? slimDecisionForCanvas(src) : d;
  });
  canvas = canvas.replace(
    /const DECISIONS: Decision\[\] = \[[\s\S]*?\];/,
    `const DECISIONS: Decision[] = ${JSON.stringify(merged)};`
  );

  // Drop unused helper if present.
  canvas = canvas.replace(
    /function humanBucketLabel\(label: string\): string \{[\s\S]*?\}\n\n/,
    ""
  );

  fs.writeFileSync(CANVAS_PATH, canvas);
}

function main() {
  const board = JSON.parse(fs.readFileSync(BOARD_PATH, "utf8"));

  // Collect M4 claim ids we need examples for (one per bucket per family).
  const claimIds = [];
  for (const decision of board.decisions) {
    if (decision.priority !== "review_stamp_only") continue;
    const reviewPath = findReviewPacketPath(decision);
    if (!reviewPath || !fs.existsSync(reviewPath)) continue;
    const reviewPacket = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
    const items = reviewPacket.profile_review_items || [];
    const byBucket = new Map();
    for (const item of items) {
      const bucket =
        item.derived_classification_bucket || item.classification_path?.[1];
      if (!bucket || byBucket.has(bucket)) continue;
      byBucket.set(bucket, item);
      const id = (item.m4_claim_ids || [])[0];
      if (id) claimIds.push(id);
    }
  }
  operativeByClaimId = buildOperativeIndex(claimIds);
  console.log(
    `Loaded operative text for ${operativeByClaimId.size}/${claimIds.length} example claims`
  );

  board.decisions = board.decisions.map(enrichDecision);
  board.schema_version = "N1_LEGAL_DECISIONS_BOARD_DATA/V5_SIMPLE_BUCKETS";
  fs.writeFileSync(BOARD_PATH, `${JSON.stringify(board, null, 2)}\n`);
  syncCanvas(board);

  const withBp = board.decisions.filter((d) => d.bucket_presentation).length;
  const sample = board.decisions.find(
    (d) => d.id === "consideration-legal-grouping"
  );
  console.log(`Enriched ${withBp} decisions`);
  if (sample?.bucket_presentation) {
    console.log(
      "Consideration sample:",
      JSON.stringify(sample.bucket_presentation, null, 2)
    );
  }
}

main();
