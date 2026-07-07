# Admin Surface Map

This file maps the current admin pages, API routes, and admin components.

## registry

Registry: Review canonical schema fields, vocabularies, merge candidates, and freeze readiness.

## registry-audit

Audit: Inspect the Phase 0-C audit matrix and evidence behind populated canonical cells.

## registry-reconcile

Reconcile: Resolve canonical registry reconciliation queue items with reviewer decisions.

## reconciliation-dropped

Dropped reconciliation: Inspect moved or dropped reconciliation entries from the approved downstream cleanup.

## reconciliation-deferred

Deferred reconciliation: Inspect schema-deferred reconciliation entries grouped by their downstream unblocker.

## taxonomy

Taxonomy: Read the provision taxonomy source and inspect live corpus counts by taxonomy node.

## processing-flow

Processing flow: Read the ingest-to-Claim flow and inspect live pipeline metrics and gap follow-ups.

## schema-loss

Schema loss audit: Review uncovered text and suspect Claims, then route each item to the correct downstream queue.

## review-queue

Review queue: Resolve Ben-gated canonical, destructive, unfreeze, and clarification decisions.

## agreements

Upload agreements: Upload source agreements into the ingestion workflow.

## candidates

Deal candidates: Review EDGAR-discovered deal candidates before promotion into the corpus.

## ingest-runs

Ingest runs: Monitor ingestion runs, statuses, and batch-level processing output.

## gaps

Gap review: Review extraction coverage gaps and route follow-up work.

## search-review

Search / Review: Return to the main deal search and review workspace.

## API: pages/api/admin/audit/decision.js

Serves the admin route `/api/admin/audit/decision` for the admin workflow associated with its filename.

## API: pages/api/admin/audit/freeze.js

Serves the admin route `/api/admin/audit/freeze` for the admin workflow associated with its filename.

## API: pages/api/admin/audit/matrix.js

Serves the admin route `/api/admin/audit/matrix` for the admin workflow associated with its filename.

## API: pages/api/admin/candidates.js

Serves the admin route `/api/admin/candidates` for the admin workflow associated with its filename.

## API: pages/api/admin/check-agreement-duplicate.js

Serves the admin route `/api/admin/check-agreement-duplicate` for the admin workflow associated with its filename.

## API: pages/api/admin/find-deal.js

Serves the admin route `/api/admin/find-deal` for the admin workflow associated with its filename.

## API: pages/api/admin/gaps.js

Serves the admin route `/api/admin/gaps` for the admin workflow associated with its filename.

## API: pages/api/admin/ingest-batch.js

Serves the admin route `/api/admin/ingest-batch` for the admin workflow associated with its filename.

## API: pages/api/admin/ingest-runs.js

Serves the admin route `/api/admin/ingest-runs` for the admin workflow associated with its filename.

## API: pages/api/admin/parse-files.js

Serves the admin route `/api/admin/parse-files` for the admin workflow associated with its filename.

## API: pages/api/admin/parse-pdf.js

Serves the admin route `/api/admin/parse-pdf` for the admin workflow associated with its filename.

## API: pages/api/admin/reconcile/decide.js

Serves the admin route `/api/admin/reconcile/decide` for the admin workflow associated with its filename.

## API: pages/api/admin/reconcile/queue.js

Serves the admin route `/api/admin/reconcile/queue` for the admin workflow associated with its filename.

## API: pages/api/admin/reconcile/split.js

Serves the admin route `/api/admin/reconcile/split` for the admin workflow associated with its filename.

## API: pages/api/admin/registry/decision.js

Serves the admin route `/api/admin/registry/decision` for the admin workflow associated with its filename.

## API: pages/api/admin/registry/freeze.js

Serves the admin route `/api/admin/registry/freeze` for the admin workflow associated with its filename.

## API: pages/api/admin/registry/preview.js

Serves the admin route `/api/admin/registry/preview` for the admin workflow associated with its filename.

## API: pages/api/admin/reprocess-cond.js

Serves the admin route `/api/admin/reprocess-cond` for the admin workflow associated with its filename.

## API: pages/api/admin/schema-loss/decide.js

Serves the admin route `/api/admin/schema-loss/decide` for schema-loss reviewer decisions.

## API: pages/api/admin/schema-loss/queue.js

Serves the admin route `/api/admin/schema-loss/queue` for Dimension A and Dimension B queues.

## API: pages/api/admin/schema-loss/rerun.js

Serves the admin route `/api/admin/schema-loss/rerun` for manual audit re-runs.

## API: pages/api/admin/store-agreement.js

Serves the admin route `/api/admin/store-agreement` for the admin workflow associated with its filename.

## Component: components/admin/AdminNav.js

Provides the `AdminNav` admin UI component used by the admin pages or reviewer flows.

## Component: components/admin/audit/AuditCellDrawer.jsx

Provides the `AuditCellDrawer` admin UI component used by the admin pages or reviewer flows.

## Component: components/admin/audit/AuditMatrix.jsx

Provides the `AuditMatrix` admin UI component used by the admin pages or reviewer flows.

## Component: components/admin/reconcile/CrossDealPreview.jsx

Provides the `CrossDealPreview` admin UI component used by the admin pages or reviewer flows.

## Component: components/admin/reconcile/EntryPane.jsx

Provides the `EntryPane` admin UI component used by the admin pages or reviewer flows.

## Component: components/admin/reconcile/MergeTargetInspector.jsx

Provides the `MergeTargetInspector` admin UI component used by the admin pages or reviewer flows.

## Component: components/admin/reconcile/QueueSidebar.jsx

Provides the `QueueSidebar` admin UI component used by the admin pages or reviewer flows.

## Component: components/admin/reconcile/SplitFlow.jsx

Provides the `SplitFlow` admin UI component used by the admin pages or reviewer flows.

## Component: components/admin/schema-loss/ClusterPane.jsx

Provides the `ClusterPane` admin UI component for Dimension A uncovered-text entries.

## Component: components/admin/schema-loss/DecisionRouter.jsx

Provides the `DecisionRouter` admin UI component for schema-loss reviewer routing.

## Component: components/admin/schema-loss/IntegrityWarningPane.jsx

Provides the `IntegrityWarningPane` admin UI component for Dimension B suspect Claims.

## Component: components/admin/schema-loss/ProvisionViewer.jsx

Provides the `ProvisionViewer` admin UI component shared by both schema-loss tabs.

## Component: components/admin/schema-loss/QueueSidebar.jsx

Provides the `QueueSidebar` admin UI component for schema-loss queue selection.

## Component: components/admin/schema-loss/ResidualHighlighter.jsx

Provides the `ResidualHighlighter` admin UI component for uncovered-text samples.

## Component: components/admin/registry/FlagBadge.jsx

Provides the `FlagBadge` admin UI component used by the admin pages or reviewer flows.

## Component: components/admin/registry/RegistryCard.jsx

Provides the `RegistryCard` admin UI component used by the admin pages or reviewer flows.

## Component: components/admin/registry/RegistryMergeBoard.jsx

Provides the `RegistryMergeBoard` admin UI component used by the admin pages or reviewer flows.

## Component: components/admin/registry/RegistrySidebar.jsx

Provides the `RegistrySidebar` admin UI component used by the admin pages or reviewer flows.
