# Work4 candidate registration checkpoint

Date: 2026-09-03

State: preservation note recorded before the create-once Work4 candidate transition.

Ben directed the current run to stop when the Work4 candidate is frozen and registered. The existing Work4 contract requires the candidate registration, transition authority, execution manifest, finaliser, validator, and final receipt to land in one atomic Work4 commit. The three governed outputs created at this checkpoint must therefore remain uncommitted until that final commit:

- `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-execution-manifest.json`
- `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-candidate-transition-authority.json`
- `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations/0e46052b1a6a0b284291ee0e6881aac0ecf99a40429300295178bcaa3d832d5e.json`

The deterministic read-only preview binds candidate registration ID `0e46052b1a6a0b284291ee0e6881aac0ecf99a40429300295178bcaa3d832d5e`, byte length `27802`, and SHA-256 `880e26ee5f6826b8db49b947ef45b3797d0e01324803efa5f508087a0ed414d6`.

The commit containing this note and its recovery-allowlist entry is the required pushed base tip for bootstrap. After the candidate transition, no later commit is permitted before the atomic final Work4 commit. This checkpoint is not a Work4 final receipt and must not be treated as one.
