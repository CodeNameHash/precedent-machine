import { useEffect, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';

PrecedentApp.noLayout = true;

export default function PrecedentApp() {
  return (
    <>
      <Head>
        <title>Precedent Machine</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&family=Source+Sans+3:wght@300;400;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/spa.css" />
      </Head>

      <div
        dangerouslySetInnerHTML={{
          __html: `
<div id="app">
<div class="header">
  <div class="logo"><div class="logo-dot"></div><h1>Precedent Machine</h1></div>
  <div class="nav">
    <button class="nav-btn" onclick="toggleAdmin()" id="admin-btn">Admin</button>
    <button class="nav-btn" onclick="toggleAsk()" id="ask-btn">Ask</button>
  </div>
</div>

<div class="search-section">
  <div class="search-row">
    <div class="search-wrap">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input id="q" placeholder="Search provisions or deals..." oninput="onInput()" onkeydown="if(event.key==='Enter')doSearch()">
      <button onclick="clearQ()" style="background:none;border:none;color:var(--text4);cursor:pointer;display:none" id="q-clear">&#10005;</button>
    </div>
    <button class="search-btn" onclick="doSearch()" id="search-go">Search</button>
  </div>
  <div class="filters-row" id="filters-row"><span class="filter-label">Filters:</span><span id="suggested-filters"></span></div>
</div>

<div class="main">
  <div class="sidebar" id="sidebar"></div>
  <div class="content" id="content"><div class="empty"><h3>Select deals to compare</h3><p>Check two or more deals, then optionally filter by provision type</p></div></div>
  <div class="ask-panel" id="ask-panel">
    <div class="ask-header"><span style="font:600 13px var(--serif)">Interrogate Precedents</span><button onclick="toggleAsk()" class="close-btn">&#10005;</button></div>
    <div class="ask-messages" id="ask-msgs"><div class="ask-msg assistant"><div class="bubble">Ask me anything about the precedents.</div></div></div>
    <div class="ask-input-row">
      <textarea id="ask-q" rows="1" placeholder="e.g. Which deals have the broadest MAE carve-outs?" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendAsk()}"></textarea>
      <button class="ask-send" onclick="sendAsk()" id="ask-go">Send</button>
    </div>
  </div>
</div>
</div>

<div class="modal-bg recode-modal" id="recode-modal" style="display:none" onclick="if(event.target===this)this.style.display='none'">
  <div class="modal"><div class="modal-header"><span style="font:600 14px var(--serif)">Recode Sub-Provision</span><button class="close-btn" onclick="document.getElementById('recode-modal').style.display='none'">&#10005;</button></div>
  <div class="modal-body" id="recode-body"></div></div>
</div>

<div class="modal-bg" id="add-cat-modal" style="display:none" onclick="if(event.target===this)this.style.display='none'">
  <div class="modal" style="max-width:450px"><div class="modal-header"><span style="font:600 14px var(--serif)">Add Sub-Provision Category</span><button class="close-btn" onclick="document.getElementById('add-cat-modal').style.display='none'">&#10005;</button></div>
  <div class="modal-body" id="add-cat-body"></div></div>
</div>

<div id="fav-dropdown" class="fav-dropdown" style="display:none"></div>
          `,
        }}
      />

      <Script src="/spa.js" strategy="afterInteractive" />
    </>
  );
}
