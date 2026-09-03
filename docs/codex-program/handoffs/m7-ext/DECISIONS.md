# Decisions applying to every external workstream

- 2026-09-03: Ben adopted option (b) for the manifest validator Git-observation policy gap: a Git-permitted caller passes the base-tip observation into the validator as data, at Work 5. Lead implements; not an ext workstream.
- 2026-09-03: Work4 candidate correction adopted by Ben (recovery branch commit `d98ddf4c`, DECISIONS.md #25). Registration `0e46052b…` is superseded; a successor with a new ID follows in the next Lead commit. Ext tools must select the registration explicitly (path, or via the manifest of record), never by discovery or a default ID, and must accept the V2 Work4 receipt. Details in `outbox/A-0001-kickoff.md`.
