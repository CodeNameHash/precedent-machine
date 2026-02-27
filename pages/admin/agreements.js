import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';

AddAgreements.noLayout = true;

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

function esc(s) { return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; }

export default function AddAgreements() {
  const fileRef = useRef(null);

  const [step, setStep] = useState(1); // 1=identify, 2=provide, 3=extract, 4=preview, 5=done
  const [description, setDescription] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [files, setFiles] = useState([]);
  const [inputMode, setInputMode] = useState('paste'); // paste | upload
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [dealInfo, setDealInfo] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState(PROVISION_TYPES.map(t => t.key));
  const [previewProvisions, setPreviewProvisions] = useState([]);
  const [previewResults, setPreviewResults] = useState(null);
  const [error, setError] = useState(null);
  const [saveComplete, setSaveComplete] = useState(false);

  // Step 1: Find deal from description
  const findDeal = async () => {
    if (!description.trim()) return;
    setProcessing(true);
    setProcessingMsg('Identifying deal...');
    setError(null);
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
      if (data.duplicate) setDuplicateWarning(data.duplicate);
      setStep(2);
    } catch (err) {
      setError(err.message);
    }
    setProcessing(false);
    setProcessingMsg('');
  };

  // Handle file upload
  const handleFiles = (e) => {
    setFiles(prev => [...prev, ...Array.from(e.target.files)]);
  };

  // Step 3: Extract provisions (preview mode)
  const extractProvisions = async () => {
    setProcessing(true);
    setError(null);
    setPreviewProvisions([]);

    // Get agreement text
    let fullText = '';
    if (inputMode === 'paste') {
      fullText = pastedText;
    } else if (inputMode === 'upload' && files.length > 0) {
      setProcessingMsg('Reading files...');
      for (const file of files) {
        const text = await file.text();
        fullText += text + '\n\n';
      }
    }

    if (!fullText || fullText.length < 500) {
      setError('Agreement text too short. Need at least 500 characters.');
      setProcessing(false);
      return;
    }

    // Extract in preview mode (no DB save)
    const totalTypes = selectedTypes.length;
    let completed = 0;
    setProcessingMsg(`Extracting provisions (0/${totalTypes} types)...`);
    setStep(3);

    try {
      const resp = await fetch('/api/ingest/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_text: fullText,
          title: `${dealInfo?.acquirer || 'Unknown'} / ${dealInfo?.target || 'Unknown'} Merger Agreement`,
          provision_types: selectedTypes,
          preview: true,
        }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      // Collect all provisions from results
      const allProvs = [];
      (data.results || []).forEach(r => {
        (r.provisions || []).forEach(p => {
          allProvs.push({ ...p, _id: Math.random().toString(36).substr(2, 9) });
        });
      });

      setPreviewProvisions(allProvs);
      setPreviewResults(data.results);
      setStep(4);
    } catch (err) {
      setError(err.message);
      setStep(2);
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

  // Step 5: Save to database
  const saveToDatabase = async () => {
    setProcessing(true);
    setProcessingMsg('Creating deal...');
    setError(null);

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
          }),
        });
        const dealData = await dealResp.json();
        if (dealData.error) throw new Error(dealData.error);
        dealId = dealData.deal.id;
      }

      if (!dealId) throw new Error('No deal identified');

      // Save each provision
      const total = previewProvisions.length;
      let saved = 0;
      setProcessingMsg(`Saving provisions (0/${total})...`);

      for (const prov of previewProvisions) {
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
        if (data.error) console.warn('Failed to save provision:', data.error);
        saved++;
        setProcessingMsg(`Saving provisions (${saved}/${total})...`);
      }

      setSaveComplete(true);
      setStep(5);
    } catch (err) {
      setError(err.message);
    }
    setProcessing(false);
    setProcessingMsg('');
  };

  // Group provisions by type for preview
  const groupedProvisions = {};
  previewProvisions.forEach(p => {
    if (!groupedProvisions[p.type]) groupedProvisions[p.type] = [];
    groupedProvisions[p.type].push(p);
  });

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

        {/* Steps indicator */}
        <div style={{
          padding: '14px 28px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg2)',
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
        }}>
          {[
            { n: 1, label: 'Identify Deal' },
            { n: 2, label: 'Provide Agreement' },
            { n: 3, label: 'Extract' },
            { n: 4, label: 'Preview & Edit' },
            { n: 5, label: 'Saved' },
          ].map((s, i) => (
            <div key={s.n} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              color: step >= s.n ? 'var(--gold)' : 'var(--text5)',
              fontWeight: step === s.n ? 600 : 400,
              fontSize: '12px',
              fontFamily: 'var(--sans)',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: step > s.n ? 'var(--gold)' : step === s.n ? 'var(--text)' : 'var(--bg)',
                color: step >= s.n ? '#fff' : 'var(--text5)',
                border: step === s.n ? 'none' : '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700,
              }}>
                {step > s.n ? '\u2713' : s.n}
              </div>
              {s.label}
              {i < 4 && <span style={{ color: 'var(--border)', marginLeft: '12px' }}>\u2014</span>}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
          <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px' }}>

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
                  background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 14,
                }}>&times;</button>
              </div>
            )}

            {/* Processing overlay */}
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

            {/* ═══ STEP 1: Identify Deal ═══ */}
            {step >= 1 && (
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                marginBottom: 16, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '10px 16px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ font: '600 13px var(--serif)', color: 'var(--text)' }}>
                    1. Identify the Deal
                  </span>
                  {dealInfo && step > 1 && (
                    <button onClick={() => { setStep(1); setDealInfo(null); setDuplicateWarning(null); }} style={{
                      background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600,
                    }}>Change</button>
                  )}
                </div>
                <div style={{ padding: 16 }}>
                  {!dealInfo ? (
                    <>
                      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.5 }}>
                        Describe the M&A deal. AI will identify the acquirer, target, and deal details.
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
                      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        <button
                          onClick={findDeal}
                          disabled={processing || !description.trim()}
                          className="save-btn"
                          style={{ opacity: (!description.trim() || processing) ? 0.4 : 1 }}
                        >
                          {processing ? 'Searching...' : 'Find Deal'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ font: '700 16px var(--serif)', color: 'var(--text)', marginBottom: 4 }}>
                            {dealInfo.acquirer} / {dealInfo.target}
                          </div>
                          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
                            {dealInfo.value_usd && <span>Value: ${(dealInfo.value_usd / 1e9).toFixed(1)}B</span>}
                            {dealInfo.sector && <span>Sector: {dealInfo.sector}</span>}
                            {dealInfo.announce_date && <span>Date: {dealInfo.announce_date}</span>}
                            {dealInfo.jurisdiction && <span>Jurisdiction: {dealInfo.jurisdiction}</span>}
                          </div>
                        </div>
                        {dealInfo.id && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                            background: 'var(--green-bg)', color: 'var(--green)',
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                          }}>Existing Deal</span>
                        )}
                      </div>
                      {duplicateWarning && (
                        <div style={{
                          marginTop: 10, padding: '8px 12px', borderRadius: 6,
                          background: 'var(--yellow-bg)', border: '1px solid #FFE082',
                          fontSize: 11, color: 'var(--yellow)',
                        }}>
                          {duplicateWarning.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ STEP 2: Provide Agreement Text ═══ */}
            {step >= 2 && step < 5 && (
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                marginBottom: 16, overflow: 'hidden',
                opacity: step < 2 ? 0.4 : 1, pointerEvents: step < 2 ? 'none' : 'auto',
              }}>
                <div style={{
                  padding: '10px 16px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ font: '600 13px var(--serif)', color: 'var(--text)' }}>
                    2. Provide Agreement Text
                  </span>
                  {step > 2 && (
                    <button onClick={() => setStep(2)} style={{
                      background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600,
                    }}>Change</button>
                  )}
                </div>
                <div style={{ padding: 16 }}>
                  {/* Input mode toggle */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                    {[
                      { key: 'paste', label: 'Paste Text' },
                      { key: 'upload', label: 'Upload File' },
                    ].map(m => (
                      <button key={m.key} onClick={() => setInputMode(m.key)} className="action-btn" style={{
                        background: inputMode === m.key ? 'var(--text)' : 'var(--bg2)',
                        color: inputMode === m.key ? '#fff' : 'var(--text3)',
                        borderColor: inputMode === m.key ? 'var(--text)' : 'var(--border2)',
                      }}>
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {inputMode === 'paste' && (
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
                        onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                      />
                      {pastedText && (
                        <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 4 }}>
                          {pastedText.length.toLocaleString()} characters &middot; ~{pastedText.split(/\s+/).filter(Boolean).length.toLocaleString()} words
                        </div>
                      )}
                    </>
                  )}

                  {inputMode === 'upload' && (
                    <>
                      <div
                        onClick={() => fileRef.current?.click()}
                        style={{
                          border: '2px dashed var(--border)',
                          borderRadius: 8, padding: '28px 16px', textAlign: 'center',
                          cursor: 'pointer', transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{ fontSize: 24, color: 'var(--text4)', marginBottom: 4 }}>+</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Click to select files</div>
                        <div style={{ fontSize: 10, color: 'var(--text5)', marginTop: 2 }}>TXT, HTML, ZIP</div>
                      </div>
                      <input ref={fileRef} type="file" multiple accept=".txt,.html,.htm,.zip"
                        onChange={handleFiles} style={{ display: 'none' }} />
                      {files.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          {files.map((f, i) => (
                            <div key={i} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '6px 12px', borderRadius: 6, background: 'var(--bg)',
                              border: '1px solid var(--border)', marginBottom: 4,
                              fontSize: 12, color: 'var(--text2)',
                            }}>
                              <span>{f.name}</span>
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: 'var(--text4)' }}>{(f.size / 1024).toFixed(0)} KB</span>
                                <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                                  style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11 }}>
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Provision type selection */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{
                      fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px',
                      color: 'var(--text4)', marginBottom: 8, fontWeight: 600,
                    }}>
                      Provision Types to Extract
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

                  {/* GO BUTTON */}
                  {step === 2 && (
                    <div style={{ marginTop: 20 }}>
                      <button
                        onClick={extractProvisions}
                        disabled={processing || (inputMode === 'paste' ? pastedText.length < 500 : files.length === 0)}
                        className="action-btn compare"
                        style={{
                          padding: '12px 24px', fontSize: 14, fontWeight: 700,
                          width: '100%', justifyContent: 'center',
                          opacity: (processing || (inputMode === 'paste' ? pastedText.length < 500 : files.length === 0)) ? 0.4 : 1,
                        }}
                      >
                        Extract Provisions
                      </button>
                      {inputMode === 'paste' && pastedText.length > 0 && pastedText.length < 500 && (
                        <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 4, textAlign: 'center' }}>
                          Need at least 500 characters ({500 - pastedText.length} more)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ STEP 3: Extracting (loading) ═══ */}
            {step === 3 && processing && (
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '40px 20px', textAlign: 'center',
              }}>
                <svg className="spinner" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" style={{ marginBottom: 12 }}>
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                <div style={{ font: '600 14px var(--serif)', color: 'var(--text)', marginBottom: 4 }}>
                  Extracting Provisions
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  AI is reading the agreement and identifying provisions. This may take a minute...
                </div>
              </div>
            )}

            {/* ═══ STEP 4: Preview & Edit ═══ */}
            {step === 4 && (
              <>
                {/* Summary bar */}
                <div style={{
                  background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                  padding: '14px 16px', marginBottom: 16,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                }}>
                  <div>
                    <div style={{ font: '600 14px var(--serif)', color: 'var(--text)', marginBottom: 2 }}>
                      Preview: {previewProvisions.length} provisions extracted
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      Review, edit, or remove provisions before saving. Click favorability badges to change ratings.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setStep(2)} className="action-btn">
                      Back
                    </button>
                    <button
                      onClick={saveToDatabase}
                      disabled={processing || previewProvisions.length === 0}
                      className="save-btn"
                      style={{
                        padding: '10px 24px', fontSize: 13,
                        opacity: (processing || previewProvisions.length === 0) ? 0.4 : 1,
                      }}
                    >
                      Confirm &amp; Save to Database
                    </button>
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
                        <PreviewProvisionCard
                          key={prov._id}
                          prov={prov}
                          onUpdate={updateProvision}
                          onRemove={removeProvision}
                        />
                      ))}
                    </div>
                  );
                })}

                {/* Bottom save button */}
                {previewProvisions.length > 0 && (
                  <div style={{ marginTop: 8, marginBottom: 40 }}>
                    <button
                      onClick={saveToDatabase}
                      disabled={processing}
                      className="save-btn"
                      style={{
                        padding: '12px 24px', fontSize: 13, width: '100%',
                        opacity: processing ? 0.4 : 1,
                      }}
                    >
                      Confirm &amp; Save {previewProvisions.length} Provisions to Database
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ═══ STEP 5: Done ═══ */}
            {step === 5 && (
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '40px 20px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, color: 'var(--green)', marginBottom: 8 }}>{'\u2713'}</div>
                <div style={{ font: '700 18px var(--serif)', color: 'var(--text)', marginBottom: 6 }}>
                  Agreement Saved
                </div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
                  {previewProvisions.length} provisions from {dealInfo?.acquirer} / {dealInfo?.target} have been saved to the database.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <a href="/" style={{ textDecoration: 'none' }}>
                    <button className="action-btn compare">View in Comparison Tool</button>
                  </a>
                  <button onClick={() => {
                    setStep(1); setDealInfo(null); setDescription(''); setPastedText('');
                    setFiles([]); setPreviewProvisions([]); setPreviewResults(null);
                    setSaveComplete(false); setDuplicateWarning(null); setError(null);
                  }} className="action-btn">
                    Add Another Agreement
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
function PreviewProvisionCard({ prov, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(prov.text);
  const [showFavPicker, setShowFavPicker] = useState(false);

  const favLevel = FAV_LEVELS.find(f => f.key === prov.favorability);

  return (
    <div className="prong-card" style={{ marginBottom: 10 }}>
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
          {/* Favorability badge */}
          <div style={{ position: 'relative' }}>
            <span
              className={`fav-badge ${prov.favorability || 'unrated'}`}
              onClick={() => setShowFavPicker(!showFavPicker)}
            >
              {favLevel ? favLevel.label : 'Rate'}
            </span>
            {showFavPicker && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                padding: 4, minWidth: 160, zIndex: 10,
              }}>
                {FAV_LEVELS.map(f => (
                  <div key={f.key} className="fav-option" onClick={() => {
                    onUpdate(prov._id, 'favorability', f.key);
                    setShowFavPicker(false);
                  }}>
                    <div className="fav-dot" style={{ background: f.color }} />
                    {f.label}
                  </div>
                ))}
                <div className="fav-option" onClick={() => {
                  onUpdate(prov._id, 'favorability', 'unrated');
                  setShowFavPicker(false);
                }} style={{ color: 'var(--text4)' }}>Clear</div>
              </div>
            )}
          </div>

          {/* Edit button */}
          <button onClick={() => {
            if (editing) {
              onUpdate(prov._id, 'text', editText);
              setEditing(false);
            } else {
              setEditText(prov.text);
              setEditing(true);
            }
          }} className="admin-edit" style={{ opacity: 1, color: editing ? 'var(--green)' : 'var(--gold)' }}>
            {editing ? 'Save' : 'Edit'}
          </button>

          {/* Remove button */}
          <button onClick={() => onRemove(prov._id)} className="admin-edit" style={{ opacity: 1, color: 'var(--red)' }}>
            Remove
          </button>
        </div>
      </div>
      <div style={{ padding: '12px 16px' }}>
        {editing ? (
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            style={{
              width: '100%', minHeight: 100, padding: '10px 12px', borderRadius: 6,
              border: '1px solid var(--gold)', background: 'var(--bg)',
              font: '400 12px/1.65 var(--serif)', color: 'var(--text2)',
              resize: 'vertical', outline: 'none',
            }}
          />
        ) : (
          <div className="prong-text">
            {prov.text}
          </div>
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
