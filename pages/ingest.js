import { useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../lib/useUser';
import { useToast } from '../lib/useToast';
import { Breadcrumbs } from '../components/UI';

const PROVISION_TYPES = ['MAE', 'IOC'];

function ProvisionEntry({ index, provision, onChange, onRemove, canRemove }) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-bg/30">
      <div className="flex items-center justify-between">
        <span className="font-ui text-sm font-medium text-inkMid">Provision {index + 1}</span>
        {canRemove && (
          <button onClick={onRemove} className="text-xs font-ui text-seller hover:underline">Remove</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-ui text-inkLight mb-1 block">Type *</label>
          <select value={provision.type} onChange={e => onChange({ ...provision, type: e.target.value })}
            className="w-full border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white">
            {PROVISION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-ui text-inkLight mb-1 block">Category</label>
          <input value={provision.category} onChange={e => onChange({ ...provision, category: e.target.value })}
            placeholder="e.g. General MAE Definition"
            className="w-full border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
        </div>
      </div>

      <div>
        <label className="text-xs font-ui text-inkLight mb-1 block">
          Full Provision Text *
          <span className="text-inkFaint ml-1">(immutable after save)</span>
        </label>
        <textarea value={provision.full_text} onChange={e => onChange({ ...provision, full_text: e.target.value })}
          rows={8}
          placeholder="Paste the full provision text exactly as it appears in the agreement…"
          className="w-full border border-border rounded px-3 py-2 text-sm font-body leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent resize-y" />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] font-ui text-inkFaint">
            {provision.full_text.length > 0 ? `${provision.full_text.split(/\s+/).filter(Boolean).length} words` : ''}
          </span>
        </div>
      </div>

      <div>
        <label className="text-xs font-ui text-inkLight mb-1 block">Prohibition Summary (optional)</label>
        <input value={provision.prohibition} onChange={e => onChange({ ...provision, prohibition: e.target.value })}
          placeholder="Brief description of what is prohibited"
          className="w-full border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
      </div>
    </div>
  );
}

export default function Ingest() {
  const router = useRouter();
  const { user } = useUser({ redirectTo: '/login' });
  const { addToast } = useToast();

  const [step, setStep] = useState(1); // 1 = deal info, 2 = provisions, 3 = review
  const [submitting, setSubmitting] = useState(false);
  const [createdDealId, setCreatedDealId] = useState(null);

  // Deal form
  const [deal, setDeal] = useState({
    acquirer: '', target: '', value_usd: '', announce_date: '', sector: '',
  });

  // Provisions
  const emptyProvision = () => ({ type: 'MAE', category: '', full_text: '', prohibition: '' });
  const [provisions, setProvisions] = useState([emptyProvision()]);

  const updateProvision = (i, updated) => {
    setProvisions(prev => prev.map((p, idx) => idx === i ? updated : p));
  };
  const removeProvision = (i) => {
    setProvisions(prev => prev.filter((_, idx) => idx !== i));
  };
  const addProvision = () => {
    setProvisions(prev => [...prev, emptyProvision()]);
  };

  // Validation
  const dealValid = deal.acquirer.trim() && deal.target.trim();
  const provisionsValid = provisions.every(p => p.type && p.full_text.trim().length > 20);
  const hasProvisions = provisions.some(p => p.full_text.trim().length > 0);

  // Submit
  const handleSubmit = async () => {
    if (!dealValid || !provisionsValid) return;
    setSubmitting(true);

    try {
      // 1. Create deal
      const dealResp = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acquirer: deal.acquirer.trim(),
          target: deal.target.trim(),
          value_usd: deal.value_usd ? parseFloat(deal.value_usd) : null,
          announce_date: deal.announce_date || null,
          sector: deal.sector.trim() || null,
          created_by: user?.id,
        }),
      });
      const dealData = await dealResp.json();
      if (dealData.error) throw new Error(dealData.error);
      const newDealId = dealData.deal.id;
      setCreatedDealId(newDealId);

      // 2. Create provisions
      let created = 0;
      const createdProvisions = [];
      for (const prov of provisions) {
        if (!prov.full_text.trim()) continue;
        const provResp = await fetch('/api/provisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deal_id: newDealId,
            type: prov.type,
            category: prov.category.trim() || null,
            full_text: prov.full_text.trim(),
            prohibition: prov.prohibition.trim() || null,
          }),
        });
        const provData = await provResp.json();
        if (provData.error) throw new Error(provData.error);
        createdProvisions.push({ id: provData.provision.id, text: prov.full_text.trim(), type: prov.type, category: prov.category.trim() || null });
        created++;
      }

      // 3. Fire-and-forget AI annotation for each provision
      createdProvisions.forEach(cp => {
        fetch('/api/ai/annotate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provision_id: cp.id, text: cp.text, type: cp.type, category: cp.category }),
        }).then(r => r.json()).then(data => {
          if (data.annotations && data.annotations.length > 0) {
            data.annotations.forEach(ann => {
              fetch('/api/annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  provision_id: cp.id, phrase: ann.phrase, start_offset: ann.start_offset,
                  end_offset: ann.end_offset, favorability: ann.favorability, note: ann.note, is_ai_generated: true,
                }),
              }).catch(e => console.error('Failed to save annotation:', e));
            });
          }
        }).catch(e => console.error('AI annotate failed for provision:', cp.id, e));
      });

      addToast(`Deal created with ${created} provision${created !== 1 ? 's' : ''}`, 'success');
      setStep(3);
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    }

    setSubmitting(false);
  };

  // Reset for another deal
  const handleAddAnother = () => {
    setDeal({ acquirer: '', target: '', value_usd: '', announce_date: '', sector: '' });
    setProvisions([emptyProvision()]);
    setCreatedDealId(null);
    setStep(1);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Ingest Deal' }]} />

      <div>
        <h1 className="font-display text-2xl text-ink">Ingest Precedent Deal</h1>
        <p className="text-sm text-inkLight font-ui mt-1">
          Add a deal and its provisions. Provision text is locked once saved — enrichment happens through annotations.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs font-ui">
        {['Deal Info', 'Provisions', 'Done'].map((label, i) => {
          const num = i + 1;
          const active = step === num;
          const done = step > num;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <span className="text-inkFaint">→</span>}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
                active ? 'bg-accent text-white' : done ? 'bg-buyer/10 text-buyer' : 'bg-bg text-inkFaint'
              }`}>
                {done ? '✓' : num}. {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step 1: Deal Info */}
      {step === 1 && (
        <div className="bg-white border border-border rounded-lg shadow-sm p-6 space-y-4">
          <h2 className="font-display text-lg text-ink">Deal Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-ui text-inkLight mb-1 block">Acquirer *</label>
              <input value={deal.acquirer} onChange={e => setDeal(d => ({ ...d, acquirer: e.target.value }))}
                placeholder="e.g. Pfizer Inc."
                className="w-full border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div>
              <label className="text-xs font-ui text-inkLight mb-1 block">Target *</label>
              <input value={deal.target} onChange={e => setDeal(d => ({ ...d, target: e.target.value }))}
                placeholder="e.g. Seagen Inc."
                className="w-full border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div>
              <label className="text-xs font-ui text-inkLight mb-1 block">Deal Value (USD)</label>
              <input value={deal.value_usd} onChange={e => setDeal(d => ({ ...d, value_usd: e.target.value }))}
                type="number" placeholder="e.g. 43000000000"
                className="w-full border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
              {deal.value_usd && (
                <span className="text-[10px] font-ui text-inkFaint mt-0.5 block">
                  ${(parseFloat(deal.value_usd) / 1e9).toFixed(2)}B
                </span>
              )}
            </div>
            <div>
              <label className="text-xs font-ui text-inkLight mb-1 block">Announce Date</label>
              <input value={deal.announce_date} onChange={e => setDeal(d => ({ ...d, announce_date: e.target.value }))}
                type="date"
                className="w-full border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-ui text-inkLight mb-1 block">Sector</label>
              <input value={deal.sector} onChange={e => setDeal(d => ({ ...d, sector: e.target.value }))}
                placeholder="e.g. Biopharma, Technology, Financial Services"
                className="w-full border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={() => setStep(2)} disabled={!dealValid}
              className="px-5 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 transition-colors">
              Next: Add Provisions →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Provisions */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Deal summary */}
          <div className="bg-white border border-border rounded-lg shadow-sm p-4 flex items-center justify-between">
            <div>
              <span className="font-ui text-sm font-medium text-ink">{deal.acquirer} / {deal.target}</span>
              <span className="text-xs text-inkFaint font-ui ml-3">
                {[deal.sector, deal.value_usd ? `$${(parseFloat(deal.value_usd) / 1e9).toFixed(1)}B` : null, deal.announce_date].filter(Boolean).join(' · ')}
              </span>
            </div>
            <button onClick={() => setStep(1)} className="text-xs font-ui text-accent hover:underline">Edit</button>
          </div>

          <div className="bg-white border border-border rounded-lg shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">Provisions</h2>
              <button onClick={addProvision}
                className="px-3 py-1.5 text-sm font-ui border border-border rounded hover:border-accent transition-colors">
                + Add Provision
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <p className="text-xs font-ui text-amber-800">
                Paste provision text exactly as it appears in the merger agreement. Text becomes immutable after save — all enrichment (categorization, favorability, key phrases) happens through annotations and AI tools.
              </p>
            </div>

            <div className="space-y-4">
              {provisions.map((prov, i) => (
                <ProvisionEntry key={i} index={i} provision={prov}
                  onChange={updated => updateProvision(i, updated)}
                  onRemove={() => removeProvision(i)}
                  canRemove={provisions.length > 1} />
              ))}
            </div>

            <div className="flex justify-between pt-2 border-t border-border">
              <button onClick={() => setStep(1)}
                className="px-4 py-2 text-sm font-ui border border-border rounded hover:bg-bg transition-colors">
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={submitting || !provisionsValid || !hasProvisions}
                className="px-5 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 transition-colors">
                {submitting ? 'Saving…' : `Save Deal + ${provisions.filter(p => p.full_text.trim()).length} Provision${provisions.filter(p => p.full_text.trim()).length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && (
        <div className="bg-white border border-border rounded-lg shadow-sm p-8 text-center space-y-4">
          <div className="text-4xl">✓</div>
          <h2 className="font-display text-xl text-ink">Deal Ingested</h2>
          <p className="text-sm text-inkLight font-ui">
            <strong>{deal.acquirer} / {deal.target}</strong> with {provisions.filter(p => p.full_text.trim()).length} provision{provisions.filter(p => p.full_text.trim()).length !== 1 ? 's' : ''}.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            {createdDealId && (
              <button onClick={() => router.push(`/deals/${createdDealId}`)}
                className="px-4 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 transition-colors">
                View Deal →
              </button>
            )}
            <button onClick={handleAddAnother}
              className="px-4 py-2 text-sm font-ui border border-border rounded hover:border-accent transition-colors">
              Ingest Another Deal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
