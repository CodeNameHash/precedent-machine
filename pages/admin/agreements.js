import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../../lib/useUser';
import { useToast } from '../../lib/useToast';
import { Breadcrumbs } from '../../components/UI';

const PROVISION_TYPES = ['MAE', 'IOC', 'ANTI', 'COND', 'TERMR', 'TERMF'];

export default function AddAgreements() {
  const router = useRouter();
  const { user } = useUser({ redirectTo: '/login' });
  const { addToast } = useToast();
  const fileRef = useRef(null);

  const [mode, setMode] = useState('describe'); // describe | upload | paste
  const [description, setDescription] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [dealInfo, setDealInfo] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState(PROVISION_TYPES);

  // AI-powered deal finding from description
  const findDeal = async () => {
    if (!description.trim()) return;
    setProcessing(true);
    setDealInfo(null);
    setDuplicateWarning(null);
    try {
      const resp = await fetch('/api/admin/find-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setDealInfo(data.deal);
      if (data.duplicate) {
        setDuplicateWarning(data.duplicate);
      }
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    }
    setProcessing(false);
  };

  // Handle file upload
  const handleFiles = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // Process uploaded files / pasted text
  const processAgreement = async () => {
    setProcessing(true);
    setResults(null);
    try {
      let dealId = dealInfo?.id;

      // Create deal if needed
      if (!dealId && dealInfo) {
        const dealResp = await fetch('/api/deals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acquirer: dealInfo.acquirer,
            target: dealInfo.target,
            value_usd: dealInfo.value_usd || null,
            announce_date: dealInfo.announce_date || null,
            sector: dealInfo.sector || null,
            created_by: user?.id,
          }),
        });
        const dealData = await dealResp.json();
        if (dealData.error) throw new Error(dealData.error);
        dealId = dealData.deal.id;
      }

      if (!dealId) {
        addToast('No deal identified. Describe the deal first.', 'error');
        setProcessing(false);
        return;
      }

      // Get agreement text
      let fullText = '';
      if (mode === 'paste') {
        fullText = pastedText;
      } else if (mode === 'upload' && files.length > 0) {
        // Read text from files
        for (const file of files) {
          if (file.name.endsWith('.txt') || file.name.endsWith('.html') || file.name.endsWith('.htm')) {
            const text = await file.text();
            fullText += text + '\n\n';
          } else if (file.name.endsWith('.pdf')) {
            addToast('PDF parsing requires server-side processing. Text files preferred.', 'error');
            continue;
          } else {
            const text = await file.text();
            fullText += text + '\n\n';
          }
        }
      } else if (mode === 'describe' && dealInfo?.agreement_text) {
        fullText = dealInfo.agreement_text;
      }

      if (!fullText || fullText.length < 500) {
        addToast('Agreement text too short. Need at least 500 characters.', 'error');
        setProcessing(false);
        return;
      }

      // Check for duplicates
      const dupResp = await fetch('/api/admin/check-agreement-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText.substring(0, 5000), deal_id: dealId }),
      });
      const dupData = await dupResp.json();
      if (dupData.is_duplicate) {
        setDuplicateWarning({
          message: `This agreement appears to already exist (${dupData.match_percentage}% text match with "${dupData.existing_deal}").`,
          existing_id: dupData.existing_id,
        });
        if (!confirm(`Duplicate detected: ${dupData.match_percentage}% match with "${dupData.existing_deal}". Continue anyway?`)) {
          setProcessing(false);
          return;
        }
      }

      // Ingest via agreement API
      const ingestResp = await fetch('/api/ingest/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: dealId,
          full_text: fullText,
          title: `${dealInfo?.acquirer || 'Unknown'} / ${dealInfo?.target || 'Unknown'} Merger Agreement`,
          provision_types: selectedTypes,
        }),
      });
      const ingestData = await ingestResp.json();
      if (ingestData.error) throw new Error(ingestData.error);

      setResults(ingestData);
      addToast('Agreement ingested successfully!', 'success');
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    }
    setProcessing(false);
  };

  const toggleType = (t) => {
    setSelectedTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Admin', href: '/admin' },
        { label: 'Add Agreement(s)' },
      ]} />

      <div>
        <h1 className="font-display text-2xl text-ink">Add Agreement(s)</h1>
        <p className="text-sm text-inkLight font-ui mt-1">
          Add merger agreements by description, file upload, or pasted text.
          AI will identify the deal and extract provisions automatically.
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        {[
          { key: 'describe', label: 'Describe Deal' },
          { key: 'upload', label: 'Upload Files' },
          { key: 'paste', label: 'Paste Text' },
        ].map(m => (
          <button key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-4 py-2 text-sm font-ui rounded border transition-colors ${
              mode === m.key
                ? 'bg-accent text-white border-accent'
                : 'bg-white border-border text-inkMid hover:border-accent'
            }`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Describe mode */}
      {mode === 'describe' && (
        <div className="bg-white border border-border rounded-lg shadow-sm p-6 space-y-4">
          <h2 className="font-display text-lg text-ink">Describe the Deal</h2>
          <p className="text-xs text-inkLight font-ui">
            Describe the deal in natural language. AI will identify it and attempt to find the agreement.
          </p>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="e.g. Broadcom's acquisition of VMware announced in May 2022 for about $61 billion..."
            className="w-full border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
          <button onClick={findDeal} disabled={processing || !description.trim()}
            className="px-5 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 transition-colors">
            {processing ? 'Searching...' : 'Find Deal'}
          </button>
        </div>
      )}

      {/* Upload mode */}
      {mode === 'upload' && (
        <div className="bg-white border border-border rounded-lg shadow-sm p-6 space-y-4">
          <h2 className="font-display text-lg text-ink">Upload Agreement Files</h2>
          <p className="text-xs text-inkLight font-ui">
            Upload .txt, .html, or .zip files containing merger agreements.
            For ZIP files, include a manifest.txt file describing each agreement.
          </p>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-accent transition-colors">
            <div className="text-3xl mb-2">+</div>
            <div className="text-sm font-ui text-inkMid">Click to select files</div>
            <div className="text-xs text-inkFaint mt-1">TXT, HTML, PDF, ZIP</div>
          </div>
          <input ref={fileRef} type="file" multiple accept=".txt,.html,.htm,.pdf,.zip,.doc,.docx"
            onChange={handleFiles} className="hidden" />
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded bg-bg/50 border border-border">
                  <span className="font-ui text-sm text-ink">{f.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-inkFaint">{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => removeFile(i)} className="text-xs text-seller hover:underline">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Deal description for context */}
          <div>
            <label className="text-xs font-ui text-inkLight mb-1 block">Deal Description (helps AI identify the deal)</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Broadcom / VMware merger agreement"
              className="w-full border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          {description && !dealInfo && (
            <button onClick={findDeal} disabled={processing}
              className="px-4 py-2 text-sm font-ui border border-accent text-accent rounded hover:bg-accent hover:text-white transition-colors">
              {processing ? 'Finding...' : 'Identify Deal'}
            </button>
          )}
        </div>
      )}

      {/* Paste mode */}
      {mode === 'paste' && (
        <div className="bg-white border border-border rounded-lg shadow-sm p-6 space-y-4">
          <h2 className="font-display text-lg text-ink">Paste Agreement Text</h2>
          <div>
            <label className="text-xs font-ui text-inkLight mb-1 block">Deal Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Broadcom / VMware merger agreement"
              className="w-full border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          {description && !dealInfo && (
            <button onClick={findDeal} disabled={processing}
              className="px-4 py-2 text-sm font-ui border border-accent text-accent rounded hover:bg-accent hover:text-white transition-colors">
              {processing ? 'Finding...' : 'Identify Deal'}
            </button>
          )}
          <textarea
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
            rows={12}
            placeholder="Paste the full merger agreement text here..."
            className="w-full border border-border rounded px-3 py-2 text-sm font-body leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
          {pastedText && (
            <div className="text-xs text-inkFaint">
              {pastedText.length.toLocaleString()} characters, ~{pastedText.split(/\s+/).filter(Boolean).length.toLocaleString()} words
            </div>
          )}
        </div>
      )}

      {/* Deal info card */}
      {dealInfo && (
        <div className="bg-white border border-border rounded-lg shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base text-ink">
              {dealInfo.acquirer} / {dealInfo.target}
            </h3>
            {dealInfo.id && (
              <span className="text-xs font-ui text-buyer bg-buyer/10 px-2 py-0.5 rounded">Existing Deal</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs font-ui text-inkMid">
            {dealInfo.value_usd && <div><span className="text-inkFaint">Value:</span> ${(dealInfo.value_usd / 1e9).toFixed(1)}B</div>}
            {dealInfo.sector && <div><span className="text-inkFaint">Sector:</span> {dealInfo.sector}</div>}
            {dealInfo.announce_date && <div><span className="text-inkFaint">Date:</span> {dealInfo.announce_date}</div>}
          </div>
        </div>
      )}

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm font-ui text-yellow-800">
            <strong>Potential Duplicate:</strong> {duplicateWarning.message}
          </div>
        </div>
      )}

      {/* Provision type selection */}
      {dealInfo && (
        <div className="bg-white border border-border rounded-lg shadow-sm p-4 space-y-3">
          <h3 className="font-display text-base text-ink">Provision Types to Extract</h3>
          <div className="flex gap-2 flex-wrap">
            {PROVISION_TYPES.map(t => (
              <button key={t} onClick={() => toggleType(t)}
                className={`px-3 py-1.5 text-xs font-ui rounded border transition-colors ${
                  selectedTypes.includes(t)
                    ? 'bg-accent/10 border-accent text-accent font-medium'
                    : 'bg-white border-border text-inkFaint'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Process button */}
      {dealInfo && (mode === 'paste' ? pastedText.length > 500 : mode === 'upload' ? files.length > 0 : true) && (
        <button onClick={processAgreement} disabled={processing}
          className="w-full px-5 py-3 text-sm font-ui bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-40 transition-colors font-medium">
          {processing ? 'Processing Agreement...' : 'Ingest Agreement + Extract Provisions'}
        </button>
      )}

      {/* Results */}
      {results && (
        <div className="bg-white border border-border rounded-lg shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">&#10003;</div>
            <div>
              <h3 className="font-display text-lg text-ink">Ingestion Complete</h3>
              <p className="text-xs text-inkLight">Agreement processed and provisions extracted.</p>
            </div>
          </div>
          <div className="space-y-2">
            {(results.results || []).map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded bg-bg/50">
                <span className="font-ui text-sm text-ink">{r.label || r.type}</span>
                <div className="text-xs text-inkFaint">
                  {r.created} created · {r.extracted} extracted · {r.suggested || 0} AI-suggested
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => router.push('/')}
              className="px-4 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 transition-colors">
              View in Comparison Tool
            </button>
            <button onClick={() => { setResults(null); setDealInfo(null); setDescription(''); setPastedText(''); setFiles([]); }}
              className="px-4 py-2 text-sm font-ui border border-border rounded hover:border-accent transition-colors">
              Add Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
