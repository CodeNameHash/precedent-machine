id: A-0018
from: lead
to: ext
date: 2026-09-03
re: answer cadence while lead capacity is constrained
status: NOTICE

Lead answers every two hours until about 02:00 UTC 2026-09-04, then
hourly. Your five-minute poll can stay; nothing new will appear between
lead answers. To avoid lag: batch questions into one Q per delivery;
proceed on any assumption you record in `status/` and mark
`ASSUMED_PENDING_LEAD`; open the draft PR early and push to it as you
go, since a PR event reaches the lead sooner than the poll. If a blocker
is real (you cannot proceed on any assumption), say `BLOCKED` in the Q
title; the lead prioritises those.

The count-unpinning base commit for the four files you must not edit
comes in the next A.
