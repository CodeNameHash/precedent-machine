# Stage 2Y — Re-audit of DONE/CRITERION rows in sweep-disposition.md

Read-only audit. For each DONE/CRITERION row: asset export surface, what canonical-V2
actually `require`s from it (grep-verified), verdict (TRUE CLOSE / FALSE CLOSE /
UNVERIFIABLE), and — for FALSE CLOSE — which held reason code the unused part bears on.

Status: COMPLETE.

Summary tally (DONE + CRITERION rows in the disposition table):
- TRUE CLOSE: 20
- FALSE CLOSE: 4 (one already known: canonical-conditions.js)
- UNVERIFIABLE: 2 (rows that are pure measurements, not re-checkable by grep alone)

Two supplementary items outside the strict DONE/CRITERION scope were checked
because the brief named them explicitly ("particular care" list): they are
PLAN rows, reported for completeness, not counted in the tally above.

## Method
- `grep -rn "require.*<module>"` across lib/, scripts/, pages/, api/ to find real
  dependents, distinguished from comment mentions.
- Read the asset file directly for its full export surface (not its header comment).
- Cross-reference held reason codes list from the task brief.

---
