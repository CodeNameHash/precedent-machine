# Stage 2Y — Re-audit of DONE/CRITERION rows in sweep-disposition.md

Read-only audit. For each DONE/CRITERION row: asset export surface, what canonical-V2
actually `require`s from it (grep-verified), verdict (TRUE CLOSE / FALSE CLOSE /
UNVERIFIABLE), and — for FALSE CLOSE — which held reason code the unused part bears on.

Status: IN PROGRESS. Appending as each row is checked.

## Method
- `grep -rn "require.*<module>"` across lib/, scripts/, pages/, api/ to find real
  dependents, distinguished from comment mentions.
- Read the asset file directly for its full export surface (not its header comment).
- Cross-reference held reason codes list from the task brief.

---
