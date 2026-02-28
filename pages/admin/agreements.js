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

// Collects warnings during file parsing so we can show them
let _parseWarnings = [];

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

  // PDF — parse client-side using pdf.js from CDN
  if (lc.endsWith('.pdf')) {
    if (typeof window === 'undefined' || !window.pdfjsLib) {
      throw new Error(`[${name}] PDF.js not loaded. Refresh the page and try again.`);
    }
    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    } catch (err) {
      throw new Error(`[${name}] Invalid PDF: ${err.message}`);
    }

    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(' '));
    }
    const text = pages.join('\n\n').trim();
    if (!text) {
      _parseWarnings.push(`${name}: PDF has ${pdf.numPages} pages but no extractable text (may be scanned/image-based)`);
      return '';
    }
    return text;
  }

  // DOCX / DOC — extract text from word/document.xml inside the zip
  if (lc.endsWith('.docx') || lc.endsWith('.doc')) {
    let zip;
    try { zip = await JSZip.loadAsync(buf); } catch {
      throw new Error(`[${name}] Not a valid DOCX file`);
    }
    const docXml = zip.file('word/document.xml');
    if (!docXml) {
      // Might be old .doc binary format
      _parseWarnings.push(`${name}: Old .doc format not supported — save as .docx`);
      return '';
    }
    const xml = await docXml.async('string');
    return xml
      .replace(/<w:br[^>]*\/>/gi, '\n')
      .replace(/<\/w:p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // ZIP — extract supported files from inside
  if (lc.endsWith('.zip')) {
    let zip;
    try { zip = await JSZip.loadAsync(buf); } catch {
      throw new Error(`[${name}] Not a valid ZIP file`);
    }
    const entries = Object.entries(zip.files);
    const supported = ['.txt', '.html', '.htm', '.pdf', '.doc', '.docx'];
    const texts = [];
    let processed = 0;

    for (const [entryName, entry] of entries) {
      if (entry.dir) continue;
      const entryLc = entryName.toLowerCase();
      if (entryLc.startsWith('__macosx') || entryName.startsWith('.') || entryName.includes('/._')) continue;
      if (!supported.some(ext => entryLc.endsWith(ext))) continue;

      try {
        const entryBuf = await entry.async('arraybuffer');
        const text = await extractTextFromBuffer(entryName, entryBuf);
        processed++;
        if (text && text.trim().length > 20) texts.push(text.trim());
      } catch (err) {
        _parseWarnings.push(`${entryName}: ${err.message}`);
      }
    }

    if (processed === 0) {
      const allNames = entries.filter(([,e]) => !e.dir).map(([n]) => n);
      throw new Error(`ZIP contains no supported files. Found: ${allNames.slice(0, 5).join(', ')}${allNames.length > 5 ? '...' : ''}`);
    }
    return texts.join('\n\n---\n\n');
  }

  // Fallback: try as text
  try {
    const text = new TextDecoder().decode(buf);
    if (text.length > 0 && !/[\x00-\x08\x0E-\x1F]/.test(text.substring(0, 500))) {
      return text;
    }
  } catch { /* not decodable */ }
  _parseWarnings.push(`${name}: Unrecognized file format`);
  return '';
}

async function extractTextFromFile(file) {
  const buf = await file.arrayBuffer();
  return extractTextFromBuffer(file.name, buf);
}

async function extractTextFromFiles(fileList, onStatus) {
  _parseWarnings = [];
  const texts = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (onStatus) onStatus(`Reading ${file.name} (${i + 1}/${fileList.length})...`);
    try {
      const text = await extractTextFromFile(file);
      if (text) texts.push(text);
    } catch (err) {
      _parseWarnings.push(err.message);
    }
  }
  return { text: texts.join('\n\n'), warnings: _parseWarnings.slice() };
}

const PROVISION_TYPES = [
  { key: 'MAE', label: 'Material Adverse Effect' },
  { key: 'IOC', label: 'Interim Operating Covenants' },
  { key: 'ANTI', label: 'Antitrust / Regulatory Efforts' },
  { key: 'COND', label: 'Conditions to Closing' },
  { key: 'TERMR', label: 'Termination Rights' },
  { key: 'TERMF', label: 'Termination Fees' },
  { key: 'DEF', label: 'Definitions' },
  { key: 'REP', label: 'Representations & Warranties' },
  { key: 'COV', label: 'Covenants' },
  { key: 'MISC', label: 'Miscellaneous' },
  { key: 'STRUCT', label: 'Deal Structure' },
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
  const [parseWarnings, setParseWarnings] = useState([]);
  const [agreementSourceId, setAgreementSourceId] = useState(null);
  const [fullAgreementText, setFullAgreementText] = useState('');
  const [deduplicatedCount, setDeduplicatedCount] = useState(0);
  const [extractionMode, setExtractionMode] = useState('segment'); // 'segment' | 'legacy'
  const [timingData, setTimingData] = useState(null);
  const [diagnosticsData, setDiagnosticsData] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [reviewInput, setReviewInput] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewRules, setReviewRules] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('importRules') || '[]'); } catch { return []; }
    }
    return [];
  });
  const [undoStack, setUndoStack] = useState([]);
  const reviewEndRef = useRef(null);

  // ─── Shared: extract text from current inputs ───
  const getAgreementText = async () => {
    if (inputMode === 'upload') {
      if (!files.length) throw new Error('Select at least one file.');
      setProcessingMsg('Reading files...');
      const result = await extractTextFromFiles(files, (msg) => setProcessingMsg(msg));
      if (result.warnings.length) setParseWarnings(result.warnings);
      if (!result.text || result.text.length < 200) {
        const warnMsg = result.warnings.length
          ? '\n\nFile issues:\n• ' + result.warnings.join('\n• ')
          : '';
        throw new Error(`Could not extract enough text from files (got ${result.text.length} chars). Ensure files contain readable text (PDF, DOCX, HTML, or TXT).${warnMsg}`);
      }
      return result.text;
    } else if (inputMode === 'paste') {
      if (!pastedText || pastedText.length < 500) throw new Error('Need at least 500 characters of agreement text.');
      return pastedText;
    }
    return '';
  };

  // ─── Shared: identify deal then extract provisions ───
  const identifyAndExtract = async (fullText) => {
    // Store the full agreement text for the text selector
    setFullAgreementText(fullText);

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

    // Store full agreement text in agreement_sources
    setProcessingMsg('Storing agreement text...');
    const titleStr = `${findData.deal?.acquirer || 'Unknown'} / ${findData.deal?.target || 'Unknown'} Merger Agreement`;
    try {
      const storeData = await safeFetch('/api/admin/store-agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_text: fullText, title: titleStr }),
      });
      setAgreementSourceId(storeData.id);
    } catch (err) {
      console.warn('Failed to store agreement source:', err.message);
    }

    // Extract provisions in preview mode
    setStep('extracting');
    const endpoint = extractionMode === 'segment' ? '/api/ingest/segment' : '/api/ingest/agreement';
    setProcessingMsg(extractionMode === 'segment'
      ? 'Parsing structure & extracting provisions...'
      : 'Extracting provisions (this may take a minute)...');
    const ingestBody = extractionMode === 'segment'
      ? { full_text: fullText, title: titleStr, preview: true, rules: reviewRules.length > 0 ? reviewRules : undefined }
      : { full_text: fullText, title: titleStr, provision_types: selectedTypes, preview: true };
    const ingestData = await safeFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ingestBody),
    });

    if (ingestData.timing) setTimingData(ingestData.timing);
    if (ingestData.diagnostics) setDiagnosticsData(ingestData.diagnostics);

    const allProvs = [];
    (ingestData.results || []).forEach(r => {
      (r.provisions || []).forEach(p => {
        allProvs.push({ ...p, _originalText: p.text, _id: Math.random().toString(36).substr(2, 9), display_tier: p.display_tier || 2, sort_order: p.sort_order ?? 999 });
      });
    });
    allProvs.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
    setDeduplicatedCount(ingestData.deduplicated_count || 0);
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
      let fileWarnings = [];
      if (pastedText) {
        fullText = pastedText;
      } else if (files.length > 0) {
        setProcessingMsg('Reading files...');
        const result = await extractTextFromFiles(files, (msg) => setProcessingMsg(msg));
        fullText = result.text;
        fileWarnings = result.warnings;
        if (fileWarnings.length) setParseWarnings(fileWarnings);
      }

      if (!fullText || fullText.length < 500) {
        const warnMsg = fileWarnings.length
          ? '\n\nFile issues:\n• ' + fileWarnings.join('\n• ')
          : '';
        setError(`Need at least 500 characters of agreement text.${warnMsg}`);
        setProcessing(false);
        return;
      }

      setExtractedTextLength(fullText.length);
      setFullAgreementText(fullText);

      // Store full agreement text in agreement_sources
      setProcessingMsg('Storing agreement text...');
      const titleStr = `${dealInfo?.acquirer || 'Unknown'} / ${dealInfo?.target || 'Unknown'} Merger Agreement`;
      try {
        const storeData = await safeFetch('/api/admin/store-agreement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_text: fullText, title: titleStr }),
        });
        setAgreementSourceId(storeData.id);
      } catch (err) {
        console.warn('Failed to store agreement source:', err.message);
      }

      setStep('extracting');
      const endpoint = extractionMode === 'segment' ? '/api/ingest/segment' : '/api/ingest/agreement';
      setProcessingMsg(extractionMode === 'segment'
        ? 'Parsing structure & extracting provisions...'
        : 'Extracting provisions (this may take a minute)...');
      const ingestBody = extractionMode === 'segment'
        ? { full_text: fullText, title: titleStr, preview: true, rules: reviewRules.length > 0 ? reviewRules : undefined }
        : { full_text: fullText, title: titleStr, provision_types: selectedTypes, preview: true };

      const ingestData = await safeFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ingestBody),
      });

      if (ingestData.timing) setTimingData(ingestData.timing);
      if (ingestData.diagnostics) setDiagnosticsData(ingestData.diagnostics);

      const allProvs = [];
      (ingestData.results || []).forEach(r => {
        (r.provisions || []).forEach(p => {
          allProvs.push({ ...p, _originalText: p.text, _id: Math.random().toString(36).substr(2, 9), display_tier: p.display_tier || 2, sort_order: p.sort_order ?? 999 });
        });
      });
      allProvs.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));

      setDeduplicatedCount(ingestData.deduplicated_count || 0);
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
        const userCorrected = prov._originalText && prov.text !== prov._originalText;
        const metadata = prov.ai_suggested
          ? { ai_suggested: true, reason: prov.reason }
          : { ai_extracted: true };
        if (userCorrected) {
          metadata.user_corrected = true;
          metadata.original_ai_text = prov._originalText;
        }
        if (timingData) metadata.ingestion_timing = timingData;
        metadata.ingestion_mode = extractionMode;
        const resp = await fetch('/api/provisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deal_id: dealId,
            type: prov.type,
            category: prov.category,
            full_text: prov.text,
            ai_favorability: prov.favorability || 'neutral',
            agreement_source_id: agreementSourceId || null,
            ai_metadata: metadata,
            display_tier: prov.display_tier || 2,
            sort_order: prov.sort_order ?? 0,
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
    setError(null); setExtractedTextLength(0); setParseWarnings([]);
    setAgreementSourceId(null); setFullAgreementText(''); setDeduplicatedCount(0);
    setTimingData(null); setDiagnosticsData(null); setReviewOpen(false); setReviewHistory([]);
    setUndoStack([]); setReviewInput('');
  };

  // Execute review actions from AI
  const executeReviewActions = useCallback((actions) => {
    if (!actions || actions.length === 0) return { updates: 0, removes: 0, adds: 0 };
    // Save current state for undo
    setUndoStack(prev => [...prev, [...previewProvisions]]);
    let updates = 0, removes = 0, adds = 0;
    setPreviewProvisions(prev => {
      let next = [...prev];
      for (const act of actions) {
        if (act.action === 'update' && act.id && act.field && act.value !== undefined) {
          next = next.map(p => p._id === act.id ? { ...p, [act.field]: act.value } : p);
          updates++;
        } else if (act.action === 'remove' && act.id) {
          next = next.filter(p => p._id !== act.id);
          removes++;
        } else if (act.action === 'add' && act.provision) {
          const newProv = {
            ...act.provision,
            _id: Math.random().toString(36).substr(2, 9),
            _originalText: act.provision.text,
            display_tier: act.provision.display_tier || 2,
            sort_order: next.length,
          };
          next.push(newProv);
          adds++;
        }
      }
      return next;
    });
    return { updates, removes, adds };
  }, [previewProvisions]);

  // Undo last action batch
  const undoLastReview = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setPreviewProvisions(last);
      return prev.slice(0, -1);
    });
  }, []);

  // Send review message
  const sendReviewMessage = async () => {
    const msg = reviewInput.trim();
    if (!msg || reviewLoading) return;
    setReviewInput('');
    setReviewLoading(true);

    const newHistory = [...reviewHistory, { role: 'user', content: msg }];
    setReviewHistory(newHistory);

    try {
      const resp = await safeFetch('/api/ingest/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          provisions: previewProvisions,
          agreement_text: fullAgreementText,
          history: newHistory,
          rules: reviewRules,
        }),
      });

      let actionSummary = '';
      if (resp.actions && resp.actions.length > 0) {
        const counts = executeReviewActions(resp.actions);
        const parts = [];
        if (counts.updates > 0) parts.push(`updated ${counts.updates}`);
        if (counts.removes > 0) parts.push(`removed ${counts.removes}`);
        if (counts.adds > 0) parts.push(`added ${counts.adds}`);
        actionSummary = parts.length > 0 ? `\n\n_Actions: ${parts.join(', ')}_` : '';
      }

      if (resp.rules && resp.rules.length > 0) {
        const updated = [...reviewRules, ...resp.rules];
        setReviewRules(updated);
        try { localStorage.setItem('importRules', JSON.stringify(updated)); } catch {}
      }

      setReviewHistory(prev => [...prev, {
        role: 'assistant',
        content: resp.message + actionSummary,
        actions: resp.actions,
        rules: resp.rules,
      }]);
    } catch (err) {
      setReviewHistory(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    }

    setReviewLoading(false);
    setTimeout(() => reviewEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Delete a saved rule
  const deleteRule = (idx) => {
    const updated = reviewRules.filter((_, i) => i !== idx);
    setReviewRules(updated);
    try { localStorage.setItem('importRules', JSON.stringify(updated)); } catch {}
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
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
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
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}>
                <span style={{ whiteSpace: 'pre-wrap' }}>{error}</span>
                <button onClick={() => setError(null)} style={{
                  background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16,
                }}>&times;</button>
              </div>
            )}

            {/* Parse warnings banner */}
            {parseWarnings.length > 0 && !error && (
              <div style={{
                padding: '10px 16px', marginBottom: 16, borderRadius: 8,
                background: '#FFF8E1', border: '1px solid #FFE082',
                fontSize: 12, color: '#F57F17',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  <strong>File warnings:</strong>{'\n'}{'• ' + parseWarnings.join('\n• ')}
                </div>
                <button onClick={() => setParseWarnings([])} style={{
                  background: 'none', border: 'none', color: '#F57F17', cursor: 'pointer', fontSize: 16,
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

                  {/* Extraction mode toggle */}
                  {inputMode !== 'name' && (
                    <div style={{ marginTop: 16 }}>
                      <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text4)', display: 'block', marginBottom: 6 }}>
                        Extraction mode
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => setExtractionMode('segment')}
                          className="filter-chip"
                          style={{
                            background: extractionMode === 'segment' ? 'var(--gold-light)' : 'var(--bg2)',
                            borderColor: extractionMode === 'segment' ? 'var(--gold)' : 'var(--border2)',
                            color: extractionMode === 'segment' ? 'var(--gold)' : 'var(--text4)',
                          }}
                        >
                          Full parse (recommended)
                        </button>
                        <button
                          onClick={() => setExtractionMode('legacy')}
                          className="filter-chip"
                          style={{
                            background: extractionMode === 'legacy' ? 'var(--gold-light)' : 'var(--bg2)',
                            borderColor: extractionMode === 'legacy' ? 'var(--gold)' : 'var(--border2)',
                            color: extractionMode === 'legacy' ? 'var(--gold)' : 'var(--text4)',
                          }}
                        >
                          Legacy search
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Provision type selection (legacy mode only) */}
                  {inputMode !== 'name' && extractionMode === 'legacy' && (
                    <div style={{ marginTop: 12 }}>
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
                  {extractionMode === 'segment'
                    ? 'Parsing agreement structure, classifying sections, and extracting provisions.'
                    : `AI is reading the agreement and identifying provisions across ${selectedTypes.length} categories.`}
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
                        {deduplicatedCount > 0 && ` (${deduplicatedCount} duplicate${deduplicatedCount !== 1 ? 's' : ''} removed)`}
                        {' '}Review, edit text, adjust favorability, or remove before saving.
                      </div>
                      {timingData && (
                        <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                          {timingData.parse_ms != null && `Parsed: ${(timingData.parse_ms / 1000).toFixed(1)}s (${timingData.section_count} sections)`}
                          {timingData.classify_ms != null && ` | Classified: ${(timingData.classify_ms / 1000).toFixed(1)}s`}
                          {timingData.extract_ms != null && ` | Extracted: ${(timingData.extract_ms / 1000).toFixed(1)}s`}
                          {timingData.total_ms != null && ` | Total: ${(timingData.total_ms / 1000).toFixed(1)}s`}
                          {timingData.mode && ` (${timingData.mode})`}
                        </div>
                      )}
                      {diagnosticsData && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
                          {diagnosticsData.coverage && (
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                              background: diagnosticsData.coverage.coveragePct >= 95 ? 'var(--green-bg)' : diagnosticsData.coverage.coveragePct >= 80 ? 'var(--yellow-bg)' : 'var(--red-bg)',
                              color: diagnosticsData.coverage.coveragePct >= 95 ? 'var(--green)' : diagnosticsData.coverage.coveragePct >= 80 ? 'var(--yellow)' : 'var(--red)',
                            }}>
                              Coverage: {diagnosticsData.coverage.coveragePct}%
                            </span>
                          )}
                          {diagnosticsData.gaps && (diagnosticsData.gaps.detected > 0 || diagnosticsData.gaps.recovered > 0) && (
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                              background: diagnosticsData.gaps.detected === diagnosticsData.gaps.recovered ? 'var(--green-bg)' : 'var(--yellow-bg)',
                              color: diagnosticsData.gaps.detected === diagnosticsData.gaps.recovered ? 'var(--green)' : 'var(--yellow)',
                            }}>
                              Gaps: {diagnosticsData.gaps.detected} detected, {diagnosticsData.gaps.recovered} recovered
                            </span>
                          )}
                          {diagnosticsData.sectionBreakdown && (
                            <span style={{
                              fontSize: 10, padding: '2px 8px', borderRadius: 4,
                              background: 'var(--bg3)', color: 'var(--text3)',
                            }}>
                              Extraction: {diagnosticsData.sectionBreakdown.high} full + {diagnosticsData.sectionBreakdown.medium} structured + {diagnosticsData.sectionBreakdown.low} basic
                            </span>
                          )}
                          {diagnosticsData.completeness && diagnosticsData.completeness.length > 0 && diagnosticsData.completeness.map((w, i) => (
                            <span key={i} style={{
                              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                              background: 'var(--yellow-bg)', color: 'var(--yellow)',
                            }}>
                              {w.label}: {w.found}/{w.expected} found
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setStep('input'); setPreviewProvisions([]); }} className="action-btn" disabled={processing}>
                        Start Over
                      </button>
                      <button
                        onClick={() => setReviewOpen(true)}
                        disabled={processing}
                        className="action-btn compare"
                        style={{ padding: '10px 16px', fontSize: 13 }}
                      >
                        Review with AI
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
                        <PreviewCard key={prov._id} prov={prov} onUpdate={updateProvision} onRemove={removeProvision} disabled={processing} fullAgreementText={fullAgreementText} />
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

      {/* ═══ REVIEW PANEL (slide-out) ═══ */}
      {reviewOpen && (
        <div className="review-panel">
          <div className="review-panel-header">
            <div>
              <div style={{ font: '600 14px var(--serif)', color: 'var(--text)' }}>Review Import</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {previewProvisions.length} provisions &middot; Ask the AI to fix issues
              </div>
            </div>
            <button onClick={() => setReviewOpen(false)} style={{
              background: 'none', border: 'none', fontSize: 20, color: 'var(--text3)',
              cursor: 'pointer', padding: '0 4px',
            }}>&times;</button>
          </div>

          {/* Rules bar */}
          {reviewRules.length > 0 && (
            <div className="review-rules-bar">
              <div style={{ fontSize: 10, color: 'var(--text4)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Learned Rules ({reviewRules.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {reviewRules.map((r, i) => (
                  <span key={i} className="review-rule">
                    {r.rule.length > 60 ? r.rule.substring(0, 60) + '...' : r.rule}
                    <button onClick={() => deleteRule(i)} style={{
                      background: 'none', border: 'none', color: 'var(--text4)',
                      cursor: 'pointer', padding: '0 0 0 4px', fontSize: 12, lineHeight: 1,
                    }}>&times;</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          <div className="review-messages">
            {reviewHistory.length === 0 && (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text4)', fontSize: 12 }}>
                Ask the AI to review your import. Try:<br/>
                <em>"What provisions did you miss?"</em><br/>
                <em>"Reclassify the governing law provision as MISC"</em><br/>
                <em>"The no-solicitation should be COV, not IOC"</em>
              </div>
            )}
            {reviewHistory.map((msg, i) => (
              <div key={i} className={`review-msg review-msg-${msg.role}`}>
                <div className="review-msg-bubble">
                  {msg.content}
                </div>
                {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {msg.actions.map((a, j) => (
                      <span key={j} className={`review-action review-action-${a.action}`}>
                        {a.action === 'update' ? `Updated ${a.field}` : a.action === 'remove' ? 'Removed' : 'Added'}{a.action === 'update' ? `: ${(a.value || '').toString().substring(0, 30)}` : ''}
                      </span>
                    ))}
                  </div>
                )}
                {msg.role === 'assistant' && msg.rules && msg.rules.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    {msg.rules.map((r, j) => (
                      <span key={j} className="review-rule" style={{ marginRight: 4 }}>
                        New rule: {r.rule.substring(0, 50)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {reviewLoading && (
              <div className="review-msg review-msg-assistant">
                <div className="review-msg-bubble" style={{ color: 'var(--text4)' }}>Thinking...</div>
              </div>
            )}
            <div ref={reviewEndRef} />
          </div>

          {/* Undo bar */}
          {undoStack.length > 0 && (
            <div style={{
              padding: '6px 16px', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text4)' }}>{undoStack.length} action batch{undoStack.length !== 1 ? 'es' : ''}</span>
              <button onClick={undoLastReview} className="action-btn" style={{ padding: '4px 10px', fontSize: 11 }}>
                Undo Last
              </button>
            </div>
          )}

          {/* Input */}
          <div className="review-input-bar">
            <textarea
              value={reviewInput}
              onChange={e => setReviewInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReviewMessage(); } }}
              placeholder="Ask the AI to review or fix provisions..."
              rows={2}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg)',
                font: '400 12px/1.5 var(--serif)', color: 'var(--text)',
                resize: 'none', outline: 'none',
              }}
            />
            <button
              onClick={sendReviewMessage}
              disabled={reviewLoading || !reviewInput.trim()}
              style={{
                padding: '8px 16px', borderRadius: 6, border: 'none',
                background: 'var(--gold)', color: '#fff',
                font: '600 12px var(--sans)', cursor: 'pointer',
                opacity: (reviewLoading || !reviewInput.trim()) ? 0.4 : 1,
                alignSelf: 'flex-end',
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════
// Text Selector Panel — select provision text from full agreement
// ═══════════════════════════════════════════════════
function TextSelectorPanel({ fullText, currentText, onSelect, onClose }) {
  const containerRef = useRef(null);
  const [selectedText, setSelectedText] = useState('');

  // Find where the current provision text appears in the full agreement
  const highlightStart = fullText.indexOf(currentText);
  const highlightEnd = highlightStart >= 0 ? highlightStart + currentText.length : -1;

  // Scroll to the highlighted text on mount
  const scrollToHighlight = useCallback((node) => {
    if (node) {
      const mark = node.querySelector('.text-sel-highlight');
      if (mark) {
        setTimeout(() => mark.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      }
    }
  }, []);

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 10) {
      setSelectedText(sel.toString().trim());
    }
  };

  // Render full text with current provision highlighted
  const renderText = () => {
    if (highlightStart < 0) {
      return <span>{fullText}</span>;
    }
    return (
      <>
        <span>{fullText.substring(0, highlightStart)}</span>
        <span className="text-sel-highlight recode-sel">{fullText.substring(highlightStart, highlightEnd)}</span>
        <span>{fullText.substring(highlightEnd)}</span>
      </>
    );
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 100,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: '90vw', maxWidth: 900, height: '85vh',
        background: 'var(--bg2)', borderRadius: 12,
        border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ font: '600 14px var(--serif)', color: 'var(--text)' }}>
              Select Provision Text
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              Current text is highlighted in gold. Drag to select new text, then click "Apply Selection".
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20, color: 'var(--text3)',
            cursor: 'pointer', padding: '0 4px',
          }}>&times;</button>
        </div>

        {/* Selection bar */}
        {selectedText && (
          <div style={{
            padding: '8px 16px', borderBottom: '1px solid var(--border)',
            background: 'var(--gold-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>
              {selectedText.length.toLocaleString()} chars selected
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setSelectedText('')} style={{
                padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)',
                background: 'var(--bg2)', fontSize: 11, cursor: 'pointer', color: 'var(--text3)',
              }}>Clear</button>
              <button onClick={() => { onSelect(selectedText); onClose(); }} style={{
                padding: '4px 12px', borderRadius: 4, border: 'none',
                background: 'var(--gold)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>Apply Selection</button>
            </div>
          </div>
        )}

        {/* Scrollable text body */}
        <div
          ref={(node) => { containerRef.current = node; scrollToHighlight(node); }}
          onMouseUp={handleMouseUp}
          style={{
            flex: 1, overflowY: 'auto', padding: '16px 20px',
            font: '400 12px/1.75 var(--serif)', color: 'var(--text2)',
            whiteSpace: 'pre-wrap', userSelect: 'text', cursor: 'text',
          }}
        >
          {renderText()}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Preview Provision Card
// ═══════════════════════════════════════════════════
function PreviewCard({ prov, onUpdate, onRemove, disabled, fullAgreementText }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(prov.text);
  const [showFav, setShowFav] = useState(false);
  const [showTextSelector, setShowTextSelector] = useState(false);

  const fav = FAV_LEVELS.find(f => f.key === prov.favorability);

  return (
    <div className="prong-card" style={{ marginBottom: 8, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <div className="prong-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="prong-name">{prov.category}</span>
          {/* Tier badge — clickable to cycle */}
          <span
            onClick={() => {
              const next = prov.display_tier === 1 ? 2 : prov.display_tier === 2 ? 3 : 1;
              onUpdate(prov._id, 'display_tier', next);
            }}
            className={`tier-badge tier-${prov.display_tier || 2}`}
            title={`Tier ${prov.display_tier || 2} — click to change`}
          >
            T{prov.display_tier || 2}
          </span>
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
          {fullAgreementText && (
            <button onClick={() => setShowTextSelector(true)} className="admin-edit" style={{ opacity: 1, color: 'var(--blue, #1976D2)' }}>
              Select from text
            </button>
          )}
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
      {showTextSelector && fullAgreementText && (
        <TextSelectorPanel
          fullText={fullAgreementText}
          currentText={prov.text}
          onSelect={(newText) => {
            onUpdate(prov._id, 'text', newText);
            setEditText(newText);
          }}
          onClose={() => setShowTextSelector(false)}
        />
      )}
    </div>
  );
}
