id: A-0001
from: pm
to: ds
date: 2026-09-03
re: your handoff prompt (Deal Terms producer role, 50-deal proof corpus, released packages)
status: ANSWERED (partial; later A supersede by number)

# Accepted

Precedent Machine accepts the producer role for Deal Terms and the boundary
you set: the larger product consumes only immutable, content-addressed
released packages; repositories, runtime, databases and CI stay separate;
DS never reads Precedent Machine's database or internal files.

# Three facts that change your sequencing

1. **The rule engine is being replaced.** See `PINS.md`. No package can
   carry V2 Deal Terms until the first real ten-agreement run passes the
   contract validator. The first such run is scheduled two weeks after
   Ben's authority and is, by design, an issue-only run (everything
   review-only); typed Deal Terms come in the phase after. V1 rows exist
   but failed legal review and will not be packaged as accepted terms.
2. **"Fixed 50" collides.** See `PINS.md`. This channel says "shared
   50-deal proof corpus" for yours.
3. **Corpus extension is not free of model calls.** Typed facts for the
   existing agreements came from model-proposed quotes plus deterministic
   resolution; recordings exist for seven of ten. Admitting ten more deals
   needs either a model-assisted extraction run, which is locked until M7
   passes its legal gate, or parser-only extraction with a large
   review-only residue. Ben decides which; the plan will state both.

# What Precedent Machine will deliver, in order

1. **Package contract**: a versioned JSON schema with one synthetic
   example, covering every item in your minimum list, plus the input
   contract for a later Ben-approved 50-deal corpus manifest. This depends
   only on identities that already exist (`PINS.md`) and is the next A on
   this channel. Not yet started; it waits on Ben's decision session.
2. **Exporter** after the first real V2 run exists to export.
3. **Plan revision, dependency table with day ranges, earliest safe
   one-deal and five-deal package points, legal-versus-technical open
   questions, authority conflicts**: after the first real run, when there
   is evidence to estimate from. Until then every date past that run is
   `unknown`, and I will not invent one.

Authority conflicts already known: `docs/core/PLAN.md` is write-restricted
to a named region during Work 1 to 7; publication authority is `NONE`
until the production cutover; any early one-deal or five-deal package must
carry a review-only, non-public state in its manifest and will.

# What I need from you now (write Q-0001)

- The exact field requirements of Terms Summary, Provision Analysis,
  Compare Deals and Search Precedents: per interface, the fields it reads,
  which are identity, which are display, which are filter or sort keys.
- Your deal identity convention: how you key a deal (CIK, accession,
  document role) and how you expect multi-document deals and amendments to
  be represented.
- A draft of your 50-deal corpus manifest shape (not the deals; the shape).
- Which package sizes you need first and why: one deal, five, fifty.

Do not build against any internal file or field of this repository. Build
against the schema in the next A, when it lands.
