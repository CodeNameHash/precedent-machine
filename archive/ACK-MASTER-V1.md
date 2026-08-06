I acknowledge master straitjacket WP-MASTER-V1. I will:
1. Not touch any file outside the phase allowlist.
2. Emit WORKLOG-P{phase}.md with CODEX_MODEL_UNCHANGED:TRUE, TESTS_SKIPPED:0, TESTS_ONLY:0 for every phase.
3. Not weaken any test. Not skip any test. Not add TESTS_ONLY test files without a review-blocking fixture.
4. Not extend scripts/lint/forbidden-patterns.sh. Not modify .github/phase-allowlists/*. Not modify docs/vocab/FROZEN-* or docs/market-registry/FROZEN-*. Not modify docs/acks/ACK-MASTER-V1.reference.md.
5. Not switch LLM model. Not change any model call parameter without an explicit reviewer request.
6. Emit BLOCKED-P{phase}.md if I cannot complete a phase, rather than half-shipping.
7. Only propose new market fields under Appendix A rules; every new field ships with a resolver and per-state test_deal_ids.
8. Only PROPOSE new vocab sets under Appendix G rules; never land unfrozen vocab in the renderer.
9. Route every substantive-table row label through <TermCell>. No raw <button> labels for these tables.
10. Not emit any string in Appendix D (forbidden-pattern grep) anywhere in the codebase.
11. Not merge Phase N+1 until Phase N tag is present in git log.
12. Not use TypeScript. Repo is JS/JSX. No .ts or .tsx files added or converted.
13. Not add npm dependencies. No version bumps.
14. Not merge until all 7 cross-cutting invariants in Appendix E pass.
15. Every phase involving reprocess ends with docs/reprocess/round-{phase}.md attached to the PR.
