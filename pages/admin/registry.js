import fs from 'fs';
import path from 'path';
import { useMemo, useState } from 'react';
import { useUser } from '../../lib/useUser';
import { Breadcrumbs } from '../../components/UI';
import AdminNav from '../../components/admin/AdminNav';
import RegistryCard from '../../components/admin/registry/RegistryCard';
import RegistrySidebar from '../../components/admin/registry/RegistrySidebar';
import FlagBadge from '../../components/admin/registry/FlagBadge';

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function vocabFiles() {
  const dir = path.join(process.cwd(), 'docs/vocab');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json') || name.endsWith('.md'))
    .sort()
    .map((name) => ({ name, status: name.includes('frozen') ? 'FROZEN' : 'PROPOSED' }));
}

function valueList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function matchesFilter(field, active) {
  if (active === 'ALL') return true;
  if (active === 'FLAGGED') return field.review_flag === 'REQUIRES_REVIEWER_DECISION';
  const direct = valueList(field.applies_to).includes(active)
    || field.provision_type === active
    || field.provision_code === active;
  if (direct) return true;
  return valueList(field.also_matches_provision_codes).some((code) => code === active || code.startsWith(`${active}-`));
}

function counts(fields, decisions) {
  const decided = fields.filter((field) => decisions[field.key]?.decision);
  return {
    total: fields.length,
    approved: decided.filter((field) => decisions[field.key].decision === 'approve').length,
    rejected: decided.filter((field) => decisions[field.key].decision === 'reject').length,
    flagged: fields.filter((field) => field.review_flag === 'REQUIRES_REVIEWER_DECISION').length,
    pending: fields.length - decided.length,
  };
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export default function RegistryAdmin({ registry, initialDecisions, provisionTypes, vocab }) {
  useUser({ redirectTo: '/login' });
  const [active, setActive] = useState('FLAGGED');
  const [decisions, setDecisions] = useState(initialDecisions || {});
  const [pendingOnly, setPendingOnly] = useState(false);
  const [dealId, setDealId] = useState('');
  const [status, setStatus] = useState(null);
  const fields = registry.fields || [];
  const summary = counts(fields, decisions);
  const filteredFields = useMemo(() => {
    if (active === 'VOCAB') return [];
    return fields
      .filter((field) => matchesFilter(field, active))
      .filter((field) => !pendingOnly || !decisions[field.key]?.decision);
  }, [active, decisions, fields, pendingOnly]);

  async function saveDecision(payload) {
    const data = await postJson('/api/admin/registry/decision', payload);
    setDecisions(data.state.decisions || {});
    setStatus({ ok: true, message: `${payload.key}: ${payload.decision}` });
  }

  async function freezeRegistry() {
    setStatus(null);
    try {
      const data = await postJson('/api/admin/registry/freeze', {});
      setStatus({ ok: true, message: `Frozen ${data.field_count} fields` });
    } catch (error) {
      setStatus({ ok: false, message: error.message });
    }
  }

  async function previewField(key) {
    const params = new URLSearchParams({ key });
    if (dealId) params.set('deal_id', dealId);
    const response = await fetch(`/api/admin/registry/preview?${params.toString()}`);
    return response.json();
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-6 text-ink md:px-8">
      <div className="mx-auto max-w-7xl">
        <Breadcrumbs items={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { label: 'Registry' }]} />
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ink">Registry</h1>
            <AdminNav className="mt-3" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FlagBadge value="PENDING_REVIEW" />
            <span className="text-xs font-ui text-inkLight">{summary.pending} pending</span>
            <button
              data-testid="freeze-registry"
              type="button"
              disabled={summary.pending > 0}
              onClick={freezeRegistry}
              className="rounded bg-accent px-3 py-2 text-xs font-ui text-white hover:bg-accent/90 disabled:opacity-40"
            >
              Freeze registry
            </button>
          </div>
        </div>

        <section className="mt-6 grid gap-3 md:grid-cols-5">
          {[
            ['Total', summary.total],
            ['Flagged', summary.flagged],
            ['Pending', summary.pending],
            ['Approved', summary.approved],
            ['Rejected', summary.rejected],
          ].map(([label, value]) => (
            <div key={label} className="rounded border border-border bg-white p-3">
              <div className="text-[10px] font-ui uppercase tracking-wide text-inkFaint">{label}</div>
              <div className="mt-1 font-display text-2xl text-ink">{value}</div>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <RegistrySidebar
            active={active}
            fields={fields}
            provisionTypes={provisionTypes}
            vocabCount={vocab.length}
            onSelect={setActive}
          />
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-white p-3">
              <label className="flex items-center gap-2 text-xs font-ui text-inkLight">
                <input
                  type="checkbox"
                  checked={pendingOnly}
                  onChange={(event) => setPendingOnly(event.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent"
                />
                Pending only
              </label>
              <label className="flex items-center gap-2 text-xs font-ui text-inkLight">
                Deal ID
                <input
                  value={dealId}
                  onChange={(event) => setDealId(event.target.value)}
                  className="w-64 rounded border border-border bg-white px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </label>
              {status?.message && (
                <span className={`text-xs font-ui ${status.ok ? 'text-buyer' : 'text-seller'}`}>{status.message}</span>
              )}
            </div>

            {active === 'VOCAB' ? (
              <div className="rounded border border-border bg-white p-4">
                <h2 className="font-display text-xl text-ink">VOCAB</h2>
                <div className="mt-3 divide-y divide-border">
                  {vocab.length ? vocab.map((item) => (
                    <div key={item.name} className="flex items-center justify-between py-3 text-sm">
                      <span>{item.name}</span>
                      <FlagBadge value={item.status} />
                    </div>
                  )) : (
                    <div className="py-3 text-sm text-inkLight">No vocab files</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredFields.map((field) => (
                  <RegistryCard
                    key={field.key}
                    field={field}
                    decision={decisions[field.key]}
                    onDecision={saveDecision}
                    onPreview={previewField}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export async function getStaticProps() {
  const { PROVISION_TYPES } = require('../../lib/rubric');
  const registry = readJson(path.join(process.cwd(), 'docs/market-registry/generated-v1.deduped.json'), { fields: [] });
  const state = readJson(path.join(process.cwd(), 'docs/market-registry/reviewer-state.json'), { decisions: {} });
  return {
    props: {
      registry,
      initialDecisions: state.decisions || {},
      provisionTypes: PROVISION_TYPES,
      vocab: vocabFiles(),
    },
  };
}
