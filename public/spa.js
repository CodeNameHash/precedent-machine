// ═══════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════
var DEALS = [
  { id:"d1", acquirer:"Broadcom Inc.", target:"VMware, Inc.", value:"$61B", sector:"Technology", date:"2022-05-26", jurisdiction:"Delaware",
    lawyers:{buyer:["Wachtell Lipton"],seller:["Gibson Dunn"]}, advisors:{buyer:["Silver Lake"],seller:["Goldman Sachs","J.P. Morgan"]},
    structure:"Reverse triangular merger", termFee:"$1.5B / $1.5B" },
  { id:"d2", acquirer:"Microsoft", target:"Activision Blizzard", value:"$68.7B", sector:"Technology/Gaming", date:"2022-01-18", jurisdiction:"Delaware",
    lawyers:{buyer:["Simpson Thacher"],seller:["Skadden Arps"]}, advisors:{buyer:["Goldman Sachs"],seller:["Allen & Company"]},
    structure:"Reverse triangular merger", termFee:"$2.5B / $3.0B" },
  { id:"d3", acquirer:"Pfizer", target:"Seagen", value:"$43B", sector:"Biopharma", date:"2023-03-13", jurisdiction:"Delaware",
    lawyers:{buyer:["Wachtell Lipton"],seller:["Cravath Swaine"]}, advisors:{buyer:["Guggenheim"],seller:["Centerview","Goldman Sachs"]},
    structure:"Reverse triangular merger", termFee:"$1.25B / $2.2B" },
  { id:"d4", acquirer:"Amgen", target:"Horizon Therapeutics", value:"$28.3B", sector:"Biopharma", date:"2022-12-12", jurisdiction:"Delaware",
    lawyers:{buyer:["Sullivan & Cromwell"],seller:["Cooley"]}, advisors:{buyer:["Morgan Stanley"],seller:["Goldman Sachs","Centerview"]},
    structure:"Reverse triangular merger", termFee:"$750M / $1.8B" },
  { id:"d5", acquirer:"Adobe", target:"Figma", value:"$20B", sector:"Technology", date:"2022-09-15", jurisdiction:"Delaware",
    lawyers:{buyer:["Cravath Swaine"],seller:["Fenwick & West"]}, advisors:{buyer:[],seller:["Qatalyst Partners"]},
    structure:"Merger (terminated)", termFee:"$1B reverse" },
  { id:"d6", acquirer:"X Holdings (Musk)", target:"Twitter", value:"$44B", sector:"Technology", date:"2022-04-25", jurisdiction:"Delaware",
    lawyers:{buyer:["Skadden Arps"],seller:["Wilson Sonsini"]}, advisors:{buyer:["Morgan Stanley"],seller:["Goldman Sachs","J.P. Morgan"]},
    structure:"Single-step merger", termFee:"$1B each" },
  { id:"d7", acquirer:"Merck", target:"Prometheus Biosciences", value:"$10.8B", sector:"Biopharma", date:"2023-04-16", jurisdiction:"Delaware",
    lawyers:{buyer:["Davis Polk"],seller:["Cooley"]}, advisors:{buyer:[],seller:["Goldman Sachs"]},
    structure:"Reverse triangular merger", termFee:"$350M (Co)" },
  { id:"d8", acquirer:"Cisco", target:"Splunk", value:"$28B", sector:"Technology", date:"2023-09-21", jurisdiction:"Delaware",
    lawyers:{buyer:["Simpson Thacher"],seller:["Latham & Watkins"]}, advisors:{buyer:["Barclays"],seller:["Morgan Stanley","Goldman Sachs"]},
    structure:"Reverse triangular merger", termFee:"$1.48B / $2.0B" },
  { id:"d9", acquirer:"Exxon Mobil", target:"Pioneer Natural Resources", value:"$59.5B", sector:"Energy", date:"2023-10-11", jurisdiction:"Delaware",
    lawyers:{buyer:["Davis Polk"],seller:["Gibson Dunn"]}, advisors:{buyer:[],seller:["Evercore"]},
    structure:"All-stock merger", termFee:"N/A" },
  { id:"d10", acquirer:"Capital One", target:"Discover Financial", value:"$35.3B", sector:"Financial Services", date:"2024-02-19", jurisdiction:"Delaware",
    lawyers:{buyer:["Wachtell Lipton"],seller:["Sullivan & Cromwell"]}, advisors:{buyer:["Centerview"],seller:["Morgan Stanley"]},
    structure:"Bank merger", termFee:"$1.38B each" },
];

var PROVISION_TYPES = [
  {key:"MAE", label:"Material Adverse Effect"},
  {key:"IOC", label:"Interim Operating Covenants"},
];

var SUB_PROVISIONS = {
  MAE:["Base Definition","General Economic / Market Conditions","Changes in Law / GAAP","Industry Conditions","War / Terrorism","Acts of God / Pandemic","Failure to Meet Projections","Announcement / Pendency Effects","Actions at Parent Request","Disproportionate Impact Qualifier","Changes in Stock Price","Customer / Supplier Relationships"],
  IOC:["M&A / Acquisitions","Dividends / Distributions","Equity Issuances","Indebtedness","Capital Expenditures","Employee Compensation","Material Contracts","Accounting / Tax Changes","Ordinary Course Standard"]
};
var savedCats=JSON.parse(localStorage.getItem("customSubProvisions")||"null");
if(savedCats)SUB_PROVISIONS=savedCats;
function saveCats(){localStorage.setItem("customSubProvisions",JSON.stringify(SUB_PROVISIONS))}

var FAV_LEVELS=[
  {key:"strong-buyer",label:"Strong Buyer",color:"#1565C0"},
  {key:"mod-buyer",label:"Mod. Buyer",color:"#4285f4"},
  {key:"neutral",label:"Neutral",color:"#757575"},
  {key:"mod-seller",label:"Mod. Seller",color:"#E65100"},
  {key:"strong-seller",label:"Strong Seller",color:"#C62828"},
];

var PROVISIONS = [
  // Broadcom/VMware MAE
  {id:"p1",dealId:"d1",type:"MAE",category:"Base Definition",text:'"Company Material Adverse Effect" means any change, effect, event, occurrence, state of facts or development that, individually or in the aggregate, has had or would reasonably be expected to have a material adverse effect on the business, financial condition, assets, liabilities or results of operations of the Company and its Subsidiaries, taken as a whole; provided, however, that none of the following shall be deemed to constitute, and none of the following shall be taken into account in determining whether there has been, a Company Material Adverse Effect:',favorability:"neutral"},
  {id:"p2",dealId:"d1",type:"MAE",category:"General Economic / Market Conditions",text:'changes in general economic or political conditions or the financial, credit, debt, securities or other capital markets, in each case, in the United States or elsewhere in the world, including changes in interest rates, exchange rates and price of any security or market index',favorability:"mod-seller"},
  {id:"p3",dealId:"d1",type:"MAE",category:"Changes in Law / GAAP",text:'any changes in applicable Law or GAAP (or authoritative interpretations thereof) or changes in regulatory accounting requirements applicable to the industries in which the Company operates, in each case, after the date of this Agreement',favorability:"neutral"},
  {id:"p4",dealId:"d1",type:"MAE",category:"Industry Conditions",text:'changes in conditions generally affecting the industries in which the Company or any of its Subsidiaries operates',favorability:"mod-seller"},
  {id:"p5",dealId:"d1",type:"MAE",category:"War / Terrorism",text:'acts of war (whether or not declared), armed hostilities, sabotage, terrorism, or any escalation or worsening thereof',favorability:"neutral"},
  {id:"p6",dealId:"d1",type:"MAE",category:"Acts of God / Pandemic",text:'earthquakes, floods, hurricanes, tsunamis, tornadoes, wildfires or other natural disasters, weather conditions, pandemic, epidemic or disease outbreak (including COVID-19 or any COVID-19 Measures) or other force majeure events',favorability:"mod-seller"},
  {id:"p7",dealId:"d1",type:"MAE",category:"Failure to Meet Projections",text:'any failure by the Company to meet any projections, forecasts or estimates of revenue, earnings or other financial performance or results of operations (it being understood that the facts or occurrences giving rise to or contributing to such failure that are not otherwise excluded from the definition of Company Material Adverse Effect may be taken into account in determining whether there has been a Company Material Adverse Effect)',favorability:"neutral"},
  {id:"p8",dealId:"d1",type:"MAE",category:"Announcement / Pendency Effects",text:'the announcement or pendency of the Merger or the other transactions contemplated hereby, including the impact thereof on relationships with customers, suppliers, distributors, partners, employees, Governmental Authorities or others having business dealings with the Company',favorability:"mod-seller"},
  {id:"p9",dealId:"d1",type:"MAE",category:"Actions at Parent Request",text:'any action taken or omitted to be taken at the express written request or with the prior written consent of Parent or as expressly required by this Agreement',favorability:"mod-seller"},
  {id:"p10",dealId:"d1",type:"MAE",category:"Disproportionate Impact Qualifier",text:'except, in the case of clauses (a) through (f) above, to the extent that the Company and its Subsidiaries, taken as a whole, are disproportionately affected thereby relative to other participants in the industries in which the Company and its Subsidiaries operate (in which case, only the incremental disproportionate impact may be taken into account)',favorability:"neutral"},

  // Pfizer/Seagen MAE
  {id:"p11",dealId:"d3",type:"MAE",category:"Base Definition",text:'"Company Material Adverse Effect" means any change, effect, event, occurrence, state of facts or development that, individually or in the aggregate, has had or would reasonably be expected to have a material adverse effect on the business, results of operations or financial condition of the Company and its Subsidiaries, taken as a whole; provided, however, that none of the following (or the results thereof) shall be deemed to constitute, and none of the following (or the results thereof) shall be taken into account in determining whether there has been, a Company Material Adverse Effect:',favorability:"neutral"},
  {id:"p12",dealId:"d3",type:"MAE",category:"General Economic / Market Conditions",text:'changes in general economic conditions or the financial or securities markets generally (including changes in interest rates or exchange rates)',favorability:"neutral"},
  {id:"p13",dealId:"d3",type:"MAE",category:"Changes in Law / GAAP",text:'changes in applicable Law or GAAP (or authoritative interpretation thereof) after the date hereof',favorability:"mod-buyer"},
  {id:"p14",dealId:"d3",type:"MAE",category:"Industry Conditions",text:'changes in conditions generally affecting the pharmaceutical or biotechnology industries',favorability:"neutral"},
  {id:"p15",dealId:"d3",type:"MAE",category:"War / Terrorism",text:'acts of war (whether or not declared), armed hostilities, sabotage, terrorism, or any escalation or worsening thereof',favorability:"neutral"},
  {id:"p16",dealId:"d3",type:"MAE",category:"Acts of God / Pandemic",text:'earthquakes, floods, hurricanes, tsunamis, tornadoes, or other natural disasters, pandemic, epidemic or disease outbreak (including COVID-19 or any COVID-19 Measures), or other force majeure events',favorability:"mod-seller"},
  {id:"p17",dealId:"d3",type:"MAE",category:"Failure to Meet Projections",text:'the failure of the Company to meet any internal or published projections, forecasts or estimates of revenue, earnings or other financial performance or results of operations for any period (it being understood that the underlying causes of such failure may be considered in determining whether a Company Material Adverse Effect has occurred to the extent not otherwise excluded hereby)',favorability:"neutral"},
  {id:"p18",dealId:"d3",type:"MAE",category:"Announcement / Pendency Effects",text:'any effects arising from the announcement, pendency, or anticipated consummation of the Merger, including the impact thereof on relationships, contractual or otherwise, with customers, suppliers, distributors, partners, employees, or Governmental Authorities, or the identity of Parent or its Affiliates',favorability:"mod-seller"},
  {id:"p19",dealId:"d3",type:"MAE",category:"Actions at Parent Request",text:'any action taken or omitted to be taken by the Company at the written request or with the prior written consent of Parent or as expressly required by this Agreement or the transactions contemplated hereby',favorability:"mod-seller"},
  {id:"p20",dealId:"d3",type:"MAE",category:"Disproportionate Impact Qualifier",text:'except, in the case of clauses (a) through (f) above, to the extent such changes have a disproportionate adverse effect on the Company and its Subsidiaries, taken as a whole, relative to other similarly situated companies in the pharmaceutical and biotechnology industries (in which case only the incremental disproportionate impact may be taken into account)',favorability:"neutral"},

  // Microsoft/Activision MAE
  {id:"p21",dealId:"d2",type:"MAE",category:"Base Definition",text:'"Company Material Adverse Effect" means any change, effect, event, occurrence, state of facts or development that, individually or in the aggregate, has had or would reasonably be expected to have a material adverse effect on the business, financial condition, assets or results of operations of the Company and its Subsidiaries, taken as a whole; provided, however, that in no event shall any of the following, alone or in combination, be deemed to constitute, or be taken into account in determining whether there has been or would reasonably be expected to be, a Company Material Adverse Effect:',favorability:"neutral"},
  {id:"p22",dealId:"d2",type:"MAE",category:"General Economic / Market Conditions",text:'changes in general economic, regulatory or political conditions or the financial, credit or securities markets generally, including changes in interest rates or exchange rates',favorability:"neutral"},
  {id:"p23",dealId:"d2",type:"MAE",category:"Changes in Law / GAAP",text:'changes in Law or GAAP (or interpretation thereof) after the date hereof',favorability:"mod-buyer"},
  {id:"p24",dealId:"d2",type:"MAE",category:"Industry Conditions",text:'changes in conditions generally affecting the interactive entertainment industry',favorability:"neutral"},
  {id:"p25",dealId:"d2",type:"MAE",category:"War / Terrorism",text:'acts of war (whether or not declared), sabotage, terrorism, or any escalation or worsening thereof, or the outbreak or escalation of hostilities',favorability:"neutral"},
  {id:"p26",dealId:"d2",type:"MAE",category:"Acts of God / Pandemic",text:'any earthquake, hurricane, tsunami, tornado, flood, mudslide, wildfire, or other natural disaster, epidemic, pandemic or disease outbreak (including COVID-19 or any COVID-19 Measures), or any other force majeure event',favorability:"mod-seller"},
  {id:"p27",dealId:"d2",type:"MAE",category:"Failure to Meet Projections",text:'any failure by the Company to meet any internal or published projections, estimates or forecasts of revenue, earnings or other financial performance or results of operations for any period (provided that the underlying facts and circumstances giving rise to such failure may be taken into account in determining whether a Company Material Adverse Effect has occurred or would reasonably be expected to occur to the extent not otherwise excluded)',favorability:"neutral"},
  {id:"p28",dealId:"d2",type:"MAE",category:"Announcement / Pendency Effects",text:'the announcement, pendency or consummation of the transactions contemplated by this Agreement, including the impact thereof on relationships, contractual or otherwise, with customers, suppliers, partners, licensors, licensees, distributors, employees or Governmental Authorities, or the identity of Parent or its Affiliates',favorability:"strong-seller"},
  {id:"p29",dealId:"d2",type:"MAE",category:"Actions at Parent Request",text:'any action taken or omitted to be taken by the Company at the express written request or with the prior written consent of Parent or as expressly required by this Agreement or the transactions contemplated hereby',favorability:"mod-seller"},
  {id:"p30",dealId:"d2",type:"MAE",category:"Disproportionate Impact Qualifier",text:'except, in the case of clauses (a) through (f) above, to the extent that such change disproportionately adversely affects the Company and its Subsidiaries, taken as a whole, relative to other participants in the industries in which the Company and its Subsidiaries operate (in which case only the incremental disproportionate impact may be taken into account)',favorability:"neutral"},
  {id:"p31",dealId:"d2",type:"MAE",category:"Changes in Stock Price",text:'any decline in the market price or trading volume of Company Common Stock (provided that the underlying facts and circumstances giving rise to or contributing to such decline may be taken into account in determining whether a Company Material Adverse Effect has occurred to the extent not otherwise excluded)',favorability:"mod-seller"},

  // Broadcom/VMware IOC
  {id:"p40",dealId:"d1",type:"IOC",category:"M&A / Acquisitions",text:'shall not acquire or agree to acquire, by merging or consolidating with, by purchasing an equity interest in or a material portion of the assets of, or by any other manner, any business or any corporation, partnership, association or other business organization or division thereof, or otherwise acquire or agree to acquire any assets, in each case with a value in excess of $100,000,000 individually or $250,000,000 in the aggregate',favorability:"mod-buyer"},
  {id:"p41",dealId:"d1",type:"IOC",category:"Dividends / Distributions",text:'shall not declare, set aside, make or pay any dividends or other distributions, whether payable in cash, stock, property or otherwise, with respect to any of its capital stock, other than (i) regular quarterly cash dividends not exceeding $0.46 per share consistent with the existing dividend policy and (ii) dividends by a direct or indirect wholly owned Subsidiary to its parent',favorability:"neutral"},
  {id:"p42",dealId:"d1",type:"IOC",category:"Equity Issuances",text:'shall not issue, sell, pledge, dispose of, grant, transfer, encumber, or authorize the issuance, sale, pledge, disposition, grant, transfer or encumbrance of, any shares of capital stock or securities convertible or exchangeable into or exercisable for any shares of such capital stock, except (i) issuance upon exercise of outstanding Company Options or settlement of Company RSUs, and (ii) issuances under the Company ESPP in the ordinary course',favorability:"mod-buyer"},
  {id:"p43",dealId:"d1",type:"IOC",category:"Indebtedness",text:'shall not incur any indebtedness for borrowed money or issue any debt securities or assume, guarantee or endorse the obligations of any Person for borrowed money, in each case in excess of $500,000,000 in the aggregate, except (i) under existing credit facilities in the ordinary course, (ii) intercompany indebtedness, or (iii) letters of credit in the ordinary course',favorability:"neutral"},
  {id:"p44",dealId:"d1",type:"IOC",category:"Capital Expenditures",text:'shall not make or commit to make capital expenditures in excess of 110% of the amount set forth in the Company capital expenditure budget provided to Parent prior to the date hereof for the applicable period',favorability:"mod-buyer"},
  {id:"p45",dealId:"d1",type:"IOC",category:"Employee Compensation",text:'shall not (i) increase compensation or benefits of any current or former director, officer or employee except (A) in the ordinary course consistent with past practice for non-officer employees, (B) as required by applicable Law, or (C) as required by any existing Company Benefit Plan; (ii) grant any equity awards except in the ordinary course consistent with past practice; or (iii) adopt, enter into, materially amend or terminate any Company Benefit Plan',favorability:"mod-buyer"},

  // Pfizer/Seagen IOC
  {id:"p50",dealId:"d3",type:"IOC",category:"M&A / Acquisitions",text:'shall not acquire or agree to acquire, by merging or consolidating with, by purchasing an equity interest in or a portion of the assets of, or by any other manner, any business or any Person or division thereof, except for acquisitions of assets (other than equity interests) in the ordinary course of business not exceeding $50,000,000 individually or $150,000,000 in the aggregate',favorability:"mod-buyer"},
  {id:"p51",dealId:"d3",type:"IOC",category:"Dividends / Distributions",text:'shall not declare, set aside, make or pay any dividends or distributions except (i) regular quarterly cash dividends consistent with past practice not exceeding the per-share amount of the most recent quarterly dividend prior to the date hereof, and (ii) dividends by wholly owned Subsidiaries to their parent',favorability:"neutral"},
  {id:"p52",dealId:"d3",type:"IOC",category:"Equity Issuances",text:'shall not issue, sell, grant, pledge or otherwise encumber any shares of capital stock or securities convertible or exchangeable therefor, except (i) upon the exercise or settlement of Company equity awards outstanding on the date hereof, (ii) under the ESPP consistent with past practice, or (iii) in connection with tax withholding obligations arising from settlement of equity awards',favorability:"neutral"},
  {id:"p53",dealId:"d3",type:"IOC",category:"Indebtedness",text:'shall not incur, assume, guarantee or otherwise become liable for any indebtedness for borrowed money, other than (i) borrowings under existing credit facilities in the ordinary course not to exceed $100,000,000, (ii) intercompany indebtedness, and (iii) letters of credit in the ordinary course',favorability:"mod-buyer"},
  {id:"p54",dealId:"d3",type:"IOC",category:"Capital Expenditures",text:'shall not make or commit to make capital expenditures other than (i) in the ordinary course consistent with existing plans and budget, and (ii) any individual expenditure not in excess of $25,000,000 or aggregate expenditures not in excess of $75,000,000 in excess of such budget',favorability:"mod-buyer"},
  {id:"p55",dealId:"d3",type:"IOC",category:"Employee Compensation",text:'shall not (i) increase compensation except (A) annual merit increases in the ordinary course not exceeding 5% for non-officer employees, (B) as required by applicable Law or existing plans, or (C) new hires below VP level at compensation consistent with past practice; (ii) grant any equity awards; or (iii) adopt or materially amend any Company Benefit Plan',favorability:"mod-buyer"},

  // Microsoft/Activision IOC
  {id:"p60",dealId:"d2",type:"IOC",category:"M&A / Acquisitions",text:'shall not acquire or agree to acquire, by merging or consolidating with, by purchasing an equity interest in or a material portion of the assets of, or by any other manner, any business or any Person or division thereof, except for (i) purchases of assets in the ordinary course not exceeding $50,000,000 individually and (ii) transactions solely between the Company and wholly owned Subsidiaries or solely between wholly owned Subsidiaries',favorability:"mod-buyer"},
  {id:"p61",dealId:"d2",type:"IOC",category:"Dividends / Distributions",text:'shall not declare, set aside, make or pay any dividend or other distribution with respect to any capital stock, other than (i) regular quarterly cash dividends not exceeding $0.47 per share consistent with the existing dividend policy and (ii) dividends by a direct or indirect wholly owned Subsidiary to its parent',favorability:"neutral"},
  {id:"p62",dealId:"d2",type:"IOC",category:"Equity Issuances",text:'shall not issue, sell, grant, pledge, dispose of or encumber any shares of capital stock or securities convertible or exercisable therefor, except (i) pursuant to outstanding Company equity awards, (ii) under the ESPP consistent with past practice, or (iii) in connection with tax withholding obligations',favorability:"neutral"},
  {id:"p63",dealId:"d2",type:"IOC",category:"Indebtedness",text:'shall not incur any indebtedness for borrowed money or issue any debt securities, except (i) borrowings under existing credit facilities in the ordinary course not exceeding $100,000,000, (ii) intercompany indebtedness in the ordinary course, and (iii) letters of credit, performance bonds or surety bonds in the ordinary course',favorability:"neutral"},
  {id:"p64",dealId:"d2",type:"IOC",category:"Capital Expenditures",text:'shall not make or commit to make capital expenditures in excess of the amounts set forth in the Company Disclosure Letter for the applicable period (plus a 10% variance)',favorability:"mod-buyer"},
  {id:"p65",dealId:"d2",type:"IOC",category:"Employee Compensation",text:'shall not (i) increase compensation or benefits except (A) in the ordinary course consistent with past practice for non-director/officer employees, (B) as required by applicable Law, or (C) as required by existing Company Benefit Plans; (ii) grant equity awards except annual grants in the ordinary course; or (iii) adopt, enter into, materially amend or terminate any material Company Benefit Plan',favorability:"mod-buyer"},
];

var goldStandards=JSON.parse(localStorage.getItem("goldStandards")||"[]");
function saveGold(){localStorage.setItem("goldStandards",JSON.stringify(goldStandards))}
var favOverrides=JSON.parse(localStorage.getItem("favOverrides")||"{}");
function saveFav(){localStorage.setItem("favOverrides",JSON.stringify(favOverrides))}
function getProvFav(pid){return favOverrides[pid]||PROVISIONS.find(function(p){return p.id===pid})?.favorability||"unrated"}

// ═══════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════
var state={provisionType:null,selectedDeals:["d1","d2","d3"],searchTerms:[],adminMode:false,compareResults:null,activeTab:"coded",askHistory:[]};

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
function esc(s){return s?s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"):""}
function getDeal(id){return DEALS.find(function(d){return d.id===id})}
function dealLabel(d){return d.acquirer+" / "+d.target}
function getProvs(type,did){return PROVISIONS.filter(function(p){return p.type===type&&p.dealId===did})}
function highlightText(t,terms){if(!terms||!terms.length)return esc(t);var rx=new RegExp("("+terms.map(function(t){return t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}).join("|")+")","gi");return esc(t).replace(rx,'<span class="hl">$1</span>')}
function getCatsForType(t){return SUB_PROVISIONS[t]||[]}
function getCoverage(type,did){var provs=getProvs(type,did);var cats=getCatsForType(type);var present=new Set(provs.map(function(p){return p.category}));var covered=cats.filter(function(c){return present.has(c)}).length;return{pct:cats.length?Math.round(covered/cats.length*100):0,coded:covered,total:cats.length}}

// ═══════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════
function onInput(){var q=document.getElementById("q").value;document.getElementById("q-clear").style.display=q?"block":"none";state.searchTerms=q.toLowerCase().split(/\s+/).filter(function(t){return t.length>2});renderSidebar()}
function clearQ(){document.getElementById("q").value="";document.getElementById("q-clear").style.display="none";state.searchTerms=[];renderSidebar()}
function doSearch(){
  var q=document.getElementById("q").value.trim();if(!q)return;
  var btn=document.getElementById("search-go");btn.disabled=true;btn.textContent="...";
  fetch("/api/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:q,deals:DEALS,provisions:PROVISIONS})}).then(function(resp){return resp.json()}).then(function(data){
    if(data.intent==="deal"){var ids=data.results.filter(function(r){return r.startsWith("DEAL:")}).map(function(r){return r.replace("DEAL:","")});if(ids.length)state.selectedDeals=ids.slice(0,5)}
    if(data.terms)state.searchTerms=data.terms;
    if(data.suggested_filters)document.getElementById("suggested-filters").innerHTML=data.suggested_filters.map(function(f){return '<button class="filter-chip" onclick="applyFilter(\''+esc(f)+'\')">'+esc(f)+'</button>'}).join("");
    renderSidebar();renderContent();
  }).catch(function(e){console.error(e)}).finally(function(){
    btn.disabled=false;btn.textContent="Search";
  });
}
function applyFilter(f){if(f.toUpperCase().includes("MAE"))selectProvisionType("MAE");else if(f.toUpperCase().includes("COVENANT")||f.toUpperCase().includes("IOC"))selectProvisionType("IOC");var sd=DEALS.find(function(d){return d.sector.toLowerCase().includes(f.toLowerCase())});if(sd){state.selectedDeals=DEALS.filter(function(d){return d.sector===sd.sector}).map(function(d){return d.id});renderSidebar();renderContent()}}

// ═══════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════
function renderSidebar(){
  var el=document.getElementById("sidebar");
  var h='<div class="sidebar-header">Provisions <span style="font-size:10px;color:var(--text5);text-transform:none;letter-spacing:0;cursor:pointer" onclick="selectProvisionType(null)">show all</span></div>';
  h+='<div class="prov-item '+(state.provisionType===null?"selected":"")+'" onclick="selectProvisionType(null)"><div class="prov-type" style="color:var(--text3)">ALL</div><div class="prov-title">All Provisions</div><div class="prov-deal">Compare all provision types side by side</div></div>';
  PROVISION_TYPES.forEach(function(pt){
    var a=state.provisionType===pt.key;
    h+='<div class="prov-item '+(a?"selected":"")+'" onclick="selectProvisionType(\''+pt.key+'\')"><div class="prov-type">'+pt.key+'</div><div class="prov-title">'+pt.label+'</div><div class="prov-deal">'+getCatsForType(pt.key).length+' sub-provisions &middot; '+new Set(PROVISIONS.filter(function(p){return p.type===pt.key}).map(function(p){return p.dealId})).size+' deals coded</div></div>';
  });
  h+='<div class="sidebar-header">Deals <span style="font-size:10px;color:var(--gold);text-transform:none;letter-spacing:0">'+state.selectedDeals.length+' selected</span></div>';
  DEALS.forEach(function(d){
    var ck=state.selectedDeals.includes(d.id);
    var hp=state.provisionType?PROVISIONS.some(function(p){return p.dealId===d.id&&p.type===state.provisionType}):PROVISIONS.some(function(p){return p.dealId===d.id});
    h+='<div class="deal-item" onclick="toggleDeal(\''+d.id+'\')" style="'+(hp?"":"opacity:0.4")+'"><div class="deal-check '+(ck?"checked":"")+'">&#10003;</div><div class="deal-info"><div class="deal-name">'+esc(dealLabel(d))+'</div><div class="deal-meta">'+d.value+' &middot; '+d.sector+' &middot; '+d.date.slice(0,4)+'</div>'+(d.lawyers?'<div class="deal-meta" style="margin-top:1px;font-size:9.5px">'+esc((d.lawyers.buyer||[]).concat(d.lawyers.seller||[]).slice(0,2).join(", "))+'</div>':"")+'</div></div>';
  });
  el.innerHTML=h;
}
function selectProvisionType(t){state.provisionType=t;state.compareResults=null;state.activeTab="coded";renderSidebar();renderContent()}
function toggleDeal(id){var i=state.selectedDeals.indexOf(id);if(i>=0)state.selectedDeals.splice(i,1);else state.selectedDeals.push(id);state.compareResults=null;renderSidebar();renderContent()}

// ═══════════════════════════════════════════════════
// CONTENT
// ═══════════════════════════════════════════════════
function renderContent(){
  var el=document.getElementById("content");
  if(!state.selectedDeals.length){el.innerHTML='<div class="empty"><h3>No deals selected</h3><p>Check deals in the sidebar</p></div>';return}
  var deals=state.selectedDeals.map(getDeal).filter(Boolean);
  var types=state.provisionType?[state.provisionType]:PROVISION_TYPES.map(function(pt){return pt.key}).filter(function(t){return deals.some(function(d){return getProvs(t,d.id).length>0})});
  var typeName=state.provisionType?PROVISION_TYPES.find(function(pt){return pt.key===state.provisionType}).label:"All Provisions";

  var h='<div class="content-header"><div class="provision-type-label">'+(state.provisionType||"COMPARISON")+'</div><div class="content-title">'+typeName+' &mdash; '+deals.length+' Deal Comparison</div><div class="content-subtitle">Each provision is broken into coded sub-provisions for side-by-side analysis.</div><div class="action-row">'+(!state.compareResults?'<button class="action-btn compare" onclick="runCompare()">&#9889; Summarize Differences</button>':'<button class="action-btn" onclick="clearCompare()" style="border-color:var(--gold);color:var(--gold)">&#10005; Clear Summary</button>')+'<button class="action-btn" onclick="setTab(\'report\')">Report</button><button class="action-btn" onclick="setTab(\'redline\')">Markup Draft</button></div><div class="view-tabs"><div class="view-tab '+(state.activeTab==="coded"?"active":"")+'" onclick="setTab(\'coded\')">Coded Comparison</div><div class="view-tab '+(state.activeTab==="fulltext"?"active":"")+'" onclick="setTab(\'fulltext\')">Full Text</div><div class="view-tab '+(state.activeTab==="report"?"active":"")+'" onclick="setTab(\'report\')">Report</div><div class="view-tab '+(state.activeTab==="redline"?"active":"")+'" onclick="setTab(\'redline\')">Redline</div></div></div>';

  if(state.adminMode){
    h+='<div class="admin-banner"><span>Admin mode &mdash; Recode sub-provisions or add new categories</span><div style="display:flex;gap:6px">'+types.map(function(t){return '<button onclick="openAddCategory(\''+t+'\')">+ '+t+' Category</button>'}).join("")+'<button onclick="toggleAdmin()">Turn Off</button></div></div>';
  }

  if(state.activeTab==="coded"){types.forEach(function(type){var cats=getCatsForType(type);if(types.length>1)h+='<div class="prongs-section" style="padding-bottom:0"><div class="provision-section-divider"><span>'+(PROVISION_TYPES.find(function(pt){return pt.key===type})?.label||type)+'</span><span class="coverage-info">'+cats.length+' sub-provisions</span></div></div>';h+=renderCodedView(deals,cats,type)})}
  else if(state.activeTab==="fulltext"){h+=renderFullTextView(deals,types)}
  else if(state.activeTab==="report"){h+=renderReportView(deals,types)}
  else if(state.activeTab==="redline"){h+=renderRedlineView(deals)}
  el.innerHTML=h;
}
function setTab(t){state.activeTab=t;renderContent()}
function clearCompare(){state.compareResults=null;renderContent()}

// ═══════════════════════════════════════════════════
// CODED VIEW
// ═══════════════════════════════════════════════════
function renderCodedView(deals,cats,type){
  var cols=deals.length;
  var h='<div class="prongs-section">';
  h+='<div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">';
  deals.forEach(function(d){var c=getCoverage(type,d.id);var cls=c.pct>=90?"full":c.pct>=50?"partial":"low";h+='<div style="flex:1;min-width:130px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--gold);margin-bottom:2px">'+esc(d.acquirer)+'/'+esc(d.target)+'</div><div style="font-size:11px;color:var(--text2)">Coverage: '+c.coded+'/'+c.total+' ('+c.pct+'%)</div><div class="coverage-bar"><div class="coverage-fill '+cls+'" style="width:'+c.pct+'%"></div></div></div>'});
  h+='</div>';

  cats.forEach(function(cat){
    var entries=deals.map(function(d){var prov=PROVISIONS.find(function(p){return p.type===type&&p.dealId===d.id&&p.category===cat});return{deal:d,prov:prov}});
    var present=entries.filter(function(e){return e.prov}).length;
    var tagClass="all",tagText="All "+present;
    if(present===0){tagClass="missing";tagText="None"}else if(present<deals.length){tagClass="varies";tagText=present+"/"+deals.length}
    var cmp=state.compareResults?.comparisons?.find(function(c){return c.category===cat});

    h+='<div class="prong-card"><div class="prong-header"><div><span class="prong-name">'+esc(cat)+'</span></div><div style="display:flex;gap:8px;align-items:center"><span class="prong-tag '+tagClass+'">'+tagText+'</span>'+(state.adminMode?'<button class="admin-edit" onclick="openRecode(\''+esc(cat).replace(/'/g,"\\'")+'\',\''+type+'\')">Recode</button>':"")+'</div></div><div class="prong-body" style="grid-template-columns:repeat('+cols+',1fr)">';
    entries.forEach(function(e){
      var fav=e.prov?getProvFav(e.prov.id):null;
      h+='<div class="prong-cell"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div class="prong-deal-label">'+esc(e.deal.acquirer)+'/'+esc(e.deal.target)+'</div>'+(e.prov?renderFavBadge(e.prov.id,fav):"")+'</div><div class="prong-text">'+(e.prov?highlightText(e.prov.text,state.searchTerms):'<span class="absent">Not present</span>')+'</div></div>';
    });
    h+='</div>';
    if(cmp)h+='<div class="prong-analysis"><strong>'+esc(cmp.summary)+'</strong><br>'+(cmp.most_buyer_friendly?'Buyer-friendly: <strong>'+esc(cmp.most_buyer_friendly)+'</strong>. ':"")+(cmp.most_seller_friendly?'Seller-friendly: <strong>'+esc(cmp.most_seller_friendly)+'</strong>. ':"")+(cmp.market_position?'<span style="color:var(--gold);font-weight:600">Market: '+esc(cmp.market_position)+'</span>':"")+'</div>';
    h+='</div>';
  });

  if(state.compareResults)h+='<div style="padding:16px;background:var(--gold-light);border:1px solid var(--gold-border);border-radius:10px;margin-bottom:20px"><div style="font:600 14px var(--serif);margin-bottom:6px">AI Summary</div><div style="font-size:13px;color:var(--text2);line-height:1.6">'+esc(state.compareResults.overall_summary||"")+'</div>'+(state.compareResults.key_takeaway?'<div style="margin-top:8px;font-size:13px;color:var(--gold);font-weight:600">'+esc(state.compareResults.key_takeaway)+'</div>':"")+'</div>';
  h+='</div>';return h;
}

// ═══════════════════════════════════════════════════
// FAVORABILITY
// ═══════════════════════════════════════════════════
function renderFavBadge(pid,fav){var lv=FAV_LEVELS.find(function(f){return f.key===fav});if(!lv)return'<span class="fav-badge unrated" onclick="event.stopPropagation();openFavPicker(\''+pid+'\',this)">Rate</span>';return'<span class="fav-badge '+fav+'" onclick="event.stopPropagation();openFavPicker(\''+pid+'\',this)">'+lv.label+'</span>'}

function openFavPicker(pid,el){
  var dd=document.getElementById("fav-dropdown");var r=el.getBoundingClientRect();
  dd.style.top=(r.bottom+4)+"px";dd.style.left=Math.min(r.left,window.innerWidth-180)+"px";dd.style.display="block";
  dd.innerHTML=FAV_LEVELS.map(function(f){return'<div class="fav-option" onclick="setFav(\''+pid+'\',\''+f.key+'\')"><div class="fav-dot" style="background:'+f.color+'"></div>'+f.label+'</div>'}).join("")+'<div class="fav-option" onclick="setFav(\''+pid+'\',\'unrated\')" style="color:var(--text4)">Clear</div>';
  setTimeout(function(){var cl=function(e){if(!dd.contains(e.target)){dd.style.display="none";document.removeEventListener("click",cl)}};document.addEventListener("click",cl)},10);
}
function setFav(pid,lv){favOverrides[pid]=lv;saveFav();document.getElementById("fav-dropdown").style.display="none";renderContent()}

// ═══════════════════════════════════════════════════
// FULL TEXT VIEW
// ═══════════════════════════════════════════════════
function renderFullTextView(deals,types){
  var h='<div style="padding:20px 28px">';
  types.forEach(function(type){if(types.length>1)h+='<div class="provision-section-divider" style="margin-bottom:16px"><span>'+(PROVISION_TYPES.find(function(pt){return pt.key===type})?.label||type)+'</span></div>';
    deals.forEach(function(d){var provs=PROVISIONS.filter(function(p){return p.type===type&&p.dealId===d.id});if(!provs.length)return;var c=getCoverage(type,d.id);var cls=c.pct>=90?"full":c.pct>=50?"partial":"low";
      h+='<div style="margin-bottom:24px"><div class="full-text-label"><span>'+esc(dealLabel(d))+' &mdash; '+type+'</span><span style="font-size:10px;color:var(--text3);text-transform:none;letter-spacing:0">Coverage: '+c.pct+'% ('+c.coded+'/'+c.total+')</span></div><div class="coverage-bar" style="margin-bottom:8px"><div class="coverage-fill '+cls+'" style="width:'+c.pct+'%"></div></div><div class="full-text">'+provs.map(function(p){return'<span class="coded" title="'+esc(p.category)+'">'+highlightText(p.text,state.searchTerms)+'</span>'}).join("; ")+'</div></div>'})});
  h+='</div>';return h;
}

// ═══════════════════════════════════════════════════
// REPORT VIEW
// ═══════════════════════════════════════════════════
function renderReportView(deals,types){
  var h='<div style="padding:20px 28px">';
  h+='<div style="font:700 20px var(--serif);margin-bottom:4px">Precedent Comparison Report</div><div style="font-size:11px;color:var(--text4);margin-bottom:20px">'+new Date().toISOString().split("T")[0]+' &mdash; '+deals.length+' deals</div>';

  h+='<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text4);margin-bottom:8px">Deal Overview</div><table class="report-table"><thead><tr><th style="width:130px">Deal</th>';
  deals.forEach(function(d){h+='<th>'+esc(d.acquirer)+'/'+esc(d.target)+'</th>'});
  h+='</tr></thead><tbody>';
  [["Value",function(d){return d.value}],["Date",function(d){return d.date}],["Structure",function(d){return d.structure||""}],["Buyer Counsel",function(d){return(d.lawyers?.buyer||[]).join(", ")}],["Seller Counsel",function(d){return(d.lawyers?.seller||[]).join(", ")}],["Buyer Advisors",function(d){return(d.advisors?.buyer||[]).join(", ")||"\u2014"}],["Seller Advisors",function(d){return(d.advisors?.seller||[]).join(", ")}],["Term. Fee",function(d){return d.termFee||""}]].forEach(function(row){
    var label=row[0],fn=row[1];
    h+='<tr><td class="sub-prov-label">'+label+'</td>';deals.forEach(function(d){h+='<td>'+esc(fn(d)||"\u2014")+'</td>'});h+='</tr>';
  });
  h+='</tbody></table>';

  types.forEach(function(type){
    var cats=getCatsForType(type);
    h+='<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--gold);margin:24px 0 8px;font-weight:700">'+(PROVISION_TYPES.find(function(pt){return pt.key===type})?.label||type)+'</div><table class="report-table"><thead><tr><th style="width:150px">Sub-Provision</th>';
    deals.forEach(function(d){h+='<th>'+esc(d.acquirer)+'/'+esc(d.target)+'</th>'});
    h+='</tr></thead><tbody>';
    cats.forEach(function(cat){
      h+='<tr><td class="sub-prov-label">'+esc(cat)+'</td>';
      deals.forEach(function(d){var prov=PROVISIONS.find(function(p){return p.type===type&&p.dealId===d.id&&p.category===cat});if(prov){var fav=getProvFav(prov.id);var fl=FAV_LEVELS.find(function(f){return f.key===fav});h+='<td>'+esc(prov.text)+(fl?' <span style="font-size:9px;color:'+fl.color+';font-weight:600;font-family:var(--sans)">['+fl.label+']</span>':"")+'</td>'}else h+='<td style="color:var(--text5);font-style:italic">Not present</td>'});
      h+='</tr>';
    });
    h+='</tbody></table>';
  });

  if(state.compareResults)h+='<div style="padding:16px;background:var(--gold-light);border:1px solid var(--gold-border);border-radius:10px;margin:20px 0"><div style="font:600 14px var(--serif);margin-bottom:6px">AI Analysis</div><div style="font-size:13px;color:var(--text2);line-height:1.6">'+esc(state.compareResults.overall_summary||"")+'</div></div>';
  else h+='<div style="padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;margin:20px 0;font-size:12px;color:var(--text3)">Click "Summarize Differences" to add AI analysis to this report.</div>';
  h+='</div>';return h;
}

// ═══════════════════════════════════════════════════
// REDLINE
// ═══════════════════════════════════════════════════
function renderRedlineView(deals){
  var et=state.provisionType||"MAE";
  return'<div style="padding:20px 28px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text4);margin-bottom:8px">Paste your draft provision</div><textarea class="redline-textarea" id="redline-draft" placeholder="Paste the draft '+et+' provision here..."></textarea><div style="margin-top:12px"><button class="action-btn primary" onclick="runRedline()">Run Redline Analysis</button></div><div id="redline-results" style="margin-top:20px"></div></div>';
}
function runRedline(){
  var draft=document.getElementById("redline-draft")?.value?.trim();if(!draft)return;
  var deal=getDeal(state.selectedDeals[0]);if(!deal)return;
  var et=state.provisionType||"MAE";var provs=PROVISIONS.filter(function(p){return p.type===et&&p.dealId===deal.id});var ft=provs.map(function(p){return p.text}).join(" ");
  var res=document.getElementById("redline-results");res.innerHTML='<div class="loading"><svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Analyzing...</div>';
  fetch("/api/redline",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({precedentText:ft,draftText:draft,dealName:dealLabel(deal),provisionType:et})}).then(function(resp){return resp.json()}).then(function(data){
    var h='<div style="padding:14px;border-radius:8px;margin-bottom:16px;background:'+(data.riskLevel==="high"?"var(--red-bg)":data.riskLevel==="medium"?"var(--yellow-bg)":"var(--green-bg)")+'"><span class="risk-badge '+data.riskLevel+'">'+data.riskLevel+' risk</span><p style="font-size:13px;color:var(--text2);line-height:1.6;margin-top:8px">'+esc(data.summary)+'</p></div>';
    (data.differences||[]).forEach(function(d){h+='<div class="diff-card"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><strong style="font-size:13px">'+esc(d.category)+'</strong><span class="risk-badge '+d.risk+'">'+d.risk+'</span></div><div class="diff-cols"><div class="diff-col"><label>Precedent</label><p>'+esc(d.precedent_language)+'</p></div><div class="diff-col"><label>Draft</label><p>'+esc(d.draft_language)+'</p></div></div><div style="font-size:12px;color:var(--text2);line-height:1.5;margin:6px 0">'+esc(d.analysis)+'</div><div class="diff-rec"><strong>Recommendation:</strong> '+esc(d.recommendation)+'</div></div>'});
    res.innerHTML=h;
  }).catch(function(e){res.innerHTML='<div style="color:var(--red)">'+e.message+'</div>'});
}

// ═══════════════════════════════════════════════════
// COMPARE (AI SUMMARIZE)
// ═══════════════════════════════════════════════════
function runCompare(){
  var deals=state.selectedDeals.map(getDeal).filter(Boolean);
  var types=state.provisionType?[state.provisionType]:PROVISION_TYPES.map(function(pt){return pt.key});
  var allProngs=[];
  types.forEach(function(type){getCatsForType(type).forEach(function(cat){var entries=deals.map(function(d){var prov=PROVISIONS.find(function(p){return p.type===type&&p.dealId===d.id&&p.category===cat});return{dealId:d.id,text:prov?prov.text:"[NOT PRESENT]"}});allProngs.push({category:cat,entries:entries})})});
  state.compareResults={comparisons:[],overall_summary:"Analyzing...",key_takeaway:""};renderContent();
  var ptl=state.provisionType?PROVISION_TYPES.find(function(pt){return pt.key===state.provisionType}).label:"All Provisions";
  fetch("/api/compare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provisionType:ptl,prongs:allProngs,deals:deals})}).then(function(resp){return resp.json()}).then(function(data){
    state.compareResults=data;
  }).catch(function(e){state.compareResults={overall_summary:"Error: "+e.message+". Ensure API endpoints are deployed.",comparisons:[]}}).finally(function(){
    renderContent();
  });
}

// ═══════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════
function toggleAdmin(){state.adminMode=!state.adminMode;document.getElementById("admin-btn").classList.toggle("active",state.adminMode);renderContent()}

function openAddCategory(type){
  var modal=document.getElementById("add-cat-modal");var body=document.getElementById("add-cat-body");var cats=getCatsForType(type);
  body.innerHTML='<div style="font-size:12px;color:var(--text3);margin-bottom:14px">Adding a new sub-provision category under <strong>'+(PROVISION_TYPES.find(function(pt){return pt.key===type})?.label||type)+'</strong>.</div><div class="recode-field"><label>New Category Name</label><input type="text" id="new-cat-name" placeholder="e.g. Government Contracts"></div><div style="display:flex;gap:8px;margin-top:16px"><button class="save-btn" onclick="saveNewCategory(\''+type+'\')">Add Category</button><button class="action-btn" onclick="document.getElementById(\'add-cat-modal\').style.display=\'none\'">Cancel</button></div><div style="margin-top:16px;font-size:11px;color:var(--text3)"><strong>Current ('+type+'):</strong><br>'+cats.map(function(c,i){return(i+1)+'. '+esc(c)}).join("<br>")+'</div>';
  modal.style.display="flex";setTimeout(function(){document.getElementById("new-cat-name").focus()},100);
}
function saveNewCategory(type){var nm=document.getElementById("new-cat-name")?.value?.trim();if(!nm)return;if(getCatsForType(type).includes(nm)){alert("Already exists.");return}SUB_PROVISIONS[type].push(nm);saveCats();document.getElementById("add-cat-modal").style.display="none";renderContent()}

function openRecode(cat,type){
  var modal=document.getElementById("recode-modal");var body=document.getElementById("recode-body");var cats=getCatsForType(type);
  var deals=state.selectedDeals.map(getDeal).filter(Boolean);
  var h='<div class="recode-field"><label>Sub-Provision Category</label><select id="recode-cat">'+cats.map(function(c){return'<option '+(c===cat?"selected":"")+'>'+esc(c)+'</option>'}).join("")+'</select></div>';
  deals.forEach(function(d){var prov=PROVISIONS.find(function(p){return p.type===type&&p.dealId===d.id&&p.category===cat});h+='<div class="recode-field"><label>'+esc(dealLabel(d))+'</label><textarea id="recode-'+d.id+'">'+(prov?esc(prov.text):"")+'</textarea></div>'});
  h+='<div style="display:flex;gap:8px;margin-top:16px"><button class="save-btn" onclick="saveRecode(\''+esc(cat).replace(/'/g,"\\'")+'\',\''+type+'\')">Save Gold Standard</button><button class="action-btn" onclick="document.getElementById(\'recode-modal\').style.display=\'none\'">Cancel</button></div><div style="margin-top:12px;font-size:11px;color:var(--text3);line-height:1.5">Ensure the <strong>entire</strong> provision text is captured. Nothing should be left uncoded.</div>';
  body.innerHTML=h;modal.style.display="flex";
}
function saveRecode(origCat,type){
  var newCat=document.getElementById("recode-cat").value;var deals=state.selectedDeals.map(getDeal).filter(Boolean);
  deals.forEach(function(d){var ta=document.getElementById("recode-"+d.id);if(!ta)return;var nt=ta.value.trim();var ex=PROVISIONS.findIndex(function(p){return p.type===type&&p.dealId===d.id&&p.category===origCat});
    if(ex>=0){PROVISIONS[ex].category=newCat;PROVISIONS[ex].text=nt;PROVISIONS[ex].isGold=true}else if(nt){PROVISIONS.push({id:"p_"+Date.now()+"_"+d.id,dealId:d.id,type:type,category:newCat,text:nt,isGold:true,favorability:"unrated"})}
    goldStandards.push({dealId:d.id,type:type,category:newCat,text:nt,correctedAt:new Date().toISOString()})});
  saveGold();document.getElementById("recode-modal").style.display="none";state.compareResults=null;renderContent();
}

// ═══════════════════════════════════════════════════
// ASK
// ═══════════════════════════════════════════════════
function toggleAsk(){document.getElementById("ask-panel").classList.toggle("open");document.getElementById("ask-btn").classList.toggle("active")}
function sendAsk(){
  var input=document.getElementById("ask-q");var q=input.value.trim();if(!q)return;input.value="";
  var msgs=document.getElementById("ask-msgs");
  msgs.innerHTML+='<div class="ask-msg user"><div class="bubble">'+esc(q)+'</div></div>';
  msgs.innerHTML+='<div class="ask-msg assistant" id="ask-load"><div class="bubble"><svg class="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Thinking...</div></div>';
  msgs.scrollTop=msgs.scrollHeight;document.getElementById("ask-go").disabled=true;
  var ctx=PROVISIONS.map(function(p){var d=getDeal(p.dealId);return"["+p.type+"/"+p.category+"] "+(d?dealLabel(d):p.dealId)+": "+p.text}).join("\n\n");
  state.askHistory.push({role:"user",content:q});
  fetch("/api/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q,context:ctx,history:state.askHistory.slice(-10)})}).then(function(resp){return resp.json()}).then(function(data){
    var el=document.getElementById("ask-load");if(el)el.remove();
    var ans=data.answer||data.error||"No response";
    state.askHistory.push({role:"assistant",content:ans});
    msgs.innerHTML+='<div class="ask-msg assistant"><div class="bubble">'+ans.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br>")+'</div></div>';
  }).catch(function(e){
    var el=document.getElementById("ask-load");if(el)el.remove();
    msgs.innerHTML+='<div class="ask-msg assistant"><div class="bubble" style="color:var(--red)">Error: '+e.message+'</div></div>';
  }).finally(function(){
    msgs.scrollTop=msgs.scrollHeight;document.getElementById("ask-go").disabled=false;
  });
}

// INIT
renderSidebar();renderContent();
