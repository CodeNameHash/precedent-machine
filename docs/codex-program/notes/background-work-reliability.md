# Why background queue drivers keep dying silently, and why liveness checks lied about it, 2026-08-08

Two failures, investigated separately, evidence for each below. Scratchpad
paths below are relative to
`/tmp/claude-0/-home-user-precedent-machine/3942dbbb-1014-51f3-a689-d0286bab5211/scratchpad`,
written as `$SP`.

## 1. Why the work dies

**Root cause established with certainty: this session's container was fully
rebooted, and no userspace detachment technique — not `nohup`, not `setsid`,
not `disown` — survives a full kernel reboot.** That is not a guess; it is a
kernel-level fact once a reboot is confirmed, and a reboot is confirmed below
by `/proc/uptime`, not by inference.

### The reboot is directly provable from uptime arithmetic

```
$ uptime; cat /proc/uptime
 10:26:30 up 9 min,  0 user,  load average: 0.25, 0.36, 0.22
583.58 2130.55
$ uptime -s
2026-08-08 10:16:47
```

The kernel itself has been up for 9 minutes. `/proc/uptime` is tracked by the
kernel from its own boot, not by any process — it cannot be spoofed by a
userspace restart. But `drain-progress.txt` (the queue driver's own progress
log) was last written at `09:17:30`, and `autocommit.sh`/`autocommit.log`
were both last touched at `09:11:38` — nearly an hour before the machine says
it booted:

```
$ stat -c '%n mtime=%y' $SP/drain.sh $SP/drain-progress.txt $SP/drain.log \
    $SP/autocommit.sh $SP/autocommit.log
drain.sh            mtime=2026-08-08 08:36:04
drain-progress.txt  mtime=2026-08-08 09:17:30
drain.log           mtime=2026-08-08 08:36:04   (created empty, stayed empty)
autocommit.sh       mtime=2026-08-08 09:11:38
autocommit.log      mtime=2026-08-08 09:11:38   (created empty, stayed empty)
```

Those files sit on `/dev/vda` (confirmed with `findmnt /tmp` — `/tmp` is not
a separate tmpfs, it is the same ext4 root as the repo), which is why the
scratchpad and the git history survived. The process tree did not, because
nothing survives a reboot — no journal persists either (`journalctl
--list-boots` → "No journal files were found", `journalctl -b -1` → "No
journal boot entry found"), consistent with an ephemeral guest whose kernel
log is gone the moment it restarts. This matches the system notice: *"This
session's worker process was restarted."*

`drain.log` and `autocommit.log` being empty is **not** itself evidence of a
crash — by design, `drain.sh` sends all meaningful output to per-job files
under `$SP/x/*.log` and to `drain-progress.txt`; its own top-level stdout/
stderr is expected to be silent in normal operation. Do not read an empty
`.log` file as a red flag for these two scripts specifically.

**What I could not determine:** whether the queue had already stalled for an
independent reason sometime between 09:17 and the 10:16 reboot, or was still
actively grinding through remaining items right up until the reboot ended it.
Pre-reboot `dmesg` and process state are gone with the reboot itself, and
there is no other artifact that pins down activity in that window. I looked
for OOM kills and disk exhaustion as alternative or contributing causes and
found neither: `dmesg` (this boot) has no OOM/kill entries at all; `free -h`
shows 13Gi free of 15Gi; `df -h` shows 26G available of 252G, nowhere near
the "Avail 0" signature of an exhausted per-session allowance. I am not
claiming the reboot is the *only* thing that ever went wrong in that run —
only that it is the one cause I can prove, and it is sufficient on its own to
explain total death of `drain.sh`, `autocommit.sh`, and any in-flight `node`
child, regardless of what else was or wasn't happening beforehand.

### nohup and setsid both work fine — right up until a reboot

To separate "detachment technique failed" from "the whole VM went away," I
launched two trivial heartbeat scripts (`$SP/liveness-test/heartbeat-nohup.sh`,
`heartbeat-setsid.sh`), one with plain `nohup ... &`, one with
`setsid nohup ... &` plus `disown`, each appending a timestamp every 10s, and
checked them from **separate Bash tool calls** (a fresh `/bin/bash -c` wrapper
each time, exactly how `drain.sh` was originally launched and checked) over a
five-minute span with no reboot in between:

```
t≈0s    (launch)    both pid, reparented already: nohup ppid=11234, setsid ppid=1
t≈11s   (new call)  nohup ppid=1 sid=11234 S ; setsid ppid=1 sid=11601 Ss   — both alive
t≈112s  (new call)  both alive, 12 heartbeat lines each (matches 112/10)
t≈230s  (new call)  both alive, 23 heartbeat lines each
t≈303s  (new call)  both alive, 31 heartbeat lines each
```

Both survived identically across six separate tool invocations, no data
loss, no gaps in the heartbeat file. **Conclusion: within a single boot,
`nohup` alone is already sufficient; `setsid` adds nothing observable here.**
The failure mode in this environment is not "the Bash tool's `-c` wrapper
exiting reaps its children" (it doesn't — orphans get reparented to init and
keep running, visible above) and it is not "nohup doesn't fully detach from
the controlling terminal" (there wasn't one to begin with, since these tool
calls are already non-interactive). The only thing that killed anything in
this investigation was the platform-level container restart, which no
in-guest technique can survive by construction.

## 2. Is the stdin-swallowing bug in `drain.sh` real?

**Yes, confirmed with an exact count: 2 queue items were silently dropped.**

`drain.sh`'s loop is:

```bash
while IFS='|' read -r deal fam refs; do
  ...
  ( node scripts/canonical-v2-live-extraction-run.mjs ... > "$SP/x/$deal-$fam.log" 2>&1
    ... ) &
  sleep 3
done < $SP/queue.txt
```

`node`'s stdin is never redirected, so the backgrounded subshell — and the
`node` process inside it — inherits fd 0 exactly as it stood in the parent
`while read` loop: the **same open file description** on `queue.txt`, at
whatever byte offset the loop had reached. `fork()` duplicates file
descriptors but they still share one underlying file offset; any read from
either side advances the shared position and steals bytes from the other.

### The count, from the actual incident

Comparing `queue.txt` line-by-line against `drain-progress.txt` (which pairs
are present, in what order):

```
Queue line numbers actually reflected in drain-progress.txt (38 entries): 1-37, then 40.
Missing, never appearing in drain-progress.txt at all: line 38, line 39.
  line 38: redhat|REPRESENTATIONS|3.01,3.02
  line 39: skywater|INTERIM_OPERATING|5.1,6.1
Line 40 (skywater|NO_OTHER_REPS_FRAUD) ran instead, immediately after line 37.
```

I.e. the parent loop's own `read -r` silently jumped from line 37 straight to
line 40 — two full lines vanished from the file position it was reading from,
with no error anywhere. That is precisely the shared-fd signature.

**Independent corroboration, found live, not staged:** while investigating,
I found `evidence/canonical-v2/redhat-representations-20260808-r1/` and
`evidence/canonical-v2/skywater-interim-operating-20260808-r1/` freshly
populated (mtimes `10:21`–`10:30`, i.e. *after* the reboot, and I did not
create them), and a live `node scripts/canonical-v2-live-extraction-run.mjs
--deal redhat --family REPRESENTATIONS ...` process (pid 5900) currently
running. Something else — not me, not anything I launched — is right now
manually re-running exactly the two items my forensic diff says were
skipped. That is external confirmation the same two items were identified as
missing by whoever is driving the queue now.

### Isolating the mechanism

The extraction script's only two subprocess spawns are:

```
scripts/canonical-v2-live-extraction-run.mjs:1559
  spawn('claude', [...], { stdio: ['pipe', 'pipe', 'pipe'] })   // claude -p
scripts/canonical-v2-live-extraction-run.mjs:1463
  spawnSync('git', args, { encoding: 'utf8' })                  // defaults to 'pipe' stdio too
```

Both use pipe stdio, not `'inherit'`, so neither can reach back into
`queue.txt`'s fd — Node opens fresh pipes for them. There is no
`process.stdin` reference anywhere in `scripts/canonical-v2-live-extraction-run.mjs`
or `lib/canonical-v2/` (checked with
`grep -rn "process\.stdin" scripts/ lib/canonical-v2/`, zero hits), and a
bare `node` process that touches nothing on `process.stdin` does **not**
independently consume inherited-stdin bytes — I proved this directly:

```
$ ./repro-node.sh   # identical while-read/background/concurrency-gate structure,
                     # 10-item queue, child = plain `node node-child.mjs` that
                     # never touches process.stdin at all
$ grep -c DONE progress2.txt
10   # all 10 items dispatched, nothing swallowed
```

versus the same structure with a child that performs one incidental
`read -t 1 -r line` on its inherited stdin (mimicking any component in the
process tree that reads even once), which drops exactly every other item:

```
$ ./repro.sh
$ cat progress.txt
DONE item1
DONE item3
DONE item5
DONE item7
DONE item9
COMPLETE   # items 2,4,6,8,10 silently stolen by the children's own reads
```

So the mechanism is proven in general, and proven to have actually fired in
the real run (the exact two-item gap). What I could not pin down is *which*
specific read call inside the real process tree performed the theft — it is
not in this script's own code and not in either of its two subprocess
spawns, so it is most likely inside a dependency pulled in by one of the
`require(...)` targets under `lib/canonical-v2/native-producer/`, or inside
the `claude` CLI's own startup path in some way that isn't simply "inherited
fd 0" (worth a follow-up `strace -f -e trace=read -o strace.log` on a single
non-costly dry run, which I did not do here because it would have required
running the actual extraction, which I was told not to do). Say plainly: I
did not identify the exact read call, only the exact fd-sharing mechanism
and its exact, counted effect.

## 3. A liveness check that cannot match itself

### First, the bug reproduced live, as cleanly as possible

```
$ pgrep -af 'zzz-nonexistent-marker-xyz'
32719 /bin/bash -c source ... && eval 'echo "..." pgrep -af '"'"'zzz-nonexistent-marker-xyz'"'"' ...'
```

That pattern was invented specifically to match nothing. It matched anyway —
the Bash tool wraps every command in an `eval '...'` string, and that string
contains whatever text was typed, including the search pattern itself. Any
`pgrep -f` / `ps | grep` liveness check run through this tool is checking,
in part, whether its own command line contains its own search term. It
always does.

### The fix: identity-checked PID file, never a text scan of the process table

`$SP/liveness-test/check-alive.sh`:

```bash
#!/bin/bash
# Usage: check-alive.sh <pidfile> <expected-comm>
# Exit 0 = alive, 1 = dead/absent. Never scans the whole process table for a
# text pattern, so the checking process's own argv (which the Bash tool
# wraps in an eval string containing whatever text you typed) can never
# satisfy its own condition.
pidfile="$1"; expected_comm="$2"
[ -f "$pidfile" ] || { echo "DEAD (no pidfile)"; exit 1; }
pid=$(cat "$pidfile" 2>/dev/null)
[ -n "$pid" ] && [ "$pid" -eq "$pid" ] 2>/dev/null || { echo "DEAD (bad pidfile contents)"; exit 1; }
[ -d "/proc/$pid" ] || { echo "DEAD (pid $pid not in /proc)"; exit 1; }
comm=$(cat "/proc/$pid/comm" 2>/dev/null)
state=$(cut -d' ' -f3 "/proc/$pid/stat" 2>/dev/null)
if [ "$comm" = "$expected_comm" ] && [ "$state" != "Z" ]; then
  echo "ALIVE (pid $pid, comm=$comm, state=$state)"; exit 0
elif [ "$comm" = "$expected_comm" ] && [ "$state" = "Z" ]; then
  echo "DEAD (pid $pid is a zombie -- killed, not yet reaped)"; exit 1
else
  echo "DEAD (pid $pid exists but comm='$comm' != expected '$expected_comm' -- pid reused by unrelated process)"; exit 1
fi
```

Structurally immune to self-match: it never enumerates the process table or
greps for text at all. It reads one specific PID recorded at launch time out
of a file, and checks that PID's own `/proc/<pid>/comm` (the kernel's record
of what that specific process actually is) against the expected value —
comparing two known strings, not searching arbitrary command-line text for a
substring. The checking command's own argv is irrelevant because it is never
inspected.

The zombie check earned its place empirically, not by inspection: right
after `kill -9` in the same tool call as the check, `check-alive.sh` reported
`ALIVE` — the child was dead (SIGKILL delivered) but not yet reaped by its
parent, and `/proc/<pid>/comm` still holds the old name for a zombie. Adding
the `stat` field-3 check (`Z` = zombie) fixed it; a follow-up call after the
parent had a chance to reap confirmed fully gone.

### All four required cases, each demonstrated, not reasoned about

Setup: `$SP/liveness-test/fake-drain.sh` (a stand-in long-running job,
`sleep 6000`), whose kernel `comm` is exactly `fake-drain.sh` (verified via
`cat /proc/$PID/comm`).

**(a) target running:**
```
$ nohup ./fake-drain.sh & echo $! > fake-drain.pid
$ ./check-alive.sh fake-drain.pid fake-drain.sh
ALIVE (pid 23328, comm=fake-drain.sh, state=S)      exit=0   ✓ correct
```

**(b) target dead** (killed, reaping confirmed, checked from a fresh tool call):
```
$ kill -9 23328 ; sleep 3 ; [ -d /proc/23328 ] && echo alive || echo "fully gone"
fully gone
$ ./check-alive.sh fake-drain.pid fake-drain.sh
DEAD (pid 23328 not in /proc)                        exit=1   ✓ correct
```

**(c) target dead, but a shell whose argv literally contains the search
pattern is running at the same time** (the exact trap from the real
incident, reproduced on purpose):
```
$ nohup bash -c 'echo "... mentions fake-drain.sh"; sleep 120' &   # decoy
$ pgrep -fc 'fake-drain.sh'
1        # OLD check: reports "alive" — pure self-match on the decoy's own argv text
$ ./check-alive.sh fake-drain.pid fake-drain.sh    # fake-drain.pid still points at the dead pid 23328
DEAD (pid 23328 not in /proc)                        exit=1   ✓ correct despite the decoy
```

**(d) a same-named but genuinely unrelated process running:**
```
$ (cd unrelated-dir && nohup ./fake-drain.sh &)     # different file, different job, same basename
$ pgrep -fc 'fake-drain.sh'
2        # OLD check: counts the unrelated process, would misreport OUR job as alive
$ ./check-alive.sh fake-drain.pid fake-drain.sh     # OUR job's pidfile, still = dead pid 23328
DEAD (pid 23328 not in /proc)                        exit=1   ✓ correct — distinguishes by identity, not name
$ ./check-alive.sh unrelated.pid fake-drain.sh      # for contrast: the unrelated job's own pidfile
ALIVE (pid 24779, comm=fake-drain.sh, state=S)       exit=0   ✓ correctly alive on its own terms
```

All four states confirmed. The old `pgrep -fc` / `ps | grep -c` checks were
wrong (or right for the wrong reason) in three of the four; the PID-file +
`/proc/<pid>/comm` + zombie-state check was correct in all four.

## 4. Recommended pattern for driving a 69-item queue of ~5-minute jobs here

Given what the evidence actually shows:

- `nohup`/`setsid` background jobs are reliable **within a boot** — proven
  over 300+ seconds across six independent tool calls with zero loss. They
  are not the problem and do not need to be replaced with foreground
  driving.
- A full container restart is possible, has happened at least once this
  session, is outside guest control, gives no advance warning, and kills
  every process unconditionally, no matter how it was detached. There is no
  way to make a background job survive one. The only available strategy is
  to make restart **cheap to recover from**, not to make the job
  reboot-proof (that isn't achievable).
- The stdin-sharing bug is real and will silently drop items again under any
  concurrency-with-unredirected-child pattern, independent of the reboot
  question.

So: **keep driving it from the background with `nohup`, but make every part
of the pipeline safe to interrupt and safe to re-launch blindly:**

1. **Fix the stdin bug at the source.** Give every backgrounded child an
   explicit stdin, not the inherited one: `node ... < /dev/null > log 2>&1 &`.
   This alone removes the entire class of shared-fd corruption regardless of
   what, deep in the dependency tree, ever reads from fd 0.
2. **Make progress durable and resumable, not append-only-and-trust.**
   `drain.sh` already skips work whose output directory exists
   (`[ -f "$out/adapter-result.json" ] && continue`) — keep that; it is
   exactly what makes "just re-run the whole driver after a restart" safe
   and cheap, since completed items cost nothing to re-check.
3. **Never depend on a live `pgrep`/`ps` text scan for "is this still
   running,"** for the exact reason established in section 3 — write a PID
   file at launch and check identity via `/proc/<pid>/comm`, from a
   *different, later* tool call, not by pattern-matching the process table.
4. **Add a heartbeat file the driver updates every completed item (or every
   N seconds), not just a completion marker at the very end.** The current
   `drain.sh` only ever announces success (`DRAIN_COMPLETE`) or is silently
   gone; there is no way to tell "still working on item 45" from "died after
   item 38" without doing the same line-by-line forensic diff this note just
   did by hand. A one-line heartbeat timestamp, checked against wall-clock
   age, turns "is it dead" into a five-second check instead of a forensic
   reconstruction.
5. **After any detected death (stale heartbeat + failed liveness check),
   re-launch is a no-op operation**: same command, same skip-on-existing-
   output logic, no manual bookkeeping of "where did it get to." That
   property, not any particular detachment flag, is what actually makes a
   69-item / ~5-minute-per-item queue survivable in an environment where the
   host can restart the guest without notice.

If restarts turn out to be frequent enough that losing up to ~4 items of
in-flight work (concurrency level) per restart is unacceptable, the
foreground alternative — driving N items per turn, checked in after each
batch — trades throughput for a human/agent actually watching the restart
happen and reacting immediately, at the cost of requiring continuous
attention for the whole 69-item run. Given restarts have been infrequent (one
in this session, of unknown periodicity) and the resumable-background pattern
above bounds the damage from any single restart to the concurrency window,
background driving with the fixes above is the better trade unless restarts
turn out to be much more frequent than observed so far.

## Artifacts from this investigation

- `$SP/liveness-test/heartbeat-nohup.sh`, `heartbeat-setsid.sh` — the
  detachment-survival experiment (killed and cleaned up after use).
- `$SP/liveness-test/check-alive.sh` — the self-match-proof liveness checker.
- `$SP/liveness-test/fake-drain.sh`, `unrelated-dir/fake-drain.sh` — the
  fixtures used for the four liveness-check cases (killed and cleaned up).
- `$SP/liveness-test/stdin-repro/repro.sh`, `repro-node.sh` — the minimal
  reproductions isolating the stdin-swallow mechanism (bash-child version
  drops items, bare-node-child version does not).
- `$SP/drain-v2.sh` — corrected driver (not launched; see rules).
