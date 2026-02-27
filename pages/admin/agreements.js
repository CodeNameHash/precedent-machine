import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import JSZip from 'jszip';

AddAgreements.noLayout = true;

// ─── Safe fetch helper: always returns JSON or throws ───
async function safeFetch(url, opts) {
  const resp = await fetch(url, opts);
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(text.length > 200 ? text.substring(0, 200) + '...' : text);
  }
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

// ─── Client-side file text extraction ───
function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Extract text from a single buffer given its filename
async function extractTextFromBuffer(name, buf) {
  const lc = name.toLowerCase();

  // Plain text
  if (lc.endsWith('.txt') || lc.endsWith('.text')) {
    return new TextDecoder().decode(buf);
  }

  // HTML
  if (lc.endsWith('.html') || lc.endsWith('.htm')) {
    return stripHtml(new TextDecoder().decode(buf));
  }

  // PDF — use pdfjs-dist
  if (lc.endsWith('.pdf')) {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str).join(' '));
      }
      return pages.join('\n\n');
    } catch (err) {
      console.warn('PDF parse failed for', name, err);
      return '';
    }
  }

  // DOCX / DOC — extract text from word/document.xml inside the zip
  if (lc.endsWith('.docx') || lc.endsWith('.doc')) {
    try {
      const zip = await JSZip.loadAsync(buf);
      const docXml = zip.file('word/document.xml');
      if (docXml) {
        const xml = await docXml.async('string');
        return xml
          .replace(/<w:br[^>]*\/>/gi, '\n')
          .replace(/<\/w:p>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }
    } catch { /* not a valid docx */ }
    return '';
  }

  // ZIP — extract supported files from inside
  if (lc.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(buf);
    const texts = [];
    for (const [entryName, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const entryLc = entryName.toLowerCase();
      // Skip unsupported / hidden files
      if (entryLc.startsWith('__macosx') || entryLc.startsWith('.')) continue;
      const supported = ['.txt', '.html', '.htm', '.pdf', '.doc', '.docx'];
      if (!supported.some(ext => entryLc.endsWith(ext))) continue;
      try {
        const entryBuf = await entry.async('arraybuffer');
        const text = await extractTextFromBuffer(entryName, entryBuf);
        if (text && text.trim().length > 20) texts.push(text.trim());
      } catch (err) {
        console.warn('Failed to extract', entryName, err);
      }
    }
    return texts.join('\n\n---\n\n');
  }

  // Fallback: try as text
  try {
    const text = new TextDecoder().decode(buf);
    // Only return if it looks like actual text (not binary)
    if (text.length > 0 && !/[\x00-\x08\x0E-\x1F]/.test(text.substring(0, 500))) {
      return text;
    }
  } catch { /* not decodable */ }
  return '';
}

async function extractTextFromFile(file) {
  const buf = await file.arrayBuffer();
  return extractTextFromBuffer(file.name, buf);
}

async function extractTextFromFiles(files) {
  const texts = [];
  for (const file of files) {
    const text = await extractTextFromFile(file);
    if (text) texts.push(text);
  }
  return texts.join('\n\n');
}

const PROVISION_TYPES = [
  { key: 'MAE', label: 'Material Adverse Effect' },
  { key: 'IOC', label: 'Interim Operating Covenants' },
  { key: 'ANTI', label: 'Antitrust / Regulatory Efforts' },
  { key: 'COND', label: 'Conditions to Closing' },
  { key: 'TERMR', label: 'Termination Rights' },
  { key: 'TERMF', label: 'Termination Fees' },
];

const FAV_LEVELS = [
  { key: 'strong-buyer', label: 'Strong Buyer', color: '#1565C0' },
  { key: 'mod-buyer', label: 'Mod. Buyer', color: '#4285f4' },
  { key: 'neutral', label: 'Neutral', color: '#757575' },
  { key: 'mod-seller', label: 'Mod. Seller', color: '#E65100' },
  { key: 'strong-seller', label: 'Strong Seller', color: '#C62828' },
];

export default function AddAgreements() {
  const fileRef = useRef(null);

  // step: input | extracting | preview | saving | done
  const [step, setStep] = useState('input');
  const [inputMode, setInputMode] = useState('upload'); // upload | paste | name
  const [description, setDescription] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [dealInfo, setDealInfo] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState(PROVISION_TYPES.map(t => t.key));
  const [previewProvisions, setPreviewProvisions] = useState([]);
  const [error, setError] = useState(null);
  const [extractedTextLength, setExtractedTextLength] = useState(0);

  // ─── Shared: extract text from current inputs ───
  const getAgreementText = async () => {
    if (inputMode === 'upload') {
      if (!files.length) throw new Error('Select at least one file.');
      setProcessingMsg('Reading files...');
      const text = await extractTextFromFiles(files);
      if (!text || text.length < 200) {
        throw new Error(`Could not extract enough text from files (got ${text.length} chars). Ensure files contain readable text (PDF, DOCX, HTML, or TXT).`);
      }
      return text;
    } else if (inputMode === 'paste') {
      if (!pastedText || pastedText.length < 500) throw new Error('Need at least 500 characters of agreement text.');
      return pastedText;
    }
    return '';
  };

  // ─── Shared: identify deal then extract provisions ───
  const identifyAndExtract = async (fullText) => {
    // Identify deal
    setProcessingMsg('Identifying deal...');
    const dealDesc = description.trim() || fullText.substring(0, 3000);
    const findData = await safeFetch('/api/admin/find-deal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: dealDesc }),
    });
    setDealInfo(findData.deal);
    if (findData.duplicate) setDuplicateWarning(findData.duplicate);

    // Extract provisions in preview mode
    setStep('extracting');
    setProcessingMsg('Extracting provisions (this may take a minute)...');
    const ingestData = await safeFetch('/api/ingest/agreement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_text: fullText,
        title: `${findData.deal?.acquirer || 'Unknown'} / ${findData.deal?.target || 'Unknown'} Merger Agreement`,
        provision_types: selectedTypes,
        preview: true,
      }),
    });

    const allProvs = [];
    (ingestData.results || []).forEach(r => {
      (r.provisions || []).forEach(p => {
        allProvs.push({ ...p, _id: Math.random().toString(36).substr(2, 9) });
      });
    });
    setPreviewProvisions(allProvs);
    setStep('preview');
  };

  // ─── Main "Go" handler ───
  const handleGo = async () => {
    setProcessing(true);
    setError(null);
    setDealInfo(null);
    setDuplicateWarning(null);
    setPreviewProvisions([]);

    try {
      // Name-only mode: just identify the deal, prompt for text next
      if (inputMode === 'name') {
        if (!description.trim()) { setError('Enter a deal name or description.'); setProcessing(false); return; }
        setProcessingMsg('Identifying deal...');
        const findData = await safeFetch('/api/admin/find-deal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: description.trim() }),
        });
        setDealInfo(findData.deal);
        if (findData.duplicate) setDuplicateWarning(findData.duplicate);
        setStep('needtext');
        setProcessing(false);
        setProcessingMsg('');
        return;
      }

      // Upload / paste mode: get text, identify deal, extract provisions
      const fullText = await getAgreementText();
      setExtractedTextLength(fullText.length);
      await identifyAndExtract(fullText);
    } catch (err) {
      setError(err.message);
      if (step === 'extracting') setStep('input');
      else setStep('input');
    }
    setProcessing(false);
    setProcessingMsg('');
  };

  // Handle "Go" from needtext step (deal identified, now have text)
  const handleGoWithText = async () => {
    setProcessing(true);
    setError(null);

    try {
      let fullText = '';
      if (pastedText) {
        fullText = pastedText;
      } else if (files.length > 0) {
        setProcessingMsg('Reading files...');
        fullText = await extractTextFromFiles(files);
      }

      if (!fullText || fullText.length < 500) {
        setError('Need at least 500 characters of agreement text.');
        setProcessing(false);
        return;
      }

      setExtractedTextLength(fullText.length);
      setStep('extracting');
      setProcessingMsg('Extracting provisions (this may take a minute)...');

      const ingestData = await safeFetch('/api/ingest/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_text: fullText,
          title: `${dealInfo?.acquirer || 'Unknown'} / ${dealInfo?.target || 'Unknown'} Merger Agreement`,
          provision_types: selectedTypes,
          preview: true,
        }),
      });

      const allProvs = [];
      (ingestData.results || []).forEach(r => {
        (r.provisions || []).forEach(p => {
          allProvs.push({ ...p, _id: Math.random().toString(36).substr(2, 9) });
        });
      });

      setPreviewProvisions(allProvs);
      setStep('preview');
    } catch (err) {
      setError(err.message);
      setStep('needtext');
    }
    setProcessing(false);
    setProcessingMsg('');
  };

  // Edit provision in preview
  const updateProvision = useCallback((id, field, value) => {
    setPreviewProvisions(prev => prev.map(p =>
      p._id === id ? { ...p, [field]: value } : p
    ));
  }, []);

  const removeProvision = useCallback((id) => {
    setPreviewProvisions(prev => prev.filter(p => p._id !== id));
  }, []);

  // Save to database
  const saveToDatabase = async () => {
    setProcessing(true);
    setProcessingMsg('Creating deal...');
    setError(null);
    setStep('saving');

    try {
      let dealId = dealInfo?.id;

      if (!dealId && dealInfo) {
        const dealData = await safeFetch('/api/deals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acquirer: dealInfo.acquirer,
            target: dealInfo.target,
            value_usd: dealInfo.value_usd || null,
            announce_date: dealInfo.announce_date || null,
            sector: dealInfo.sector || null,
          }),
        });
        dealId = dealData.deal.id;
      }

      if (!dealId) throw new Error('No deal identified');

      const total = previewProvisions.length;
      let saved = 0;

      for (const prov of previewProvisions) {
        setProcessingMsg(`Saving provisions (${saved + 1}/${total})...`);
        const resp = await fetch('/api/provisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deal_id: dealId,
            type: prov.type,
            category: prov.category,
            full_text: prov.text,
            ai_favorability: prov.favorability || 'neutral',
            ai_metadata: prov.ai_suggested ? { ai_suggested: true, reason: prov.reason } : { ai_extracted: true },
          }),
        });
        const data = await resp.json();
        if (data.error) console.warn('Failed to save:', data.error);
        saved++;
      }

      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('preview');
    }
    setProcessing(false);
    setProcessingMsg('');
  };

  // Reset everything
  const reset = () => {
    setStep('input'); setDealInfo(null); setDescription(''); setPastedText('');
    setFiles([]); setPreviewProvisions([]); setDuplicateWarning(null);
    setError(null); setExtractedTextLength(0);
  };

  // Group provisions by type
  const groupedProvisions = {};
  previewProvisions.forEach(p => {
    if (!groupedProvisions[p.type]) groupedProvisions[p.type] = [];
    groupedProvisions[p.type].push(p);
  });

  const hasInput = inputMode === 'upload' ? files.length > 0
    : inputMode === 'paste' ? pastedText.length >= 500
    : description.trim().length > 0;

  return (
    <>
      <Head>
        <title>Add Agreement — Precedent Machine</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&family=Source+Sans+3:wght@300;400;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/spa.css" />
      </Head>

      <div id="app" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="header">
          <div className="logo">
            <div className="logo-dot" />
            <h1>Precedent Machine</h1>
          </div>
          <div className="nav">
            <a href="/" style={{ textDecoration: 'none' }}>
              <button className="nav-btn">Back to Comparison</button>
            </a>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px' }}>

            {/* Page title */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ font: '700 22px var(--serif)', color: 'var(--text)', marginBottom: 4 }}>
                Add Agreement
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>
                Upload a merger agreement file, paste text, or enter a deal name. AI extracts provisions for review before saving.
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div style={{
                padding: '10px 16px', marginBottom: 16, borderRadius: 8,
                background: 'var(--red-bg)', border: '1px solid #FFCDD2',
                fontSize: 12, color: 'var(--red)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{error}</span>
                <button onClick={() => setError(null)} style={{
                  background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16,
                }}>&times;</button>
              </div>
            )}

            {/* Processing banner */}
            {processing && (
              <div style={{
                padding: '14px 20px', marginBottom: 16, borderRadius: 8,
                background: 'var(--bg2)', border: '1px solid var(--gold-border)',
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 13, color: 'var(--text2)',
              }}>
                <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                {processingMsg || 'Processing...'}
              </div>
            )}

            {/* ═══ INPUT STEP ═══ */}
            {step === 'input' && (
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                overflow: 'hidden',
              }}>
                {/* Input mode tabs */}
                <div style={{
                  display: 'flex', borderBottom: '1px solid var(--border)',
                }}>
                  {[
                    { key: 'upload', label: 'Upload File' },
                    { key: 'paste', label: 'Paste Text' },
                    { key: 'name', label: 'Deal Name' },
                  ].map(m => (
                    <button key={m.key} onClick={() => setInputMode(m.key)} className="view-tab" style={{
                      borderBottomColor: inputMode === m.key ? 'var(--gold)' : 'transparent',
                      color: inputMode === m.key ? 'var(--text)' : 'var(--text3)',
                      fontWeight: inputMode === m.key ? 600 : 400,
                      padding: '10px 20px',
                    }}>
                      {m.label}
                    </button>
                  ))}
                </div>

                <div style={{ padding: 20 }}>
                  {/* Upload mode */}
                  {inputMode === 'upload' && (
                    <>
                      <div
                        onClick={() => fileRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--gold)'; }}
                        onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                        onDrop={e => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = 'var(--border)';
                          const dt = e.dataTransfer;
                          if (dt.files.length) setFiles(prev => [...prev, ...Array.from(dt.files)]);
                        }}
                        style={{
                          border: '2px dashed var(--border)', borderRadius: 8,
                          padding: '32px 16px', textAlign: 'center', cursor: 'pointer',
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{ fontSize: 28, color: 'var(--text4)', marginBottom: 6 }}>+</div>
                        <div style={{ font: '500 13px var(--sans)', color: 'var(--text2)' }}>
                          Drop files here or click to browse
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 4 }}>
                          ZIP, PDF, HTML, TXT, DOCX — or a ZIP containing multiple agreements
                        </div>
                      </div>
                      <input ref={fileRef} type="file" multiple
                        accept=".txt,.html,.htm,.zip,.doc,.docx,.pdf"
                        onChange={e => { setFiles(prev => [...prev, ...Array.from(e.target.files)]); e.target.value = ''; }}
                        style={{ display: 'none' }}
                      />
                      {files.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          {files.map((f, i) => (
                            <div key={i} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '7px 12px', borderRadius: 6, background: 'var(--bg)',
                              border: '1px solid var(--border)', marginBottom: 4, fontSize: 12,
                            }}>
                              <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{f.name}</span>
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: 'var(--text4)' }}>
                                  {f.size > 1024 * 1024 ? (f.size / (1024 * 1024)).toFixed(1) + ' MB' : (f.size / 1024).toFixed(0) + ' KB'}
                                </span>
                                <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} style={{
                                  background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11,
                                }}>Remove</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Optional deal description hint */}
                      <div style={{ marginTop: 14 }}>
                        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text4)', display: 'block', marginBottom: 4 }}>
                          Deal description (optional — helps identify the deal)
                        </label>
                        <input
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          placeholder="e.g. Broadcom / VMware merger"
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: 6,
                            border: '1px solid var(--border)', background: 'var(--bg)',
                            font: '400 12px var(--sans)', color: 'var(--text)', outline: 'none',
                          }}
                          onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                          onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                      </div>
                    </>
                  )}

                  {/* Paste mode */}
                  {inputMode === 'paste' && (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text4)', display: 'block', marginBottom: 4 }}>
                          Deal description (optional)
                        </label>
                        <input
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          placeholder="e.g. Broadcom / VMware merger"
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: 6,
                            border: '1px solid var(--border)', background: 'var(--bg)',
                            font: '400 12px var(--sans)', color: 'var(--text)', outline: 'none',
                          }}
                          onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                          onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                      </div>
                      <textarea
                        value={pastedText}
                        onChange={e => setPastedText(e.target.value)}
                        rows={12}
                        placeholder="Paste the full merger agreement text here..."
                        style={{
                          width: '100%', padding: '12px 14px', borderRadius: 6,
                          border: '1px solid var(--border)', background: 'var(--bg)',
                          font: '400 12px/1.7 var(--serif)', color: 'var(--text2)',
                          resize: 'vertical', outline: 'none', minHeight: 180,
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                      />
                      {pastedText && (
                        <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 4 }}>
                          {pastedText.length.toLocaleString()} characters &middot; ~{pastedText.split(/\s+/).filter(Boolean).length.toLocaleString()} words
                          {pastedText.length < 500 && <span style={{ color: 'var(--red)' }}> &middot; Need {500 - pastedText.length} more characters</span>}
                        </div>
                      )}
                    </>
                  )}

                  {/* Name mode */}
                  {inputMode === 'name' && (
                    <>
                      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.5 }}>
                        Describe the deal. AI will identify it. You can then upload or paste the agreement text.
                      </p>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={3}
                        placeholder="e.g. Broadcom's acquisition of VMware announced in May 2022 for about $61 billion..."
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: 6,
                          border: '1px solid var(--border)', background: 'var(--bg)',
                          font: '400 13px var(--sans)', color: 'var(--text)', resize: 'vertical', outline: 'none',
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                      />
                    </>
                  )}

                  {/* Provision type selection */}
                  {inputMode !== 'name' && (
                    <div style={{ marginTop: 16 }}>
                      <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text4)', display: 'block', marginBottom: 6 }}>
                        Provision types to extract
                      </label>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {PROVISION_TYPES.map(t => (
                          <button key={t.key}
                            onClick={() => setSelectedTypes(prev =>
                              prev.includes(t.key) ? prev.filter(x => x !== t.key) : [...prev, t.key]
                            )}
                            className="filter-chip"
                            style={{
                              background: selectedTypes.includes(t.key) ? 'var(--gold-light)' : 'var(--bg2)',
                              borderColor: selectedTypes.includes(t.key) ? 'var(--gold)' : 'var(--border2)',
                              color: selectedTypes.includes(t.key) ? 'var(--gold)' : 'var(--text4)',
                            }}
                          >
                            {t.key}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ═══ GO BUTTON ═══ */}
                  <div style={{ marginTop: 20 }}>
                    <button
                      onClick={handleGo}
                      disabled={processing || !hasInput}
                      style={{
                        width: '100%', padding: '14px 24px', borderRadius: 8,
                        background: 'var(--gold)', color: '#fff', border: 'none',
                        font: '700 14px var(--sans)', cursor: 'pointer',
                        opacity: (processing || !hasInput) ? 0.4 : 1,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {processing ? (processingMsg || 'Processing...') : (
                        inputMode === 'name' ? 'Find Deal' : 'Extract Provisions'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ EXTRACTING STEP ═══ */}
            {step === 'extracting' && (
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '48px 20px', textAlign: 'center',
              }}>
                <svg className="spinner" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" style={{ marginBottom: 14 }}>
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                <div style={{ font: '600 15px var(--serif)', color: 'var(--text)', marginBottom: 6 }}>
                  Extracting Provisions
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                  AI is reading the agreement and identifying provisions across {selectedTypes.length} categories.
                  <br />This typically takes 30-90 seconds.
                </div>
                {extractedTextLength > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 8 }}>
                    Analyzing {extractedTextLength.toLocaleString()} characters of agreement text
                  </div>
                )}
              </div>
            )}

            {/* ═══ NEEDTEXT STEP (deal identified, now need agreement text) ═══ */}
            {step === 'needtext' && (
              <>
                {/* Deal info card */}
                {dealInfo && (
                  <div style={{
                    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                    padding: '14px 16px', marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ font: '700 15px var(--serif)', color: 'var(--text)', marginBottom: 4 }}>
                          {dealInfo.acquirer} / {dealInfo.target}
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
                          {dealInfo.value_usd && <span>Value: ${(dealInfo.value_usd / 1e9).toFixed(1)}B</span>}
                          {dealInfo.sector && <span>Sector: {dealInfo.sector}</span>}
                          {dealInfo.announce_date && <span>Date: {dealInfo.announce_date}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {dealInfo.id && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                            background: 'var(--green-bg)', color: 'var(--green)',
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                          }}>Existing</span>
                        )}
                        <button onClick={() => { setStep('input'); setDealInfo(null); }} style={{
                          background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        }}>Change</button>
                      </div>
                    </div>
                    {duplicateWarning && (
                      <div style={{
                        marginTop: 8, padding: '6px 10px', borderRadius: 5,
                        background: 'var(--yellow-bg)', border: '1px solid #FFE082',
                        fontSize: 11, color: 'var(--yellow)',
                      }}>{duplicateWarning.message}</div>
                    )}
                  </div>
                )}

                {/* Now provide agreement text */}
                <div style={{
                  background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '10px 16px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ font: '600 13px var(--serif)', color: 'var(--text)' }}>
                      Provide Agreement Text
                    </span>
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                      <button onClick={() => setInputMode('upload')} className="action-btn" style={{
                        background: inputMode !== 'paste' ? 'var(--text)' : 'var(--bg2)',
                        color: inputMode !== 'paste' ? '#fff' : 'var(--text3)',
                        borderColor: inputMode !== 'paste' ? 'var(--text)' : 'var(--border2)',
                      }}>Upload File</button>
                      <button onClick={() => setInputMode('paste')} className="action-btn" style={{
                        background: inputMode === 'paste' ? 'var(--text)' : 'var(--bg2)',
                        color: inputMode === 'paste' ? '#fff' : 'var(--text3)',
                        borderColor: inputMode === 'paste' ? 'var(--text)' : 'var(--border2)',
                      }}>Paste Text</button>
                    </div>

                    {inputMode === 'paste' ? (
                      <>
                        <textarea
                          value={pastedText}
                          onChange={e => setPastedText(e.target.value)}
                          rows={10}
                          placeholder="Paste the full merger agreement text here..."
                          style={{
                            width: '100%', padding: '12px 14px', borderRadius: 6,
                            border: '1px solid var(--border)', background: 'var(--bg)',
                            font: '400 12px/1.7 var(--serif)', color: 'var(--text2)',
                            resize: 'vertical', outline: 'none', minHeight: 140,
                          }}
                        />
                        {pastedText && (
                          <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 4 }}>
                            {pastedText.length.toLocaleString()} characters
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div
                          onClick={() => fileRef.current?.click()}
                          style={{
                            border: '2px dashed var(--border)', borderRadius: 8,
                            padding: '28px 16px', textAlign: 'center', cursor: 'pointer',
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                        >
                          <div style={{ fontSize: 24, color: 'var(--text4)', marginBottom: 4 }}>+</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Click to select files</div>
                          <div style={{ fontSize: 10, color: 'var(--text5)', marginTop: 2 }}>ZIP, PDF, HTML, TXT, DOCX</div>
                        </div>
                        <input ref={fileRef} type="file" multiple accept=".txt,.html,.htm,.zip,.doc,.docx,.pdf"
                          onChange={e => { setFiles(prev => [...prev, ...Array.from(e.target.files)]); e.target.value = ''; }}
                          style={{ display: 'none' }}
                        />
                        {files.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            {files.map((f, i) => (
                              <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '6px 12px', borderRadius: 6, background: 'var(--bg)',
                                border: '1px solid var(--border)', marginBottom: 4, fontSize: 12,
                              }}>
                                <span>{f.name}</span>
                                <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} style={{
                                  background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11,
                                }}>Remove</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Provision types */}
                    <div style={{ marginTop: 14 }}>
                      <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text4)', display: 'block', marginBottom: 6 }}>
                        Provision types to extract
                      </label>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {PROVISION_TYPES.map(t => (
                          <button key={t.key}
                            onClick={() => setSelectedTypes(prev =>
                              prev.includes(t.key) ? prev.filter(x => x !== t.key) : [...prev, t.key]
                            )}
                            className="filter-chip"
                            style={{
                              background: selectedTypes.includes(t.key) ? 'var(--gold-light)' : 'var(--bg2)',
                              borderColor: selectedTypes.includes(t.key) ? 'var(--gold)' : 'var(--border2)',
                              color: selectedTypes.includes(t.key) ? 'var(--gold)' : 'var(--text4)',
                            }}
                          >{t.key}</button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: 20 }}>
                      <button
                        onClick={handleGoWithText}
                        disabled={processing || (inputMode === 'paste' ? pastedText.length < 500 : files.length === 0)}
                        style={{
                          width: '100%', padding: '14px 24px', borderRadius: 8,
                          background: 'var(--gold)', color: '#fff', border: 'none',
                          font: '700 14px var(--sans)', cursor: 'pointer',
                          opacity: (processing || (inputMode === 'paste' ? pastedText.length < 500 : files.length === 0)) ? 0.4 : 1,
                        }}
                      >
                        Extract Provisions
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ═══ PREVIEW STEP ═══ */}
            {(step === 'preview' || step === 'saving') && (
              <>
                {/* Deal + summary bar */}
                <div style={{
                  background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                  padding: '14px 16px', marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      {dealInfo && (
                        <div style={{ font: '700 15px var(--serif)', color: 'var(--text)', marginBottom: 4 }}>
                          {dealInfo.acquirer} / {dealInfo.target}
                          {dealInfo.id && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'var(--green-bg)', color: 'var(--green)', marginLeft: 8, verticalAlign: 'middle' }}>EXISTING</span>}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                        {previewProvisions.length} provisions extracted across {Object.keys(groupedProvisions).length} categories.
                        Review, edit text, adjust favorability, or remove before saving.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setStep('input'); setPreviewProvisions([]); }} className="action-btn" disabled={processing}>
                        Start Over
                      </button>
                      <button
                        onClick={saveToDatabase}
                        disabled={processing || previewProvisions.length === 0}
                        className="save-btn"
                        style={{
                          padding: '10px 20px', fontSize: 13,
                          opacity: (processing || previewProvisions.length === 0) ? 0.4 : 1,
                        }}
                      >
                        {step === 'saving' ? (processingMsg || 'Saving...') : 'Confirm & Save'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Provision cards by type */}
                {Object.keys(groupedProvisions).map(typeKey => {
                  const provs = groupedProvisions[typeKey];
                  const typeLabel = PROVISION_TYPES.find(t => t.key === typeKey)?.label || typeKey;
                  return (
                    <div key={typeKey} style={{ marginBottom: 20 }}>
                      <div className="provision-section-divider">
                        {typeLabel}
                        <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                          {provs.length} provision{provs.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {provs.map(prov => (
                        <PreviewCard key={prov._id} prov={prov} onUpdate={updateProvision} onRemove={removeProvision} disabled={processing} />
                      ))}
                    </div>
                  );
                })}

                {/* Bottom save */}
                {previewProvisions.length > 0 && (
                  <div style={{ marginTop: 8, marginBottom: 40 }}>
                    <button
                      onClick={saveToDatabase}
                      disabled={processing}
                      className="save-btn"
                      style={{ width: '100%', padding: '14px', fontSize: 14, opacity: processing ? 0.4 : 1 }}
                    >
                      {step === 'saving' ? (processingMsg || 'Saving...') : `Confirm & Save ${previewProvisions.length} Provisions`}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ═══ DONE STEP ═══ */}
            {step === 'done' && (
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '48px 20px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 36, color: 'var(--green)', marginBottom: 10 }}>{'\u2713'}</div>
                <div style={{ font: '700 18px var(--serif)', color: 'var(--text)', marginBottom: 6 }}>
                  Agreement Saved
                </div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>
                  {previewProvisions.length} provisions from{' '}
                  <strong>{dealInfo?.acquirer} / {dealInfo?.target}</strong>{' '}
                  saved to database.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <a href="/" style={{ textDecoration: 'none' }}>
                    <button className="action-btn compare" style={{ padding: '10px 20px' }}>
                      View in Comparison Tool
                    </button>
                  </a>
                  <button onClick={reset} className="action-btn" style={{ padding: '10px 20px' }}>
                    Add Another
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════
// Preview Provision Card
// ═══════════════════════════════════════════════════
function PreviewCard({ prov, onUpdate, onRemove, disabled }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(prov.text);
  const [showFav, setShowFav] = useState(false);

  const fav = FAV_LEVELS.find(f => f.key === prov.favorability);

  return (
    <div className="prong-card" style={{ marginBottom: 8, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <div className="prong-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="prong-name">{prov.category}</span>
          {prov.ai_suggested && (
            <span style={{
              fontSize: 9, padding: '2px 6px', borderRadius: 3,
              background: 'var(--blue-bg)', color: 'var(--blue)',
              fontWeight: 600, letterSpacing: '0.3px',
            }}>AI-SUGGESTED</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Fav badge */}
          <div style={{ position: 'relative' }}>
            <span className={`fav-badge ${prov.favorability || 'unrated'}`}
              onClick={() => setShowFav(!showFav)}>
              {fav ? fav.label : 'Rate'}
            </span>
            {showFav && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                padding: 4, minWidth: 160, zIndex: 10,
              }}>
                {FAV_LEVELS.map(f => (
                  <div key={f.key} className="fav-option" onClick={() => { onUpdate(prov._id, 'favorability', f.key); setShowFav(false); }}>
                    <div className="fav-dot" style={{ background: f.color }} />
                    {f.label}
                  </div>
                ))}
                <div className="fav-option" onClick={() => { onUpdate(prov._id, 'favorability', 'unrated'); setShowFav(false); }}
                  style={{ color: 'var(--text4)' }}>Clear</div>
              </div>
            )}
          </div>
          <button onClick={() => {
            if (editing) { onUpdate(prov._id, 'text', editText); setEditing(false); }
            else { setEditText(prov.text); setEditing(true); }
          }} className="admin-edit" style={{ opacity: 1, color: editing ? 'var(--green)' : 'var(--gold)' }}>
            {editing ? 'Save' : 'Edit'}
          </button>
          <button onClick={() => onRemove(prov._id)} className="admin-edit" style={{ opacity: 1, color: 'var(--red)' }}>
            Remove
          </button>
        </div>
      </div>
      <div style={{ padding: '12px 16px' }}>
        {editing ? (
          <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{
            width: '100%', minHeight: 100, padding: '10px 12px', borderRadius: 6,
            border: '1px solid var(--gold)', background: 'var(--bg)',
            font: '400 12px/1.65 var(--serif)', color: 'var(--text2)',
            resize: 'vertical', outline: 'none',
          }} />
        ) : (
          <div className="prong-text">{prov.text}</div>
        )}
        {prov.reason && (
          <div style={{
            marginTop: 8, padding: '6px 10px', borderRadius: 5,
            background: 'var(--blue-bg)', fontSize: 11, color: 'var(--blue)',
            borderLeft: '3px solid var(--blue)',
          }}>
            AI rationale: {prov.reason}
          </div>
        )}
      </div>
    </div>
  );
}
