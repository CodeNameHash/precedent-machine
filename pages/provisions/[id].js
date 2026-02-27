import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useProvision, useAnnotations, useSignoffs } from '../../lib/useSupabaseData';
import { useUser } from '../../lib/useUser';
import { useToast } from '../../lib/useToast';
import { useRealtimeNotifications } from '../../lib/useRealtime';
import { Breadcrumbs, AIBadge, SkeletonCard, ErrorState } from '../../components/UI';

const FAV_BADGE = {
  buyer: { bg: 'bg-buyer/10', text: 'text-buyer', ring: 'ring-buyer' },
  seller: { bg: 'bg-seller/10', text: 'text-seller', ring: 'ring-seller' },
  neutral: { bg: 'bg-gray-100', text: 'text-inkLight', ring: 'ring-inkFaint' },
};
function favStyle(f) { return FAV_BADGE[(f || '').toLowerCase()] || FAV_BADGE.neutral; }

/* ── Highlighted Text ── */
function HighlightedText({ text, annotations }) {
  if (!text) return null;
  if (!annotations || annotations.length === 0) return <span>{text}</span>;

  const regions = [];
  annotations.forEach((a) => {
    if (!a.phrase) return;
    const idx = text.toLowerCase().indexOf(a.phrase.toLowerCase());
    if (idx >= 0) regions.push({ start: idx, end: idx + a.phrase.length, annotation: a });
  });
  regions.sort((a, b) => a.start - b.start);
  if (regions.length === 0) return <span>{text}</span>;

  const parts = [];
  let cursor = 0;
  regions.forEach((r, i) => {
    if (r.start > cursor) parts.push(<span key={`t-${i}`}>{text.slice(cursor, r.start)}</span>);
    if (r.start >= cursor) {
      const s = favStyle(r.annotation.favorability);
      parts.push(
        <mark key={`h-${i}`} className={`${s.bg} ${s.text} rounded px-0.5`}
          title={r.annotation.note || r.annotation.favorability}>
          {text.slice(r.start, r.end)}
        </mark>
      );
      cursor = r.end;
    }
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <>{parts}</>;
}

/* ── Comments ── */
function CommentsBlock({ annotationId }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useUser({ redirectTo: null });

  useEffect(() => {
    if (!annotationId) return;
    fetch(`/api/comments?annotation_id=${annotationId}`)
      .then(r => r.json()).then(d => setComments(d.comments || []));
  }, [annotationId]);

  const submit = async () => {
    if (!body.trim() || !user) return;
    setSubmitting(true);
    await fetch('/api/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annotation_id: annotationId, user_id: user.id, body }),
    });
    setBody('');
    const res = await fetch(`/api/comments?annotation_id=${annotationId}`);
    const d = await res.json();
    setComments(d.comments || []);
    setSubmitting(false);
  };

  return (
    <div className="ml-4 mt-2 space-y-2">
      {comments.map(c => (
        <div key={c.id} className="flex gap-2 text-xs">
          <span className="font-ui font-medium text-inkMid">{c.user?.name || 'User'}:</span>
          <span className="font-body text-inkMid">{c.body}</span>
          <span className="text-inkFaint ml-auto shrink-0">
            {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}
          </span>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={body} onChange={e => setBody(e.target.value)} placeholder="Add comment…"
          className="flex-1 border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
          onKeyDown={e => e.key === 'Enter' && submit()} />
        <button onClick={submit} disabled={submitting || !body.trim()}
          className="px-2 py-1 text-xs font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40">
          Post
        </button>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function ProvisionDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser({ redirectTo: '/login' });
  const { provision, loading: provLoading, refetch: refetchProv } = useProvision(id);
  const { annotations, loading: annLoading, refetch: refetchAnn } = useAnnotations(id);
  const { signoffs, refetch: refetchSignoffs } = useSignoffs('provision', id);
  const { addToast } = useToast();

  // Realtime notifications
  useRealtimeNotifications(id);

  /* ── AI States ── */
  const [aiCategorizing, setAiCategorizing] = useState(false);
  const [aiCatResult, setAiCatResult] = useState(null);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [propagateInfo, setPropagateInfo] = useState(null); // for showing propagation dialog

  /* ── Add Annotation form ── */
  const [annForm, setAnnForm] = useState({ phrase: '', favorability: 'neutral', note: '' });
  const [annSubmitting, setAnnSubmitting] = useState(false);
  const [signingOff, setSigningOff] = useState(false);

  /* ── AI: Auto-Categorize ── */
  const handleAutoCategorize = async () => {
    if (!provision?.full_text) return;
    setAiCategorizing(true);
    setAiCatResult(null);
    try {
      const resp = await fetch('/api/ai/categorize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: provision.full_text, type: provision.type, current_category: provision.category }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setAiCatResult(data);
    } catch (err) {
      addToast(`AI error: ${err.message}`, 'error');
    }
    setAiCategorizing(false);
  };

  const acceptCategorization = async () => {
    if (!aiCatResult || !id) return;
    await fetch('/api/provisions', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        category: aiCatResult.category,
        ai_favorability: aiCatResult.favorability,
        type: aiCatResult.type,
      }),
    });
    setAiCatResult(null);
    addToast('Categorization accepted', 'success');
    refetchProv();
  };

  /* ── AI: Suggest Annotations ── */
  const handleSuggestAnnotations = async () => {
    if (!provision?.full_text) return;
    setAiSuggesting(true);
    setAiSuggestions(null);
    try {
      const resp = await fetch('/api/ai/suggest-annotations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: provision.full_text, type: provision.type, category: provision.category }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setAiSuggestions(data.annotations || []);
    } catch (err) {
      addToast(`AI error: ${err.message}`, 'error');
    }
    setAiSuggesting(false);
  };

  const acceptSuggestion = async (suggestion) => {
    await fetch('/api/annotations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provision_id: id, phrase: suggestion.phrase, favorability: suggestion.favorability,
        note: suggestion.note, user_id: user?.id, is_ai_generated: true,
      }),
    });
    setAiSuggestions(prev => prev.filter(s => s.phrase !== suggestion.phrase));
    addToast('Annotation accepted', 'success');
    refetchAnn();
  };

  const rejectSuggestion = (suggestion) => {
    setAiSuggestions(prev => prev.filter(s => s.phrase !== suggestion.phrase));
  };

  /* ── Submit manual annotation ── */
  const submitAnnotation = async () => {
    if (!annForm.phrase.trim() || !user) return;
    setAnnSubmitting(true);
    const resp = await fetch('/api/annotations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provision_id: id, phrase: annForm.phrase, favorability: annForm.favorability, note: annForm.note, user_id: user.id }),
    });
    const data = await resp.json();

    // Check for propagation opportunities
    if (data.annotation) {
      try {
        const propResp = await fetch('/api/annotations/propagate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            annotation_id: data.annotation.id, provision_id: id,
            phrase: annForm.phrase, favorability: annForm.favorability, note: annForm.note, user_id: user.id,
          }),
        });
        const propData = await propResp.json();
        if (propData.matches && propData.matches.length > 0) {
          setPropagateInfo(propData);
        }
      } catch {}
    }

    setAnnForm({ phrase: '', favorability: 'neutral', note: '' });
    refetchAnn();
    setAnnSubmitting(false);
  };

  /* ── Verify annotation ── */
  const verifyAnnotation = async (annotationId) => {
    if (!user) return;
    await fetch('/api/annotations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: annotationId, verified_by: user.id }),
    });
    addToast('Annotation verified', 'success');
    refetchAnn();
  };

  /* ── Sign Off ── */
  const handleSignOff = async () => {
    if (!user) return;
    setSigningOff(true);
    await fetch('/api/signoffs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'provision', entity_id: id, user_id: user.id }),
    });
    refetchSignoffs();
    setSigningOff(false);
  };

  /* ── Derived ── */
  const exceptions = useMemo(() => {
    if (!provision?.exceptions) return [];
    if (Array.isArray(provision.exceptions)) return provision.exceptions;
    try { return JSON.parse(provision.exceptions); } catch { return []; }
  }, [provision]);

  if (provLoading) return <div className="space-y-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
  if (!provision) return (
    <div className="text-center py-12 space-y-2">
      <p className="text-inkFaint font-ui">Provision not found.</p>
      <Link href="/provisions" className="text-accent text-sm font-ui hover:underline">← Back to Provisions</Link>
    </div>
  );

  const dealLabel = provision.deal ? `${provision.deal.acquirer} / ${provision.deal.target}` : '—';

  return (
    <div className="space-y-6 max-w-4xl">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Deals', href: '/deals' },
        { label: dealLabel, href: provision.deal_id ? `/deals/${provision.deal_id}` : '/deals' },
        { label: `${provision.type} — ${provision.category || 'General'}` },
      ]} />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">
            {provision.type} — {provision.category || 'General'}
          </h1>
          <p className="text-sm text-inkLight font-ui mt-0.5">{dealLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          {provision.ai_favorability && (() => {
            const fav = provision.ai_favorability.toLowerCase();
            const s = favStyle(fav);
            const verified = annotations.find(a => a.verified_by);
            return verified ? (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-ui font-medium capitalize ring-1 ${s.ring} ${s.bg} ${s.text}`}>
                {fav} <span className="text-[10px] opacity-70">✓ {verified.verified_by_name || 'verified'}</span>
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-ui font-medium capitalize border border-dashed border-inkFaint ${s.bg} ${s.text}`}>
                {fav} <span className="text-[10px] opacity-70">AI</span>
              </span>
            );
          })()}
          <button onClick={handleSignOff} disabled={signingOff}
            className="px-3 py-1.5 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 transition-colors">
            {signingOff ? 'Signing…' : 'Sign Off'}
          </button>
        </div>
      </div>

      {/* Sign-offs */}
      {signoffs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {signoffs.map(s => (
            <span key={s.id} className="text-[10px] font-ui text-buyer bg-buyer/5 border border-buyer/20 rounded px-2 py-0.5">
              ✓ {s.user?.name || 'User'} — {s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}
            </span>
          ))}
        </div>
      )}

      {/* AI Actions Bar */}
      <div className="bg-white border border-border rounded-lg shadow-sm p-4 flex flex-wrap gap-3">
        <button onClick={handleAutoCategorize} disabled={aiCategorizing}
          className="px-3 py-1.5 text-sm font-ui border border-accent/30 text-accent rounded hover:bg-accent/5 disabled:opacity-40 transition-colors">
          {aiCategorizing ? '⟳ Analyzing…' : '◇ Auto-Categorize'}
        </button>
        <button onClick={handleSuggestAnnotations} disabled={aiSuggesting}
          className="px-3 py-1.5 text-sm font-ui border border-accent/30 text-accent rounded hover:bg-accent/5 disabled:opacity-40 transition-colors">
          {aiSuggesting ? '⟳ Suggesting…' : '◇ Suggest Annotations'}
        </button>
      </div>

      {/* AI Categorization Result */}
      {aiCatResult && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AIBadge />
            <span className="font-ui text-sm font-medium text-ink">Auto-Categorization Result</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm font-ui">
            <div><span className="text-inkLight">Type:</span> <span className="text-ink">{aiCatResult.type}</span></div>
            <div><span className="text-inkLight">Category:</span> <span className="text-ink">{aiCatResult.category}</span></div>
            <div><span className="text-inkLight">Favorability:</span> <span className={`capitalize ${
              aiCatResult.favorability === 'buyer' ? 'text-buyer' : aiCatResult.favorability === 'seller' ? 'text-seller' : 'text-inkMid'
            }`}>{aiCatResult.favorability}</span></div>
            <div><span className="text-inkLight">Score:</span> <span className="text-ink">{aiCatResult.favorability_score}/10</span></div>
          </div>
          <p className="text-sm font-body text-inkMid">{aiCatResult.reasoning}</p>
          {aiCatResult.key_terms?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {aiCatResult.key_terms.map((t, i) => (
                <span key={i} className="text-[10px] font-ui px-2 py-0.5 rounded bg-bg text-inkMid">{t}</span>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={acceptCategorization}
              className="px-4 py-1.5 text-sm font-ui bg-buyer text-white rounded hover:bg-buyer/90 transition-colors">
              Accept
            </button>
            <button onClick={() => setAiCatResult(null)}
              className="px-4 py-1.5 text-sm font-ui border border-border rounded hover:bg-bg transition-colors">
              Reject
            </button>
          </div>
        </div>
      )}

      {/* AI Annotation Suggestions */}
      {aiSuggestions && aiSuggestions.length > 0 && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AIBadge />
            <span className="font-ui text-sm font-medium text-ink">Suggested Annotations ({aiSuggestions.length})</span>
          </div>
          <div className="space-y-2">
            {aiSuggestions.map((s, i) => {
              const fs = favStyle(s.favorability);
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded border border-border bg-white">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-ui font-medium capitalize ${fs.bg} ${fs.text}`}>
                        {s.favorability}
                      </span>
                      <span className="text-[10px] font-ui text-inkFaint capitalize">{s.importance}</span>
                    </div>
                    <p className="font-body text-sm text-ink">"{s.phrase}"</p>
                    <p className="text-xs text-inkLight font-ui mt-1">{s.note}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => acceptSuggestion(s)}
                      className="px-2.5 py-1 text-xs font-ui bg-buyer/10 text-buyer rounded hover:bg-buyer/20 transition-colors">
                      Accept
                    </button>
                    <button onClick={() => rejectSuggestion(s)}
                      className="px-2.5 py-1 text-xs font-ui bg-seller/10 text-seller rounded hover:bg-seller/20 transition-colors">
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Propagation Dialog */}
      {propagateInfo && propagateInfo.matches?.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-sm font-ui text-blue-800">
            This phrase appears in <strong>{propagateInfo.matches.length}</strong> other provision{propagateInfo.matches.length > 1 ? 's' : ''}.
            {propagateInfo.propagated > 0 && ` Propagated to ${propagateInfo.propagated}.`}
            {propagateInfo.skipped_human_overrides > 0 && ` Skipped ${propagateInfo.skipped_human_overrides} with human overrides.`}
          </p>
          <button onClick={() => setPropagateInfo(null)}
            className="text-xs font-ui text-blue-600 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Full Text */}
      <div className="bg-white border border-border rounded-lg shadow-sm p-6">
        <h2 className="font-display text-lg text-ink mb-3">Full Text</h2>
        <div className="font-body text-ink leading-relaxed text-[15px] whitespace-pre-wrap">
          <HighlightedText text={provision.full_text} annotations={annotations} />
        </div>
      </div>

      {/* Prohibition */}
      {provision.prohibition && (
        <div className="bg-white border border-border rounded-lg shadow-sm p-6">
          <h2 className="font-display text-lg text-seller mb-3">Prohibition</h2>
          <p className="font-body text-ink leading-relaxed text-[15px] whitespace-pre-wrap">{provision.prohibition}</p>
        </div>
      )}

      {/* Exceptions */}
      {exceptions.length > 0 && (
        <div className="bg-white border border-border rounded-lg shadow-sm p-6">
          <h2 className="font-display text-lg text-buyer mb-3">Exceptions</h2>
          <ul className="space-y-2">
            {exceptions.map((ex, i) => (
              <li key={i} className="font-body text-ink leading-relaxed text-[15px] pl-4 border-l-2 border-buyer/30">
                {typeof ex === 'string' ? ex : ex.text || JSON.stringify(ex)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Annotations */}
      <div className="bg-white border border-border rounded-lg shadow-sm p-6 space-y-4">
        <h2 className="font-display text-lg text-ink">Annotations</h2>
        {annLoading ? (
          <p className="text-inkFaint font-ui text-sm">Loading annotations…</p>
        ) : annotations.length === 0 ? (
          <p className="text-inkFaint font-ui text-sm">No annotations yet.</p>
        ) : (
          <div className="space-y-4">
            {annotations.map(a => {
              const s = favStyle(a.favorability);
              return (
                <div key={a.id} className="border border-border rounded p-3 space-y-1">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-ui font-medium capitalize ${s.bg} ${s.text}`}>
                        {a.favorability || 'neutral'}
                      </span>
                      <span className="font-body text-ink text-sm">"{a.phrase}"</span>
                      {a.is_ai_generated && (
                        <AIBadge verified={!!a.verified_by} verifierName={a.verified_by_name} />
                      )}
                      {a.overrides_id && (
                        <span className="text-[10px] font-ui text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">propagated</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.is_ai_generated && !a.verified_by && (
                        <button onClick={() => verifyAnnotation(a.id)}
                          className="text-[10px] font-ui text-buyer hover:underline">Verify</button>
                      )}
                      <span className="text-[10px] text-inkFaint font-ui">
                        {a.user?.name || 'User'} · {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                  {a.note && <p className="text-sm text-inkMid font-ui">{a.note}</p>}
                  <CommentsBlock annotationId={a.id} />
                </div>
              );
            })}
          </div>
        )}

        {/* Add Annotation Form */}
        <div className="border-t border-border pt-4 mt-4 space-y-3">
          <h3 className="font-ui text-sm font-medium text-inkMid">Add Annotation</h3>
          <div className="flex flex-wrap gap-3">
            <input placeholder="Phrase from text" value={annForm.phrase}
              onChange={e => setAnnForm(f => ({...f, phrase: e.target.value}))}
              className="flex-1 min-w-[200px] border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
            <select value={annForm.favorability} onChange={e => setAnnForm(f => ({...f, favorability: e.target.value}))}
              className="border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent">
              <option value="buyer">Buyer</option>
              <option value="neutral">Neutral</option>
              <option value="seller">Seller</option>
            </select>
          </div>
          <input placeholder="Note (optional)" value={annForm.note}
            onChange={e => setAnnForm(f => ({...f, note: e.target.value}))}
            className="w-full border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent"
            onKeyDown={e => e.key === 'Enter' && submitAnnotation()} />
          <button onClick={submitAnnotation} disabled={annSubmitting || !annForm.phrase.trim()}
            className="px-4 py-1.5 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 transition-colors">
            {annSubmitting ? 'Adding…' : 'Add Annotation'}
          </button>
        </div>
      </div>
    </div>
  );
}
