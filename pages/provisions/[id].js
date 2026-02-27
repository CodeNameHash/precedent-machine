import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useProvision, useAnnotations, useSignoffs } from '../../lib/useSupabaseData';
import { useUser } from '../../lib/useUser';

/* ── Favorability helpers ── */
const FAV_BADGE = {
  buyer: { bg: 'bg-buyer/10', text: 'text-buyer', ring: 'ring-buyer' },
  seller: { bg: 'bg-seller/10', text: 'text-seller', ring: 'ring-seller' },
  neutral: { bg: 'bg-gray-100', text: 'text-inkLight', ring: 'ring-inkFaint' },
};

function favStyle(f) {
  return FAV_BADGE[(f || '').toLowerCase()] || FAV_BADGE.neutral;
}

/* ── Inline phrase highlighting ── */
function HighlightedText({ text, annotations }) {
  if (!text) return null;
  if (!annotations || annotations.length === 0) {
    return <span>{text}</span>;
  }

  // Build a list of {start, end, annotation} sorted by position
  const regions = [];
  annotations.forEach((a) => {
    if (!a.phrase) return;
    const idx = text.toLowerCase().indexOf(a.phrase.toLowerCase());
    if (idx >= 0) {
      regions.push({ start: idx, end: idx + a.phrase.length, annotation: a });
    }
  });
  regions.sort((a, b) => a.start - b.start);

  if (regions.length === 0) return <span>{text}</span>;

  const parts = [];
  let cursor = 0;
  regions.forEach((r, i) => {
    if (r.start > cursor) {
      parts.push(<span key={`t-${i}`}>{text.slice(cursor, r.start)}</span>);
    }
    if (r.start >= cursor) {
      const s = favStyle(r.annotation.favorability);
      parts.push(
        <mark
          key={`h-${i}`}
          className={`${s.bg} ${s.text} rounded px-0.5`}
          title={r.annotation.note || r.annotation.favorability}
        >
          {text.slice(r.start, r.end)}
        </mark>
      );
      cursor = r.end;
    }
  });
  if (cursor < text.length) {
    parts.push(<span key="tail">{text.slice(cursor)}</span>);
  }
  return <>{parts}</>;
}

/* ── Comments sub-component ── */
function CommentsBlock({ annotationId }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useUser({ redirectTo: null });

  useEffect(() => {
    if (!annotationId) return;
    fetch(`/api/comments?annotation_id=${annotationId}`)
      .then((r) => r.json())
      .then((d) => setComments(d.comments || []));
  }, [annotationId]);

  const submit = async () => {
    if (!body.trim() || !user) return;
    setSubmitting(true);
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2 text-xs">
          <span className="font-ui font-medium text-inkMid">{c.user?.name || 'User'}:</span>
          <span className="font-body text-inkMid">{c.body}</span>
          <span className="text-inkFaint ml-auto shrink-0">
            {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}
          </span>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add comment…"
          className="flex-1 border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button
          onClick={submit}
          disabled={submitting || !body.trim()}
          className="px-2 py-1 text-xs font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40"
        >
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
  const { user } = useUser({ redirectTo: null });
  const { provision, loading: provLoading } = useProvision(id);
  const { annotations, loading: annLoading, refetch: refetchAnn } = useAnnotations(id);
  const { signoffs, refetch: refetchSignoffs } = useSignoffs('provision', id);

  /* ── Add Annotation form ── */
  const [annForm, setAnnForm] = useState({ phrase: '', favorability: 'neutral', note: '' });
  const [annSubmitting, setAnnSubmitting] = useState(false);

  const submitAnnotation = async () => {
    if (!annForm.phrase.trim() || !user) return;
    setAnnSubmitting(true);
    await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provision_id: id,
        phrase: annForm.phrase,
        favorability: annForm.favorability,
        note: annForm.note,
        user_id: user.id,
      }),
    });
    setAnnForm({ phrase: '', favorability: 'neutral', note: '' });
    refetchAnn();
    setAnnSubmitting(false);
  };

  /* ── Sign Off ── */
  const [signingOff, setSigningOff] = useState(false);
  const handleSignOff = async () => {
    if (!user) return;
    setSigningOff(true);
    await fetch('/api/signoffs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'provision', entity_id: id, user_id: user.id }),
    });
    refetchSignoffs();
    setSigningOff(false);
  };

  /* ── Favorability badge logic ── */
  const favBadge = useMemo(() => {
    if (!provision) return null;
    const fav = (provision.ai_favorability || '').toLowerCase();
    if (!fav) return null;
    const s = favStyle(fav);
    // Check if any annotation has been human-verified
    const verified = annotations.find((a) => a.verified_by);
    if (verified) {
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-ui font-medium capitalize ring-1 ${s.ring} ${s.bg} ${s.text}`}>
          {fav} <span className="text-[10px] opacity-70">✓ {verified.verified_by_name || 'verified'}</span>
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-ui font-medium capitalize border border-dashed border-inkFaint ${s.bg} ${s.text}`}>
        {fav} <span className="text-[10px] opacity-70">AI</span>
      </span>
    );
  }, [provision, annotations]);

  /* ── Exceptions ── */
  const exceptions = useMemo(() => {
    if (!provision?.exceptions) return [];
    if (Array.isArray(provision.exceptions)) return provision.exceptions;
    try { return JSON.parse(provision.exceptions); } catch { return []; }
  }, [provision]);

  if (provLoading) {
    return <div className="text-inkFaint font-ui py-12 text-center">Loading…</div>;
  }

  if (!provision) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-inkFaint font-ui">Provision not found.</p>
        <Link href="/provisions" className="text-accent text-sm font-ui hover:underline">
          ← Back to Provisions
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/provisions" className="text-xs text-inkFaint font-ui hover:text-ink">
            ← Provisions
          </Link>
          <h1 className="font-display text-2xl text-ink mt-1">
            {provision.type} — {provision.category || 'General'}
          </h1>
          <p className="text-sm text-inkLight font-ui mt-0.5">
            {provision.deal?.acquirer || '—'} / {provision.deal?.target || '—'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {favBadge}
          <button
            onClick={handleSignOff}
            disabled={signingOff}
            className="px-3 py-1.5 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 transition-colors"
          >
            {signingOff ? 'Signing…' : 'Sign Off'}
          </button>
        </div>
      </div>

      {/* Sign-offs */}
      {signoffs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {signoffs.map((s) => (
            <span key={s.id} className="text-[10px] font-ui text-buyer bg-buyer/5 border border-buyer/20 rounded px-2 py-0.5">
              ✓ {s.user?.name || 'User'} — {s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}
            </span>
          ))}
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
          <p className="font-body text-ink leading-relaxed text-[15px] whitespace-pre-wrap">
            {provision.prohibition}
          </p>
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
            {annotations.map((a) => {
              const s = favStyle(a.favorability);
              return (
                <div key={a.id} className="border border-border rounded p-3 space-y-1">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-ui font-medium capitalize ${s.bg} ${s.text}`}>
                        {a.favorability || 'neutral'}
                      </span>
                      <span className="font-body text-ink text-sm">"{a.phrase}"</span>
                    </div>
                    <span className="text-[10px] text-inkFaint font-ui shrink-0">
                      {a.user?.name || 'User'} · {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                  {a.note && (
                    <p className="text-sm text-inkMid font-ui">{a.note}</p>
                  )}
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
            <input
              placeholder="Phrase from text"
              value={annForm.phrase}
              onChange={(e) => setAnnForm((f) => ({ ...f, phrase: e.target.value }))}
              className="flex-1 min-w-[200px] border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <select
              value={annForm.favorability}
              onChange={(e) => setAnnForm((f) => ({ ...f, favorability: e.target.value }))}
              className="border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="buyer">Buyer</option>
              <option value="neutral">Neutral</option>
              <option value="seller">Seller</option>
            </select>
          </div>
          <input
            placeholder="Note (optional)"
            value={annForm.note}
            onChange={(e) => setAnnForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={submitAnnotation}
            disabled={annSubmitting || !annForm.phrase.trim()}
            className="px-4 py-1.5 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 transition-colors"
          >
            {annSubmitting ? 'Adding…' : 'Add Annotation'}
          </button>
        </div>
      </div>
    </div>
  );
}
