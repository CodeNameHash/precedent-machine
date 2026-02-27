// ═══════════════════════════════════════════════════
// DATA — Hardcoded fallback + API fetch on load
// ═══════════════════════════════════════════════════
var FALLBACK_DEALS = [
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

var FALLBACK_PROVISION_TYPES = [
  {key:"MAE", label:"Material Adverse Effect"},
  {key:"IOC", label:"Interim Operating Covenants"},
  {key:"ANTI", label:"Antitrust / Regulatory Efforts"},
  {key:"COND", label:"Conditions to Closing"},
  {key:"TERMR", label:"Termination Rights"},
  {key:"TERMF", label:"Termination Fees"},
];

var FALLBACK_SUB_PROVISIONS = {
  MAE:["Base Definition","General Economic / Market Conditions","Changes in Law / GAAP","Industry Conditions","War / Terrorism","Acts of God / Pandemic","Failure to Meet Projections","Announcement / Pendency Effects","Actions at Parent Request","Disproportionate Impact Qualifier","Changes in Stock Price","Customer / Supplier Relationships"],
  IOC:["Ordinary Course Standard","M&A / Acquisitions","Dividends / Distributions","Equity Issuances","Indebtedness","Capital Expenditures","Employee Compensation","Material Contracts","Accounting / Tax Changes","Charter / Organizational Amendments","Stock Repurchases / Splits","Labor Agreements","Litigation Settlements","Liquidation / Dissolution","Stockholder Rights Plans","Catch-All / General"],
  ANTI:["Efforts Standard","Anti-Hell or High Water","Hell or High Water","Burdensome Condition","Definition of Burdensome Condition","Obligation to Litigate","Obligation Not to Litigate","Regulatory Approval Filing Deadline","Cooperation Obligations"],
  COND:["Regulatory Approval / HSR","No Legal Impediment","Accuracy of Target Representations","Accuracy of Acquirer Representations","Target Compliance with Covenants","Acquirer Compliance with Covenants","No MAE","Third-Party Consents","Stockholder Approval"],
  TERMR:["Mutual Termination","Outside Date","Outside Date Extension","Regulatory Failure","Breach by Target","Breach by Acquirer","Superior Proposal","Intervening Event","Failure of Conditions"],
  TERMF:["Target Termination Fee","Reverse Termination Fee","Regulatory Break-Up Fee","Fee Amount","Fee Triggers","Expense Reimbursement","Fee as Percentage of Deal Value"]
};

var FAV_LEVELS=[
  {key:"strong-buyer",label:"Strong Buyer",color:"#1565C0"},
  {key:"mod-buyer",label:"Mod. Buyer",color:"#4285f4"},
  {key:"neutral",label:"Neutral",color:"#757575"},
  {key:"mod-seller",label:"Mod. Seller",color:"#E65100"},
  {key:"strong-seller",label:"Strong Seller",color:"#C62828"},
];

var FALLBACK_PROVISIONS = [
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
  {id:"p40",dealId:"d1",type:"IOC",category:"M&A / Acquisitions",text:'shall not acquire or agree to acquire, by merging or consolidating with, by purchasing an equity interest in or a material portion of the assets of, or by any other manner, any business or any corporation, partnership, association or other business organization or division thereof, or otherwise acquire or agree to acquire any assets, in each case with a value in excess of $100,000,000 individually or $250,000,000 in the aggregate',favorability:"mod-buyer"},
  {id:"p41",dealId:"d1",type:"IOC",category:"Dividends / Distributions",text:'shall not declare, set aside, make or pay any dividends or other distributions, whether payable in cash, stock, property or otherwise, with respect to any of its capital stock, other than (i) regular quarterly cash dividends not exceeding $0.46 per share consistent with the existing dividend policy and (ii) dividends by a direct or indirect wholly owned Subsidiary to its parent',favorability:"neutral"},
  {id:"p42",dealId:"d1",type:"IOC",category:"Equity Issuances",text:'shall not issue, sell, pledge, dispose of, grant, transfer, encumber, or authorize the issuance, sale, pledge, disposition, grant, transfer or encumbrance of, any shares of capital stock or securities convertible or exchangeable into or exercisable for any shares of such capital stock, except (i) issuance upon exercise of outstanding Company Options or settlement of Company RSUs, and (ii) issuances under the Company ESPP in the ordinary course',favorability:"mod-buyer"},
  {id:"p43",dealId:"d1",type:"IOC",category:"Indebtedness",text:'shall not incur any indebtedness for borrowed money or issue any debt securities or assume, guarantee or endorse the obligations of any Person for borrowed money, in each case in excess of $500,000,000 in the aggregate, except (i) under existing credit facilities in the ordinary course, (ii) intercompany indebtedness, or (iii) letters of credit in the ordinary course',favorability:"neutral"},
  {id:"p44",dealId:"d1",type:"IOC",category:"Capital Expenditures",text:'shall not make or commit to make capital expenditures in excess of 110% of the amount set forth in the Company capital expenditure budget provided to Parent prior to the date hereof for the applicable period',favorability:"mod-buyer"},
  {id:"p45",dealId:"d1",type:"IOC",category:"Employee Compensation",text:'shall not (i) increase compensation or benefits of any current or former director, officer or employee except (A) in the ordinary course consistent with past practice for non-officer employees, (B) as required by applicable Law, or (C) as required by any existing Company Benefit Plan; (ii) grant any equity awards except in the ordinary course consistent with past practice; or (iii) adopt, enter into, materially amend or terminate any Company Benefit Plan',favorability:"mod-buyer"},
  {id:"p50",dealId:"d3",type:"IOC",category:"M&A / Acquisitions",text:'shall not acquire or agree to acquire, by merging or consolidating with, by purchasing an equity interest in or a portion of the assets of, or by any other manner, any business or any Person or division thereof, except for acquisitions of assets (other than equity interests) in the ordinary course of business not exceeding $50,000,000 individually or $150,000,000 in the aggregate',favorability:"mod-buyer"},
  {id:"p51",dealId:"d3",type:"IOC",category:"Dividends / Distributions",text:'shall not declare, set aside, make or pay any dividends or distributions except (i) regular quarterly cash dividends consistent with past practice not exceeding the per-share amount of the most recent quarterly dividend prior to the date hereof, and (ii) dividends by wholly owned Subsidiaries to their parent',favorability:"neutral"},
  {id:"p52",dealId:"d3",type:"IOC",category:"Equity Issuances",text:'shall not issue, sell, grant, pledge or otherwise encumber any shares of capital stock or securities convertible or exchangeable therefor, except (i) upon the exercise or settlement of Company equity awards outstanding on the date hereof, (ii) under the ESPP consistent with past practice, or (iii) in connection with tax withholding obligations arising from settlement of equity awards',favorability:"neutral"},
  {id:"p53",dealId:"d3",type:"IOC",category:"Indebtedness",text:'shall not incur, assume, guarantee or otherwise become liable for any indebtedness for borrowed money, other than (i) borrowings under existing credit facilities in the ordinary course not to exceed $100,000,000, (ii) intercompany indebtedness, and (iii) letters of credit in the ordinary course',favorability:"mod-buyer"},
  {id:"p54",dealId:"d3",type:"IOC",category:"Capital Expenditures",text:'shall not make or commit to make capital expenditures other than (i) in the ordinary course consistent with existing plans and budget, and (ii) any individual expenditure not in excess of $25,000,000 or aggregate expenditures not in excess of $75,000,000 in excess of such budget',favorability:"mod-buyer"},
  {id:"p55",dealId:"d3",type:"IOC",category:"Employee Compensation",text:'shall not (i) increase compensation except (A) annual merit increases in the ordinary course not exceeding 5% for non-officer employees, (B) as required by applicable Law or existing plans, or (C) new hires below VP level at compensation consistent with past practice; (ii) grant any equity awards; or (iii) adopt or materially amend any Company Benefit Plan',favorability:"mod-buyer"},
  {id:"p60",dealId:"d2",type:"IOC",category:"M&A / Acquisitions",text:'shall not acquire or agree to acquire, by merging or consolidating with, by purchasing an equity interest in or a material portion of the assets of, or by any other manner, any business or any Person or division thereof, except for (i) purchases of assets in the ordinary course not exceeding $50,000,000 individually and (ii) transactions solely between the Company and wholly owned Subsidiaries or solely between wholly owned Subsidiaries',favorability:"mod-buyer"},
  {id:"p61",dealId:"d2",type:"IOC",category:"Dividends / Distributions",text:'shall not declare, set aside, make or pay any dividend or other distribution with respect to any capital stock, other than (i) regular quarterly cash dividends not exceeding $0.47 per share consistent with the existing dividend policy and (ii) dividends by a direct or indirect wholly owned Subsidiary to its parent',favorability:"neutral"},
  {id:"p62",dealId:"d2",type:"IOC",category:"Equity Issuances",text:'shall not issue, sell, grant, pledge, dispose of or encumber any shares of capital stock or securities convertible or exercisable therefor, except (i) pursuant to outstanding Company equity awards, (ii) under the ESPP consistent with past practice, or (iii) in connection with tax withholding obligations',favorability:"neutral"},
  {id:"p63",dealId:"d2",type:"IOC",category:"Indebtedness",text:'shall not incur any indebtedness for borrowed money or issue any debt securities, except (i) borrowings under existing credit facilities in the ordinary course not exceeding $100,000,000, (ii) intercompany indebtedness in the ordinary course, and (iii) letters of credit, performance bonds or surety bonds in the ordinary course',favorability:"neutral"},
  {id:"p64",dealId:"d2",type:"IOC",category:"Capital Expenditures",text:'shall not make or commit to make capital expenditures in excess of the amounts set forth in the Company Disclosure Letter for the applicable period (plus a 10% variance)',favorability:"mod-buyer"},
  {id:"p65",dealId:"d2",type:"IOC",category:"Employee Compensation",text:'shall not (i) increase compensation or benefits except (A) in the ordinary course consistent with past practice for non-director/officer employees, (B) as required by applicable Law, or (C) as required by existing Company Benefit Plans; (ii) grant equity awards except annual grants in the ordinary course; or (iii) adopt, enter into, materially amend or terminate any material Company Benefit Plan',favorability:"mod-buyer"},
  // Twitter/Musk Section 6.1 IOC provisions
  {id:"p70",dealId:"d6",type:"IOC",category:"Ordinary Course Standard",text:'From the date of this Agreement until the earlier of the Effective Time and the termination of this Agreement in accordance with Article IX, except as set forth in Section 6.1 of the Company Disclosure Letter, as required by applicable Law, or as otherwise expressly contemplated by this Agreement, the Company shall, and shall cause each of its Subsidiaries to, use commercially reasonable efforts to conduct its business in the ordinary course of business consistent with past practice in all material respects and, to the extent consistent therewith, use commercially reasonable efforts to preserve substantially intact its current business organization, to keep available the services of its current officers and key employees, and to preserve its relationships with customers, suppliers, licensors, licensees, distributors and others having business dealings with it.',favorability:"neutral"},
  {id:"p71",dealId:"d6",type:"IOC",category:"Charter / Organizational Amendments",text:'shall not amend or otherwise change the Company Certificate of Incorporation, the Company Bylaws, or the equivalent organizational documents of any Subsidiary, except as required by applicable Law',favorability:"mod-buyer"},
  {id:"p72",dealId:"d6",type:"IOC",category:"Stock Repurchases / Splits",text:'shall not split, combine, subdivide or reclassify any shares of capital stock of the Company or any Subsidiary, or repurchase, redeem or otherwise acquire any shares of capital stock, except (i) for the acquisition of shares of Company Common Stock from holders of Company Stock Awards in full or partial payment of any taxes payable by such holders upon the exercise, settlement or vesting thereof, and (ii) as required by existing Company Benefit Plans in effect on the date hereof',favorability:"mod-buyer"},
  {id:"p73",dealId:"d6",type:"IOC",category:"Equity Issuances",text:'shall not issue, sell, pledge, dispose of, grant, transfer, encumber, or authorize the issuance, sale, pledge, disposition, grant, transfer or encumbrance of any shares of capital stock or voting securities, or any securities convertible into or exchangeable for any such shares of capital stock or voting securities, or any rights, warrants or options to acquire any such shares, voting securities or convertible or exchangeable securities, except (i) the issuance of shares of Company Common Stock upon the exercise or settlement of Company Stock Awards, (ii) issuances in the ordinary course under the Company ESPP',favorability:"mod-buyer"},
  {id:"p74",dealId:"d6",type:"IOC",category:"Dividends / Distributions",text:'shall not declare, set aside, make or pay any dividend or other distribution, whether payable in cash, stock, property or otherwise, with respect to any of its capital stock, other than dividends by a direct or indirect wholly owned Subsidiary to its parent or another wholly owned Subsidiary',favorability:"mod-buyer"},
  {id:"p75",dealId:"d6",type:"IOC",category:"Employee Compensation",text:'shall not (i) grant or increase any severance, change in control, retention or termination pay to, or enter into any new severance, change in control, retention or termination agreement with, any current or former employee, officer, director or individual independent contractor, other than in the ordinary course consistent with past practice for employees who are not officers or directors; (ii) increase the compensation or benefits payable or to become payable to any current or former employee, officer, director or individual independent contractor, except for increases in the ordinary course consistent with past practice for non-officer employees; (iii) establish, adopt, enter into, amend or terminate any Company Benefit Plan or any arrangement that would have been a Company Benefit Plan had it been entered into prior to the date hereof, except as required by applicable Law or the terms of any Company Benefit Plan as in effect on the date hereof',favorability:"mod-buyer"},
  {id:"p76",dealId:"d6",type:"IOC",category:"Equity Issuances",text:'shall not grant any equity or equity-based awards to any current or former employee, officer, director or individual independent contractor, except for grants of Company RSUs in the ordinary course of business consistent with past practice to newly hired or promoted non-officer employees',favorability:"mod-buyer"},
  {id:"p77",dealId:"d6",type:"IOC",category:"Labor Agreements",text:'shall not recognize any labor union or enter into any collective bargaining agreement or other labor union contract applicable to the employees of the Company or any Subsidiary, except as required by applicable Law',favorability:"mod-buyer"},
  {id:"p78",dealId:"d6",type:"IOC",category:"M&A / Acquisitions",text:'shall not acquire or agree to acquire (including by merger, consolidation, or acquisition of stock or assets or any other business combination) any corporation, partnership, other business organization or any division thereof or any material amount of assets, in each case in excess of $100,000,000 individually or $250,000,000 in the aggregate, other than purchases of equipment and other assets in the ordinary course of business consistent with past practice',favorability:"mod-buyer"},
  {id:"p79",dealId:"d6",type:"IOC",category:"Indebtedness",text:'shall not incur any indebtedness for borrowed money or guarantee any such indebtedness, or issue or sell any debt securities or options, warrants, calls or other rights to acquire any debt securities, except (i) indebtedness incurred under existing credit facilities in the ordinary course not exceeding $500,000,000 in aggregate principal amount at any time outstanding, (ii) intercompany indebtedness among the Company and its wholly owned Subsidiaries, and (iii) letters of credit, bank guarantees, surety bonds, performance bonds or similar instruments issued in the ordinary course',favorability:"neutral"},
  {id:"p80",dealId:"d6",type:"IOC",category:"Material Contracts",text:'shall not enter into, modify or amend in any material respect, or terminate or waive any material right under, any Material Contract or any Contract that would have been a Material Contract had it been entered into prior to the date hereof, other than in the ordinary course of business consistent with past practice',favorability:"mod-buyer"},
  {id:"p81",dealId:"d6",type:"IOC",category:"Accounting / Tax Changes",text:'shall not make any change in financial accounting methods, principles or practices materially affecting the consolidated assets, liabilities or results of operations of the Company, except insofar as may have been required by a change in GAAP or Regulation S-X under the Securities Act',favorability:"neutral"},
  {id:"p82",dealId:"d6",type:"IOC",category:"Accounting / Tax Changes",text:'shall not make, change or revoke any material Tax election, change an annual Tax accounting period, adopt or change any material Tax accounting method, file any material amended Tax Return, enter into any closing agreement with respect to a material amount of Taxes, settle any material Tax claim or assessment, or surrender any right to claim a material refund of Taxes, except in the ordinary course of business consistent with past practice',favorability:"mod-buyer"},
  {id:"p83",dealId:"d6",type:"IOC",category:"Liquidation / Dissolution",text:'shall not adopt a plan of complete or partial liquidation, dissolution, restructuring, recapitalization or other reorganization of the Company or any of its material Subsidiaries (other than the Merger)',favorability:"mod-buyer"},
  {id:"p84",dealId:"d6",type:"IOC",category:"Litigation Settlements",text:'shall not settle, or offer or propose to settle, any Action, other than settlements that (i) involve only the payment of monetary damages not in excess of $50,000,000 individually or $100,000,000 in the aggregate (net of insurance) and (ii) do not involve the imposition of injunctive or other non-monetary relief on the Company or any of its Subsidiaries',favorability:"mod-buyer"},
  {id:"p85",dealId:"d6",type:"IOC",category:"Stockholder Rights Plans",text:'shall not adopt or implement a stockholder rights plan or any similar arrangement',favorability:"strong-buyer"},
  {id:"p86",dealId:"d6",type:"IOC",category:"Catch-All / General",text:'shall not authorize any of, or agree, resolve or commit to do any of, the foregoing actions',favorability:"neutral"},
  {id:"p87",dealId:"d6",type:"IOC",category:"Capital Expenditures",text:'shall not make or commit to make capital expenditures in excess of 110% of the amounts set forth in the Company capital expenditure budget made available to Parent prior to the date hereof for the applicable period, other than capital expenditures reasonably necessary to respond to any emergency or natural disaster',favorability:"mod-buyer"},
];

// Mutable data — starts as fallback, replaced by API data on load
var DEALS = FALLBACK_DEALS.slice();
var PROVISION_TYPES = FALLBACK_PROVISION_TYPES.slice();
var SUB_PROVISIONS = JSON.parse(JSON.stringify(FALLBACK_SUB_PROVISIONS));
var PROVISIONS = FALLBACK_PROVISIONS.slice();
var _dataSource = "fallback";

var savedCats=JSON.parse(localStorage.getItem("customSubProvisions")||"null");
if(savedCats)SUB_PROVISIONS=savedCats;
function saveCats(){localStorage.setItem("customSubProvisions",JSON.stringify(SUB_PROVISIONS))}

var ANNOTATIONS_CACHE={};
var IOC_PARSED_CACHE={};

function parseIOCExceptions(provId,text){
  if(IOC_PARSED_CACHE[provId])return IOC_PARSED_CACHE[provId];
  if(!text){IOC_PARSED_CACHE[provId]={base:text,exceptions:[]};return IOC_PARSED_CACHE[provId]}
  // Split on exception markers
  var splitRx=/\b(except(?:\s+that)?|other\s+than|provided[\s,]+however[\s,]+that)\b/i;
  var parts=text.split(splitRx);
  var base=parts[0].trim();
  // Recombine remainder after the first exception marker
  var remainder="";
  for(var i=1;i<parts.length;i++){
    if(splitRx.test(parts[i]))remainder+=(remainder?" ":"")+parts[i];
    else remainder+=" "+parts[i];
  }
  remainder=remainder.trim();
  if(!remainder){IOC_PARSED_CACHE[provId]={base:base||text,exceptions:[]};return IOC_PARSED_CACHE[provId]}
  // Split numbered sub-exceptions: (i), (ii), (iii), (A), (B), (1), (2), etc.
  var numRx=/\((?:i{1,3}v?|v(?:i{0,3})|x(?:i{0,3})|[A-C]|\d{1,2})\)\s*/gi;
  var excParts=remainder.split(numRx).filter(function(s){return s&&s.trim()});
  var exceptions=[];
  if(excParts.length>1){
    excParts.forEach(function(ep,idx){
      var cleaned=ep.replace(/^[\s,;]+|[\s,;]+$/g,"").replace(/\s+and\s*$/i,"").replace(/^\s*and\s+/i,"");
      if(cleaned.length>10)exceptions.push({label:"Exception "+(idx+1),text:cleaned,canonicalLabel:null});
    });
  }else if(remainder.length>10){
    exceptions.push({label:"Exception 1",text:remainder.replace(/^[\s,;]+|[\s,;]+$/g,""),canonicalLabel:null});
  }
  IOC_PARSED_CACHE[provId]={base:base||text,exceptions:exceptions};
  return IOC_PARSED_CACHE[provId];
}

function labelIOCExceptions(provId,text){
  var parsed=parseIOCExceptions(provId,text);
  if(!parsed.exceptions.length)return;
  // Skip if already labeled
  if(parsed.exceptions[0].canonicalLabel)return;
  fetch("/api/ai/parse-ioc",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({exceptions:parsed.exceptions.map(function(e){return{label:e.label,text:e.text}}),provisionCategory:PROVISIONS.find(function(p){return p.id===provId})?.category||""})}).then(function(r){return r.json()}).then(function(data){
    if(data.labeled_exceptions&&data.labeled_exceptions.length){
      data.labeled_exceptions.forEach(function(le,i){
        if(i<parsed.exceptions.length&&le.canonicalLabel)parsed.exceptions[i].canonicalLabel=le.canonicalLabel;
      });
      renderContent();
    }
  }).catch(function(e){console.warn("IOC label failed:",e.message)});
}

// ═══════════════════════════════════════════════════
// API LOADING — fetch from Supabase, fallback to hardcoded
// ═══════════════════════════════════════════════════
function formatValue(n){if(!n)return"N/A";var b=n/1e9;if(b>=1)return"$"+b.toFixed(b%1===0?0:1)+"B";var m=n/1e6;return"$"+m.toFixed(0)+"M"}

function mapDeal(d){return{id:d.id,acquirer:d.acquirer||"",target:d.target||"",value:d.value_usd?formatValue(d.value_usd):"N/A",sector:d.sector||"",date:d.announce_date||"",jurisdiction:d.jurisdiction||"Delaware",lawyers:d.metadata?.lawyers||{buyer:[],seller:[]},advisors:d.metadata?.advisors||{buyer:[],seller:[]},structure:d.structure||"",termFee:d.term_fee||""}}

function mapProvision(p){return{id:p.id,dealId:p.deal_id,type:p.type||"",category:p.category||"",text:p.full_text||"",favorability:p.ai_favorability||"unrated",textHash:p.text_hash||null,categoryId:p.category_id||null,provisionTypeId:p.provision_type_id||null,parentId:p.parent_id||null}}

function showLoading(){var el=document.getElementById("content");if(el)el.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:200px;gap:10px;color:var(--text3)"><svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Loading from database...</div>'}

async function loadFromAPI(){
  try{
    showLoading();
    var results=await Promise.all([
      fetch("/api/deals").then(function(r){return r.json()}),
      fetch("/api/provisions").then(function(r){return r.json()}),
      fetch("/api/provision-types").then(function(r){return r.json()})
    ]);
    var dealsResp=results[0],provsResp=results[1],typesResp=results[2];

    if(dealsResp.deals&&dealsResp.deals.length>0){
      DEALS=dealsResp.deals.map(mapDeal);
      _dataSource="supabase";
      console.log("[Precedent Machine] Loaded "+DEALS.length+" deals from Supabase");
    }else{
      console.warn("[Precedent Machine] No deals from API, using fallback");
      DEALS=FALLBACK_DEALS.slice();
    }

    if(provsResp.provisions&&provsResp.provisions.length>0){
      PROVISIONS=provsResp.provisions.map(mapProvision);
      console.log("[Precedent Machine] Loaded "+PROVISIONS.length+" provisions from Supabase");
    }else{
      console.warn("[Precedent Machine] No provisions from API, using fallback");
      PROVISIONS=FALLBACK_PROVISIONS.slice();
    }

    if(typesResp.provision_types&&typesResp.provision_types.length>0){
      PROVISION_TYPES=typesResp.provision_types.map(function(t){return{key:t.key,label:t.label}});
    }else{
      PROVISION_TYPES=FALLBACK_PROVISION_TYPES.slice();
    }

    if(typesResp.provision_categories&&typesResp.provision_categories.length>0){
      var newSubs={};
      PROVISION_TYPES.forEach(function(pt){newSubs[pt.key]=[]});
      typesResp.provision_categories.forEach(function(c){
        var typeKey=c.provision_type?.key;
        if(typeKey&&newSubs[typeKey])newSubs[typeKey].push(c.label);
      });
      var hasCats=Object.keys(newSubs).some(function(k){return newSubs[k].length>0});
      if(hasCats)SUB_PROVISIONS=newSubs;
    }

    // Re-apply localStorage custom categories on top of API data
    var saved=JSON.parse(localStorage.getItem("customSubProvisions")||"null");
    if(saved)SUB_PROVISIONS=saved;

    // Update default selected deals to first 3
    if(DEALS.length>=3)state.selectedDeals=[DEALS[0].id,DEALS[1].id,DEALS[2].id];
    else state.selectedDeals=DEALS.map(function(d){return d.id});

  }catch(e){
    console.warn("[Precedent Machine] API fetch failed, using fallback data:",e.message);
    DEALS=FALLBACK_DEALS.slice();
    PROVISIONS=FALLBACK_PROVISIONS.slice();
    PROVISION_TYPES=FALLBACK_PROVISION_TYPES.slice();
    SUB_PROVISIONS=JSON.parse(JSON.stringify(FALLBACK_SUB_PROVISIONS));
    _dataSource="fallback";
  }
  renderSidebar();renderContent();
  loadAnnotations();
  // Fire-and-forget IOC exception labeling
  PROVISIONS.forEach(function(p){if(p.type==="IOC"&&p.text)labelIOCExceptions(p.id,p.text)});
}

var goldStandards=JSON.parse(localStorage.getItem("goldStandards")||"[]");
function saveGold(){localStorage.setItem("goldStandards",JSON.stringify(goldStandards))}
var favOverrides=JSON.parse(localStorage.getItem("favOverrides")||"{}");
function saveFav(){localStorage.setItem("favOverrides",JSON.stringify(favOverrides))}
function getProvFav(pid){return favOverrides[pid]||PROVISIONS.find(function(p){return p.id===pid})?.favorability||"unrated"}

// ═══════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════
var state={provisionType:null,selectedDeals:["d1","d2","d3"],searchTerms:[],adminMode:false,compareResults:null,activeTab:"coded",askHistory:[],sidebarProvsCollapsed:JSON.parse(localStorage.getItem("sidebarProvsCollapsed")||"false"),sidebarDealsCollapsed:JSON.parse(localStorage.getItem("sidebarDealsCollapsed")||"false"),hiddenCategories:new Set(JSON.parse(localStorage.getItem("hiddenCategories")||"[]")),expandedProvisionType:null,reportTerms:JSON.parse(localStorage.getItem("reportTerms")||'["Value","Date","Buyer Counsel","Seller Counsel"]'),collapsedSections:new Set(),collapsedCards:new Set(),activeFilters:[{key:"law_firm",label:"Law Firm",active:false}],filterValues:{}};

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
function esc(s){return s?s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"):""}
function getDeal(id){return DEALS.find(function(d){return d.id===id})}
function dealLabel(d){return d.acquirer+" / "+d.target}
function getProvs(type,did){return PROVISIONS.filter(function(p){return p.type===type&&p.dealId===did})}

// Parse "$61B" / "$68.7B" / "$100,000,000" / "$500M" to numeric
function parseDollarStr(s){
  if(!s)return 0;var c=s.replace(/[$,\s]/g,"");
  var m=c.match(/([\d.]+)\s*(B|billion|M|million)?/i);if(!m)return 0;
  var n=parseFloat(m[1]);if(!n)return 0;
  if(m[2]){var u=m[2].charAt(0).toUpperCase();if(u==="B")n*=1e9;else if(u==="M")n*=1e6}
  else if(n>999)n=n; // already raw number like 100000000
  return n;
}
function getDealValueNum(dealId){var d=getDeal(dealId);if(!d||!d.value)return 0;return parseDollarStr(d.value)}

// Inject blue % badges after dollar amounts in escaped HTML
function addDollarPcts(html,dealId){
  var dv=getDealValueNum(dealId);if(!dv)return html;
  var dealValStr=getDeal(dealId).value;
  return html.replace(/\$([\d,]+(?:\.\d+)?)/g,function(match,numPart){
    var num=parseDollarStr(match);
    if(num<1e6||num>=dv)return match;
    var pct=num/dv*100;
    var pctStr=pct<0.1?"&lt;0.1":pct<1?pct.toFixed(2):pct.toFixed(1);
    var rawPct=pct<0.1?"<0.1":pct<1?pct.toFixed(2):pct.toFixed(1);
    return match+'<span class="dollar-pct" title="'+match.replace(/"/g,"")+" / "+esc(dealValStr)+" = "+rawPct+'%">'+pctStr+'%</span>';
  });
}

function highlightText(t,terms,dealId){
  var out=esc(t);
  if(dealId)out=addDollarPcts(out,dealId);
  if(!terms||!terms.length)return out;
  var rx=new RegExp("("+terms.map(function(t){return t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}).join("|")+")","gi");
  return out.replace(rx,'<span class="hl">$1</span>');
}
function getCatsForType(t){return SUB_PROVISIONS[t]||[]}
function getCoverage(type,did){var provs=getProvs(type,did);var cats=getCatsForType(type);var present=new Set(provs.map(function(p){return p.category}));var covered=cats.filter(function(c){return present.has(c)}).length;return{pct:cats.length?Math.round(covered/cats.length*100):0,coded:covered,total:cats.length}}

// ═══════════════════════════════════════════════════
// ANNOTATION RENDERING
// ═══════════════════════════════════════════════════
function annotateText(text,provisionId,terms){
  // Resolve dealId for dollar % calculations
  var prov=PROVISIONS.find(function(p){return p.id===provisionId});
  var dealId=prov?prov.dealId:null;
  var anns=ANNOTATIONS_CACHE[provisionId];
  if(!anns||!anns.length)return highlightText(text,terms,dealId);
  // Build regions with validated offsets
  var regions=[];
  anns.forEach(function(a){
    var s=a.start_offset,e=a.end_offset;
    // Validate offsets match phrase
    if(typeof s==="number"&&typeof e==="number"&&s>=0&&e<=text.length&&text.substring(s,e)===a.phrase){
      regions.push({start:s,end:e,ann:a});
    }else{
      // Fallback: find phrase in text
      var idx=text.indexOf(a.phrase);
      if(idx>=0)regions.push({start:idx,end:idx+a.phrase.length,ann:a});
    }
  });
  // Sort by start, remove overlaps (first wins)
  regions.sort(function(a,b){return a.start-b.start});
  var clean=[];
  var lastEnd=0;
  regions.forEach(function(r){
    if(r.start>=lastEnd){clean.push(r);lastEnd=r.end}
  });
  if(!clean.length)return highlightText(text,terms,dealId);
  // Walk text producing HTML
  var html="";var pos=0;
  clean.forEach(function(r){
    if(r.start>pos)html+=highlightText(text.substring(pos,r.start),terms,dealId);
    var favClass=r.ann.favorability||"neutral";
    html+='<span class="ann-phrase '+esc(favClass)+'" onclick="openAnnotationPopover(\''+r.ann.id+'\',event)">'+highlightText(text.substring(r.start,r.end),terms,dealId)+'</span>';
    pos=r.end;
  });
  if(pos<text.length)html+=highlightText(text.substring(pos),terms,dealId);
  return html;
}

function findAnnotation(annId){
  for(var pid in ANNOTATIONS_CACHE){
    var list=ANNOTATIONS_CACHE[pid];
    for(var i=0;i<list.length;i++){if(list[i].id===annId)return list[i]}
  }
  return null;
}

function openAnnotationPopover(annId,event){
  event.stopPropagation();
  var ann=findAnnotation(annId);if(!ann)return;
  var pop=document.getElementById("ann-popover");
  var lv=FAV_LEVELS.find(function(f){return f.key===ann.favorability})||{label:"Unknown",color:"#757575"};
  var h='<div class="ann-phrase-quote">'+esc(ann.phrase)+'</div>';
  h+='<div class="ann-fav-row"><div class="ann-fav-dot" style="background:'+lv.color+'"></div><span class="ann-fav-label" style="color:'+lv.color+'">'+lv.label+'</span></div>';
  h+='<div class="ann-tags">';
  if(ann.is_ai_generated)h+='<span class="ann-tag ai">AI</span>';
  if(ann.verified_by)h+='<span class="ann-tag verified">Verified</span>';
  if(!ann.is_ai_generated&&!ann.verified_by)h+='<span class="ann-tag admin">Manual</span>';
  h+='</div>';
  if(ann.note)h+='<div class="ann-note">'+esc(ann.note)+'</div>';
  h+='<div class="ann-meta">'+(ann.verified_by_name?'Verified by '+esc(ann.verified_by_name)+' · ':'')+(ann.created_at?new Date(ann.created_at).toLocaleDateString():"")+'</div>';
  // Admin edit form
  if(state.adminMode){
    h+='<div class="ann-edit-form"><label>Favorability</label><select id="ann-edit-fav">';
    FAV_LEVELS.forEach(function(f){h+='<option value="'+f.key+'"'+(f.key===ann.favorability?' selected':'')+'>'+f.label+'</option>'});
    h+='</select><label>Note</label><textarea id="ann-edit-note">'+(ann.note?esc(ann.note):"")+'</textarea>';
    h+='<button class="ann-save-btn" onclick="saveAnnotationEdit(\''+annId+'\')">Save Override</button></div>';
  }
  pop.innerHTML=h;
  // Position below clicked phrase
  var rect=event.target.getBoundingClientRect();
  var top=rect.bottom+6;var left=rect.left;
  if(left+320>window.innerWidth)left=window.innerWidth-330;
  if(top+300>window.innerHeight)top=rect.top-310;
  pop.style.top=Math.max(0,top)+"px";
  pop.style.left=Math.max(0,left)+"px";
  pop.style.display="block";
  // Click-outside dismissal
  setTimeout(function(){
    var dismiss=function(e){if(!pop.contains(e.target)&&!e.target.classList.contains("ann-phrase")){closeAnnotationPopover();document.removeEventListener("click",dismiss)}};
    document.addEventListener("click",dismiss);
  },10);
}

function closeAnnotationPopover(){document.getElementById("ann-popover").style.display="none"}

function saveAnnotationEdit(annId){
  var ann=findAnnotation(annId);if(!ann)return;
  var newFav=document.getElementById("ann-edit-fav").value;
  var newNote=document.getElementById("ann-edit-note").value.trim();
  // POST new annotation as override
  fetch("/api/annotations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    provision_id:ann.provision_id,phrase:ann.phrase,start_offset:ann.start_offset,end_offset:ann.end_offset,
    favorability:newFav,note:newNote||ann.note,is_ai_generated:false,overrides_id:ann.id
  })}).then(function(r){return r.json()}).then(function(data){
    if(data.annotation){
      // Update cache in place — replace old annotation with new one
      var list=ANNOTATIONS_CACHE[ann.provision_id];
      if(list){
        var idx=list.findIndex(function(a){return a.id===annId});
        if(idx>=0)list[idx]=data.annotation;else list.push(data.annotation);
      }
      closeAnnotationPopover();renderContent();
    }
  }).catch(function(e){console.error("Failed to save annotation override:",e)});
}

function loadAnnotations(){
  if(_dataSource==="fallback")return;
  var provIds=PROVISIONS.map(function(p){return p.id}).filter(function(id){return typeof id==="string"&&id.length>5});
  if(!provIds.length)return;
  // Batch in groups of 50
  var batches=[];
  for(var i=0;i<provIds.length;i+=50){batches.push(provIds.slice(i,i+50))}
  var done=0;
  batches.forEach(function(batch){
    fetch("/api/annotations?provision_ids="+batch.join(",")).then(function(r){return r.json()}).then(function(data){
      if(data.annotations_by_provision){
        Object.keys(data.annotations_by_provision).forEach(function(pid){
          ANNOTATIONS_CACHE[pid]=data.annotations_by_provision[pid];
        });
      }
    }).catch(function(e){console.warn("Annotations batch fetch failed:",e.message)}).finally(function(){
      done++;if(done===batches.length)renderContent();
    });
  });
}

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
  var provArrow=state.sidebarProvsCollapsed?'&#9654;':'&#9660;';
  var dealArrow=state.sidebarDealsCollapsed?'&#9654;':'&#9660;';
  var h='<div class="sidebar-header"><span><span class="sidebar-toggle" onclick="toggleSidebarSection(\'provs\')">'+provArrow+'</span> Provisions</span><span style="font-size:10px;color:var(--text5);text-transform:none;letter-spacing:0;cursor:pointer" onclick="showAllCategories()">show all</span></div>';
  if(!state.sidebarProvsCollapsed){
    h+='<div class="prov-item '+(state.provisionType===null?"selected":"")+'" onclick="selectProvisionType(null)"><div class="prov-type" style="color:var(--text3)">ALL</div><div class="prov-title">All Provisions</div><div class="prov-deal">Compare all provision types side by side</div></div>';
    PROVISION_TYPES.forEach(function(pt){
      var a=state.provisionType===pt.key;
      var expanded=state.expandedProvisionType===pt.key;
      var arrow=expanded?'&#9660;':'&#9654;';
      h+='<div class="prov-item '+(a?"selected":"")+'" onclick="selectProvisionType(\''+pt.key+'\')"><div class="prov-type"><span style="font-size:8px;margin-right:4px">'+arrow+'</span>'+pt.key+'</div><div class="prov-title">'+pt.label+'</div><div class="prov-deal">'+getCatsForType(pt.key).length+' sub-provisions &middot; '+new Set(PROVISIONS.filter(function(p){return p.type===pt.key}).map(function(p){return p.dealId})).size+' deals coded</div></div>';
      if(expanded){
        getCatsForType(pt.key).forEach(function(cat){
          var hidden=state.hiddenCategories.has(cat);
          h+='<div class="sidebar-cat-item'+(hidden?" hidden-cat":"")+'" onclick="event.stopPropagation();toggleCategoryVisibility(\''+esc(cat).replace(/'/g,"\\'")+'\')"><span class="sidebar-cat-dot"></span>'+esc(cat)+'</div>';
        });
      }
    });
  }
  h+='<div class="sidebar-header"><span><span class="sidebar-toggle" onclick="toggleSidebarSection(\'deals\')">'+dealArrow+'</span> Deals</span><span style="font-size:10px;color:var(--gold);text-transform:none;letter-spacing:0">'+state.selectedDeals.length+' selected</span></div>';
  if(!state.sidebarDealsCollapsed){
    DEALS.forEach(function(d){
      var ck=state.selectedDeals.includes(d.id);
      var hp=state.provisionType?PROVISIONS.some(function(p){return p.dealId===d.id&&p.type===state.provisionType}):PROVISIONS.some(function(p){return p.dealId===d.id});
      h+='<div class="deal-item" onclick="toggleDeal(\''+d.id+'\')" style="'+(hp?"":"opacity:0.4")+'"><div class="deal-check '+(ck?"checked":"")+'">&#10003;</div><div class="deal-info"><div class="deal-name">'+esc(dealLabel(d))+'</div><div class="deal-meta">'+d.value+' &middot; '+d.sector+' &middot; '+d.date.slice(0,4)+'</div>'+(d.lawyers?'<div class="deal-meta" style="margin-top:1px;font-size:9.5px">'+esc((d.lawyers.buyer||[]).concat(d.lawyers.seller||[]).slice(0,2).join(", "))+'</div>':"")+'</div></div>';
    });
  }
  // Filters section
  h+='<div class="sidebar-header"><span>Filters</span><span style="font-size:10px;color:var(--gold);text-transform:none;letter-spacing:0;cursor:pointer" onclick="addNewFilter()">+ add filter</span></div>';
  state.activeFilters.forEach(function(af){
    var def=getFilterDef(af.key);if(!def)return;
    var filterArrow=af.active?'&#9660;':'&#9654;';
    h+='<div class="prov-item" style="padding:8px 16px" onclick="toggleFilter(\''+af.key+'\')"><div class="prov-type" style="color:var(--text3)"><span style="font-size:8px;margin-right:4px">'+filterArrow+'</span>'+esc(af.label)+'</div></div>';
    if(af.active){
      var vals=getFilterValues(af.key);
      var sel=state.filterValues[af.key]||[];
      vals.forEach(function(v){
        var checked=sel.indexOf(v)>=0;
        h+='<div class="sidebar-cat-item" style="padding-left:32px;font-size:11px;color:'+(checked?'var(--gold)':'var(--text3)')+';font-weight:'+(checked?'600':'400')+'" onclick="event.stopPropagation();toggleFilterValue(\''+af.key+"','"+esc(v).replace(/'/g,"\\'")+'\')">';
        h+='<span style="display:inline-block;width:12px;height:12px;border:1.5px solid '+(checked?'var(--gold)':'#ccc')+';border-radius:2px;margin-right:6px;text-align:center;line-height:12px;font-size:8px;flex-shrink:0;background:'+(checked?'var(--gold)':'transparent')+';color:'+(checked?'#fff':'transparent')+'">&#10003;</span>';
        h+=esc(v)+'</div>';
      });
    }
  });
  el.innerHTML=h;
}
function toggleSidebarSection(section){
  if(section==='provs'){state.sidebarProvsCollapsed=!state.sidebarProvsCollapsed;localStorage.setItem("sidebarProvsCollapsed",JSON.stringify(state.sidebarProvsCollapsed))}
  else{state.sidebarDealsCollapsed=!state.sidebarDealsCollapsed;localStorage.setItem("sidebarDealsCollapsed",JSON.stringify(state.sidebarDealsCollapsed))}
  renderSidebar();
}
function showAllCategories(){
  state.hiddenCategories.clear();
  localStorage.setItem("hiddenCategories","[]");
  state.provisionType=null;state.expandedProvisionType=null;
  renderSidebar();renderContent();
}
function toggleCategoryVisibility(cat){
  if(state.hiddenCategories.has(cat))state.hiddenCategories.delete(cat);
  else state.hiddenCategories.add(cat);
  localStorage.setItem("hiddenCategories",JSON.stringify(Array.from(state.hiddenCategories)));
  renderSidebar();renderContent();
}
function selectProvisionType(t){
  if(t===null){state.provisionType=null;state.expandedProvisionType=null;}
  else if(state.provisionType===t){state.expandedProvisionType=state.expandedProvisionType===t?null:t;}
  else{state.provisionType=t;state.expandedProvisionType=t;}
  state.compareResults=null;state.activeTab="coded";renderSidebar();renderContent();
}
function toggleDeal(id){var i=state.selectedDeals.indexOf(id);if(i>=0)state.selectedDeals.splice(i,1);else state.selectedDeals.push(id);state.compareResults=null;renderSidebar();renderContent()}

// ═══════════════════════════════════════════════════
// FILTERS (extensible)
// ═══════════════════════════════════════════════════
var AVAILABLE_FILTERS=[
  {key:"law_firm",label:"Law Firm",extract:function(d){var firms=[];if(d.lawyers){if(d.lawyers.buyer)firms=firms.concat(d.lawyers.buyer);if(d.lawyers.seller)firms=firms.concat(d.lawyers.seller)}return firms}},
  {key:"sector",label:"Sector",extract:function(d){return d.sector?[d.sector]:[]}},
  {key:"jurisdiction",label:"Jurisdiction",extract:function(d){return d.jurisdiction?[d.jurisdiction]:[]}},
  {key:"year",label:"Year",extract:function(d){return d.date?[d.date.slice(0,4)]:[]}},
  {key:"advisor",label:"Advisor",extract:function(d){var a=[];if(d.advisors){if(d.advisors.buyer)a=a.concat(d.advisors.buyer);if(d.advisors.seller)a=a.concat(d.advisors.seller)}return a}},
  {key:"structure",label:"Structure",extract:function(d){return d.structure?[d.structure]:[]}},
];
function getFilterDef(key){return AVAILABLE_FILTERS.find(function(f){return f.key===key})}
function getFilterValues(key){var def=getFilterDef(key);if(!def)return[];var vals=new Set();DEALS.forEach(function(d){def.extract(d).forEach(function(v){if(v)vals.add(v)})});return Array.from(vals).sort()}
function toggleFilter(key){var f=state.activeFilters.find(function(af){return af.key===key});if(f)f.active=!f.active;else{var def=getFilterDef(key);if(def)state.activeFilters.push({key:key,label:def.label,active:true})}renderSidebar()}
function toggleFilterValue(filterKey,val){if(!state.filterValues[filterKey])state.filterValues[filterKey]=[];var arr=state.filterValues[filterKey];var idx=arr.indexOf(val);if(idx>=0)arr.splice(idx,1);else arr.push(val);applyFilters();renderSidebar();renderContent()}
function applyFilters(){
  // Filter deals based on active filter selections
  var filtered=DEALS.map(function(d){return d.id});
  state.activeFilters.forEach(function(af){
    if(!af.active)return;
    var sel=state.filterValues[af.key];
    if(!sel||!sel.length)return;
    var def=getFilterDef(af.key);if(!def)return;
    filtered=filtered.filter(function(did){var d=getDeal(did);if(!d)return false;var vals=def.extract(d);return sel.some(function(s){return vals.indexOf(s)>=0})});
  });
  state.selectedDeals=filtered;
}
function addNewFilter(){
  var unused=AVAILABLE_FILTERS.filter(function(af){return!state.activeFilters.some(function(f){return f.key===af.key})});
  if(!unused.length){alert("All available filters are already added.");return}
  var opts=unused.map(function(f,i){return(i+1)+". "+f.label}).join("\n");
  var choice=prompt("Add filter:\n"+opts+"\n\nEnter number:");
  if(!choice)return;
  var idx=parseInt(choice)-1;
  if(idx>=0&&idx<unused.length){
    state.activeFilters.push({key:unused[idx].key,label:unused[idx].label,active:true});
    renderSidebar();
  }
}

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
    h+='<div class="admin-banner"><span>Admin mode &mdash; Recode sub-provisions or add new categories</span><div style="display:flex;gap:6px;flex-wrap:wrap">'+types.map(function(t){return '<button onclick="openAddCategory(\''+t+'\')">+ '+t+' Category</button>'}).join("")+'<button onclick="ingestFullAgreement(\''+state.selectedDeals[0]+'\')">Ingest Agreement</button><button onclick="toggleAdmin()">Turn Off</button></div></div>';
  }

  if(state.activeTab==="coded"){types.forEach(function(type){var cats=getCatsForType(type);var secKey="sec-"+type;var secCollapsed=state.collapsedSections.has(secKey);var secArrow=secCollapsed?'&#9654;':'&#9660;';h+='<div class="prongs-section" style="padding-bottom:0"><div class="provision-section-divider" style="cursor:pointer" onclick="toggleSection(\''+secKey+'\')"><span>'+secArrow+' '+(PROVISION_TYPES.find(function(pt){return pt.key===type})?.label||type)+'</span><span style="font-size:10px;color:var(--text4);text-transform:none;letter-spacing:0;font-weight:400">'+cats.filter(function(c){return!state.hiddenCategories.has(c)}).length+' sub-provisions</span></div></div>';if(!secCollapsed)h+=renderCodedView(deals,cats,type)})}
  else if(state.activeTab==="fulltext"){h+=renderFullTextView(deals,types)}
  else if(state.activeTab==="report"){h+=renderReportView(deals,types)}
  else if(state.activeTab==="redline"){h+=renderRedlineView(deals)}
  el.innerHTML=h;
  if(state.adminMode)enableAnnotationCreation();
}
function setTab(t){state.activeTab=t;renderContent()}
function clearCompare(){state.compareResults=null;renderContent()}
function toggleSection(key){if(state.collapsedSections.has(key))state.collapsedSections.delete(key);else state.collapsedSections.add(key);renderContent()}
function toggleCard(key){if(state.collapsedCards.has(key))state.collapsedCards.delete(key);else state.collapsedCards.add(key);renderContent()}

// ═══════════════════════════════════════════════════
// CODED VIEW
// ═══════════════════════════════════════════════════
function renderDealInfoCards(deals){
  var h='<div style="display:grid;grid-template-columns:repeat('+deals.length+',1fr);gap:12px;margin-bottom:16px">';
  deals.forEach(function(d){
    h+='<div class="deal-info-card" style="padding:10px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:8px">';
    h+='<div style="font:600 12px var(--serif);color:var(--text);margin-bottom:6px">'+esc(dealLabel(d))+'</div>';
    h+='<div style="font-size:10px;color:var(--text3);line-height:1.7">';
    if(d.value)h+='<div><span style="color:var(--text4)">Value:</span> '+esc(d.value)+'</div>';
    if(d.date)h+='<div><span style="color:var(--text4)">Date:</span> '+esc(d.date)+'</div>';
    if(d.sector)h+='<div><span style="color:var(--text4)">Sector:</span> '+esc(d.sector)+'</div>';
    if(d.lawyers&&d.lawyers.buyer&&d.lawyers.buyer.length)h+='<div><span style="color:var(--text4)">Buyer Counsel:</span> '+esc(d.lawyers.buyer.join(", "))+'</div>';
    if(d.lawyers&&d.lawyers.seller&&d.lawyers.seller.length)h+='<div><span style="color:var(--text4)">Seller Counsel:</span> '+esc(d.lawyers.seller.join(", "))+'</div>';
    h+='</div></div>';
  });
  h+='</div>';
  return h;
}

function renderCodedView(deals,cats,type){
  var cols=deals.length;
  var h='<div class="prongs-section">';
  h+=renderDealInfoCards(deals);

  cats.forEach(function(cat){
    if(state.hiddenCategories.has(cat))return;
    var entries=deals.map(function(d){var prov=PROVISIONS.find(function(p){return p.type===type&&p.dealId===d.id&&p.category===cat});return{deal:d,prov:prov}});
    var present=entries.filter(function(e){return e.prov}).length;
    var tagClass="all",tagText="All "+present;
    if(present===0){tagClass="missing";tagText="None"}else if(present<deals.length){tagClass="varies";tagText=present+"/"+deals.length}
    var cmp=state.compareResults?.comparisons?.find(function(c){return c.category===cat});

    var cardKey="card-"+type+"-"+cat;var cardCollapsed=state.collapsedCards.has(cardKey);var cardArrow=cardCollapsed?'&#9654;':'&#9660;';
    h+='<div class="prong-card" id="card-'+esc(cat).replace(/\s+/g,"-").replace(/[^a-zA-Z0-9-]/g,"")+'"><div class="prong-header"><div style="cursor:pointer;display:flex;align-items:center;gap:6px" onclick="toggleCard(\''+esc(cardKey).replace(/'/g,"\\'")+'\')"><span style="font-size:9px;color:var(--text4)">'+cardArrow+'</span><span class="prong-name">'+esc(cat)+'</span></div><div style="display:flex;gap:8px;align-items:center"><span class="prong-tag '+tagClass+'">'+tagText+'</span>'+(state.adminMode?'<button class="admin-edit" onclick="startInlineRecode(this,\''+esc(cat).replace(/'/g,"\\'")+'\',\''+type+'\','+cols+')">Recode</button>':"")+'</div></div>';if(cardCollapsed){h+='</div>';return}h+='<div class="prong-body" style="grid-template-columns:repeat('+cols+',1fr)">';

    // Parse IOC exceptions for sub-row rendering
    var parsedEntries=null;
    if(type==="IOC"){
      parsedEntries=entries.map(function(e){return e.prov?parseIOCExceptions(e.prov.id,e.prov.text):null});
    }

    entries.forEach(function(e,idx){
      var fav=e.prov?getProvFav(e.prov.id):null;
      var displayText;
      if(type==="IOC"&&parsedEntries&&parsedEntries[idx]&&parsedEntries[idx].exceptions.length>0){
        displayText=annotateText(parsedEntries[idx].base,e.prov.id,state.searchTerms);
      }else{
        displayText=e.prov?annotateText(e.prov.text,e.prov.id,state.searchTerms):'<span class="absent">Not present</span>';
      }
      h+='<div class="prong-cell"'+(e.prov?' data-prov-id="'+e.prov.id+'"':'')+'><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div class="prong-deal-label">'+esc(e.deal.acquirer)+'/'+esc(e.deal.target)+'</div><div style="display:flex;gap:4px;align-items:center">'+(e.prov&&state.adminMode?'<button class="ann-add-btn" onclick="event.stopPropagation();promptAnnotation(\''+e.prov.id+'\',this)" title="Add annotation">+ Ann</button>':'')+(e.prov?renderFavBadge(e.prov.id,fav):"")+'</div></div><div class="prong-text">'+displayText+'</div></div>';
    });
    h+='</div>';

    // IOC exception sub-rows
    if(type==="IOC"&&parsedEntries){
      // Collect union of canonical labels across all deals for this category
      var allLabels=[];
      parsedEntries.forEach(function(pe){
        if(!pe)return;
        pe.exceptions.forEach(function(ex){
          var lbl=ex.canonicalLabel||ex.label;
          if(allLabels.indexOf(lbl)<0)allLabels.push(lbl);
        });
      });
      if(allLabels.length>0){
        allLabels.forEach(function(lbl){
          h+='<div class="prong-sub-row" style="grid-template-columns:repeat('+cols+',1fr)"><div class="prong-sub-label">'+esc(lbl)+'</div>';
          entries.forEach(function(e,idx){
            var pe=parsedEntries[idx];
            var match=null;
            if(pe){
              match=pe.exceptions.find(function(ex){return(ex.canonicalLabel||ex.label)===lbl});
            }
            h+='<div class="prong-sub-cell">'+(match?highlightText(match.text,state.searchTerms,e.deal.id):'\u2014')+'</div>';
          });
          h+='</div>';
        });
      }
    }

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
  // Deal info headers
  h+=renderDealInfoCards(deals);
  types.forEach(function(type){
    if(types.length>1)h+='<div class="provision-section-divider" style="margin-bottom:16px"><span>'+(PROVISION_TYPES.find(function(pt){return pt.key===type})?.label||type)+'</span></div>';
    h+='<div class="fulltext-grid" style="display:grid;grid-template-columns:repeat('+deals.length+',1fr);gap:16px;margin-bottom:24px">';
    deals.forEach(function(d){
      var provs=PROVISIONS.filter(function(p){return p.type===type&&p.dealId===d.id});
      h+='<div><div class="full-text-label"><span>'+esc(dealLabel(d))+'</span></div><div class="full-text">'+(provs.length?provs.map(function(p){return'<span class="coded" title="'+esc(p.category)+'">'+annotateText(p.text,p.id,state.searchTerms)+'</span>'}).join("; "):'<span style="color:var(--text5);font-style:italic">No provisions coded</span>')+'</div></div>';
    });
    h+='</div>';
  });
  h+='</div>';return h;
}

// ═══════════════════════════════════════════════════
// REPORT VIEW
// ═══════════════════════════════════════════════════
var REPORT_TERMS=[
  {key:"Value",fn:function(d){return d.value}},
  {key:"Date",fn:function(d){return d.date}},
  {key:"Sector",fn:function(d){return d.sector}},
  {key:"Structure",fn:function(d){return d.structure||""}},
  {key:"Buyer Counsel",fn:function(d){return(d.lawyers?.buyer||[]).join(", ")}},
  {key:"Seller Counsel",fn:function(d){return(d.lawyers?.seller||[]).join(", ")}},
  {key:"Buyer Advisors",fn:function(d){return(d.advisors?.buyer||[]).join(", ")||"\u2014"}},
  {key:"Seller Advisors",fn:function(d){return(d.advisors?.seller||[]).join(", ")}},
  {key:"Term. Fee",fn:function(d){return d.termFee||""}},
  {key:"Jurisdiction",fn:function(d){return d.jurisdiction||""}}
];
function toggleReportTerm(key){
  var idx=state.reportTerms.indexOf(key);
  if(idx>=0)state.reportTerms.splice(idx,1);else state.reportTerms.push(key);
  localStorage.setItem("reportTerms",JSON.stringify(state.reportTerms));
  renderContent();
}
function renderReportView(deals,types){
  var h='<div style="padding:20px 28px">';
  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px"><div><div style="font:700 20px var(--serif)">Precedent Comparison Report</div><div style="font-size:11px;color:var(--text4);margin-top:4px">'+new Date().toISOString().split("T")[0]+' &mdash; '+deals.length+' deals</div></div><div class="report-export-btns" style="display:flex;gap:6px"><button class="action-btn" onclick="exportReportPDF()">Print / PDF</button><button class="action-btn" onclick="exportReportWord()">Export Word</button></div></div>';

  // Toggle chips for report terms
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center"><span class="filter-label">Deal Terms</span>';
  REPORT_TERMS.forEach(function(rt){var on=state.reportTerms.indexOf(rt.key)>=0;h+='<button class="filter-chip'+(on?" active":"")+'" onclick="toggleReportTerm(\''+esc(rt.key).replace(/'/g,"\\'")+'\')">'+esc(rt.key)+'</button>'});
  h+='</div>';

  h+='<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text4);margin-bottom:8px">Deal Overview</div><table class="report-table"><colgroup><col style="width:150px">';
  deals.forEach(function(){h+='<col>'});
  h+='</colgroup><thead><tr><th>Deal</th>';
  deals.forEach(function(d){h+='<th>'+esc(d.acquirer)+'/'+esc(d.target)+'</th>'});
  h+='</tr></thead><tbody>';
  REPORT_TERMS.forEach(function(rt){
    if(state.reportTerms.indexOf(rt.key)<0)return;
    h+='<tr><td class="sub-prov-label">'+esc(rt.key)+'</td>';deals.forEach(function(d){h+='<td>'+esc(rt.fn(d)||"\u2014")+'</td>'});h+='</tr>';
  });
  h+='</tbody></table>';

  types.forEach(function(type){
    var cats=getCatsForType(type);
    h+='<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--gold);margin:24px 0 8px;font-weight:700">'+(PROVISION_TYPES.find(function(pt){return pt.key===type})?.label||type)+'</div><table class="report-table"><colgroup><col style="width:150px">';
    deals.forEach(function(){h+='<col>'});
    h+='</colgroup><thead><tr><th>Sub-Provision</th>';
    deals.forEach(function(d){h+='<th>'+esc(d.acquirer)+'/'+esc(d.target)+'</th>'});
    h+='</tr></thead><tbody>';
    cats.forEach(function(cat){
      if(state.hiddenCategories.has(cat))return;
      h+='<tr><td class="sub-prov-label">'+esc(cat)+'</td>';
      var catParsed=[];
      deals.forEach(function(d){var prov=PROVISIONS.find(function(p){return p.type===type&&p.dealId===d.id&&p.category===cat});if(prov){var fav=getProvFav(prov.id);var fl=FAV_LEVELS.find(function(f){return f.key===fav});
        // For IOC, show base text (before exceptions) in main row
        var displayText=prov.text;
        if(type==="IOC"){var parsed=parseIOCExceptions(prov.id,prov.text);catParsed.push(parsed);if(parsed.exceptions.length>0)displayText=parsed.base}else{catParsed.push(null)}
        h+='<td>'+highlightText(displayText,[],d.id)+(fl?' <span style="font-size:9px;color:'+fl.color+';font-weight:600;font-family:var(--sans)">['+fl.label+']</span>':"")+'</td>'}else{catParsed.push(null);h+='<td style="color:var(--text5);font-style:italic">Not present</td>'}});
      h+='</tr>';
      // IOC exception sub-rows in report
      if(type==="IOC"){
        var allLabels=[];
        catParsed.forEach(function(pe){if(!pe)return;pe.exceptions.forEach(function(ex){var lbl=ex.canonicalLabel||ex.label;if(allLabels.indexOf(lbl)<0)allLabels.push(lbl)})});
        allLabels.forEach(function(lbl){
          h+='<tr class="report-sub-row"><td class="sub-prov-label" style="padding-left:24px;font-size:10px;color:var(--blue);font-weight:500">&nbsp;&nbsp;'+esc(lbl)+'</td>';
          deals.forEach(function(d,idx){
            var pe=catParsed[idx];var match=null;
            if(pe){match=pe.exceptions.find(function(ex){return(ex.canonicalLabel||ex.label)===lbl})}
            h+='<td style="font-size:10.5px;color:var(--text3)">'+(match?highlightText(match.text,[],d.id):'\u2014')+'</td>';
          });
          h+='</tr>';
        });
      }
    });
    h+='</tbody></table>';
  });

  if(state.compareResults)h+='<div style="padding:16px;background:var(--gold-light);border:1px solid var(--gold-border);border-radius:10px;margin:20px 0"><div style="font:600 14px var(--serif);margin-bottom:6px">AI Analysis</div><div style="font-size:13px;color:var(--text2);line-height:1.6">'+esc(state.compareResults.overall_summary||"")+'</div></div>';
  else h+='<div style="padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;margin:20px 0;font-size:12px;color:var(--text3)">Click "Summarize Differences" to add AI analysis to this report.</div>';
  h+='</div>';return h;
}

function exportReportPDF(){
  // Grab the report content and open a print-friendly window
  var content=document.getElementById("content");
  var reportHtml=content.querySelector('[style*="padding:20px 28px"]');
  if(!reportHtml){window.print();return}
  var win=window.open("","_blank");
  win.document.write('<!DOCTYPE html><html><head><title>Precedent Comparison Report</title>');
  win.document.write('<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">');
  win.document.write('<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Source Sans 3",sans-serif;color:#1a1a1a;padding:30px;font-size:11px}');
  win.document.write('table{width:100%;border-collapse:collapse;margin-bottom:20px;table-layout:fixed}th,td{border:1px solid #ddd;padding:8px 10px;text-align:left;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word;max-width:0}');
  win.document.write('th{background:#f5f3ee;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;color:#B8956A;font-weight:600}');
  win.document.write('td{font-family:"Source Serif 4",serif;font-size:10.5px;line-height:1.5}');
  win.document.write('td.sub-prov-label{font-family:"Source Sans 3",sans-serif;font-weight:600;background:#faf8f5;width:150px;word-wrap:break-word;overflow-wrap:break-word}');
  win.document.write('.dollar-pct{color:#1565C0;font-size:8px;font-weight:600;font-family:"Source Sans 3",sans-serif;margin-left:1px}');
  win.document.write('.report-export-btns,.filter-chip,.filter-label,.action-btn{display:none!important}');
  win.document.write('.ann-phrase{text-decoration:none}');
  win.document.write('</style></head><body>');
  win.document.write(reportHtml.innerHTML);
  win.document.write('</body></html>');
  win.document.close();
  setTimeout(function(){win.print()},400);
}

function exportReportWord(){
  var content=document.getElementById("content");
  var reportHtml=content.querySelector('[style*="padding:20px 28px"]');
  if(!reportHtml)return;
  var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
  html+='<head><meta charset="utf-8"><style>';
  html+='body{font-family:Calibri,sans-serif;font-size:10pt;color:#1a1a1a}';
  html+='table{width:100%;border-collapse:collapse;margin-bottom:16pt;table-layout:fixed}';
  html+='th,td{border:1px solid #ccc;padding:5pt 8pt;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word}';
  html+='th{background:#f0eeea;font-size:8pt;text-transform:uppercase;letter-spacing:0.5pt;color:#B8956A;font-weight:bold}';
  html+='td{font-family:Cambria,serif;font-size:9.5pt;line-height:1.4}';
  html+='td.sub-prov-label{font-family:Calibri,sans-serif;font-weight:bold;background:#faf8f5}';
  html+='.dollar-pct{color:#1565C0;font-size:7.5pt;font-weight:bold;font-family:Calibri,sans-serif}';
  html+='.report-export-btns,.filter-chip,.filter-label,.action-btn{display:none}';
  html+='.ann-phrase{text-decoration:none}';
  html+='</style></head><body>';
  html+=reportHtml.innerHTML;
  html+='</body></html>';
  var blob=new Blob([html],{type:"application/msword"});
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");
  a.href=url;a.download="Precedent_Report_"+new Date().toISOString().split("T")[0]+".doc";
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  types.forEach(function(type){getCatsForType(type).forEach(function(cat){var entries=deals.map(function(d){var prov=PROVISIONS.find(function(p){return p.type===type&&p.dealId===d.id&&p.category===cat});return{dealId:d.id,text:prov?prov.text.substring(0,500):"[NOT PRESENT]"}});allProngs.push({category:cat,entries:entries})})});
  state.compareResults={comparisons:[],overall_summary:"Analyzing...",key_takeaway:""};
  // Disable compare button with loading state
  var cmpBtn=document.querySelector('.action-btn.compare');
  if(cmpBtn){cmpBtn.disabled=true;cmpBtn.textContent="Analyzing...";}
  renderContent();
  var ptl=state.provisionType?PROVISION_TYPES.find(function(pt){return pt.key===state.provisionType}).label:"All Provisions";
  var controller=new AbortController();
  var timeout=setTimeout(function(){controller.abort()},55000);
  fetch("/api/compare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provisionType:ptl,prongs:allProngs,deals:deals}),signal:controller.signal}).then(function(resp){return resp.json()}).then(function(data){
    state.compareResults=data;
  }).catch(function(e){
    var msg=e.name==="AbortError"?"Request timed out. Try comparing fewer provisions or deals.":"Error: "+e.message+". Ensure API endpoints are deployed.";
    state.compareResults={overall_summary:msg,comparisons:[],key_takeaway:""};
  }).finally(function(){
    clearTimeout(timeout);
    renderContent();
  });
}

// ═══════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════
function toggleAdmin(){state.adminMode=!state.adminMode;document.getElementById("admin-btn").classList.toggle("active",state.adminMode);renderContent()}

function ingestFullAgreement(dealId){
  var d=getDeal(dealId);if(!d)return;
  var text=prompt("Paste the full merger agreement text for "+dealLabel(d)+":\n\n(This can be very long — paste the entire agreement)");
  if(!text||text.length<500){alert("Agreement text too short. Need the full text.");return}
  var btn=event.target;btn.disabled=true;btn.textContent="Ingesting...";
  fetch("/api/ingest/agreement",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    deal_id:dealId,full_text:text,title:dealLabel(d)+" Merger Agreement",
    provision_types:PROVISION_TYPES.map(function(pt){return pt.key})
  })}).then(function(r){return r.json()}).then(function(data){
    if(data.error){alert("Error: "+data.error);btn.disabled=false;btn.textContent="Ingest Agreement";return}
    var msg="Ingest complete for "+dealLabel(d)+":\\n";
    (data.results||[]).forEach(function(r){
      msg+=r.label+": "+r.created+" provisions created\\n";
    });
    alert(msg);
    // Reload data
    loadFromAPI();
  }).catch(function(e){alert("Failed: "+e.message)}).finally(function(){btn.disabled=false;btn.textContent="Ingest Agreement"});
}

function openAddCategory(type){
  var modal=document.getElementById("add-cat-modal");var body=document.getElementById("add-cat-body");var cats=getCatsForType(type);
  body.innerHTML='<div style="font-size:12px;color:var(--text3);margin-bottom:14px">Adding a new sub-provision category under <strong>'+(PROVISION_TYPES.find(function(pt){return pt.key===type})?.label||type)+'</strong>.</div><div class="recode-field"><label>New Category Name</label><input type="text" id="new-cat-name" placeholder="e.g. Government Contracts"></div><div style="display:flex;gap:8px;margin-top:16px"><button class="save-btn" onclick="saveNewCategory(\''+type+'\')">Add Category</button><button class="action-btn" onclick="document.getElementById(\'add-cat-modal\').style.display=\'none\'">Cancel</button></div><div style="margin-top:16px;font-size:11px;color:var(--text3)"><strong>Current ('+type+'):</strong><br>'+cats.map(function(c,i){return(i+1)+'. '+esc(c)}).join("<br>")+'</div>';
  modal.style.display="flex";setTimeout(function(){document.getElementById("new-cat-name").focus()},100);
}
function saveNewCategory(type){
  var nm=document.getElementById("new-cat-name")?.value?.trim();if(!nm)return;
  if(getCatsForType(type).includes(nm)){alert("Already exists.");return}
  var existing=getCatsForType(type);
  // AI duplicate check
  var btn=document.querySelector('#add-cat-body .save-btn');
  if(btn){btn.disabled=true;btn.textContent="Checking...";}
  fetch("/api/ai/check-duplicate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({newCategory:nm,existingCategories:existing,provisionType:type})}).then(function(r){return r.json()}).then(function(data){
    if(data.is_duplicate&&(data.confidence==="medium"||data.confidence==="high")){
      var msg="This category may overlap with \""+data.similar_to+"\" ("+data.confidence+" confidence).\n\n"+data.explanation+"\n\nAdd anyway?";
      if(!confirm(msg)){if(btn){btn.disabled=false;btn.textContent="Add Category";}return}
    }
    SUB_PROVISIONS[type].push(nm);saveCats();document.getElementById("add-cat-modal").style.display="none";renderContent();
  }).catch(function(e){
    // On API failure, add anyway
    console.warn("Duplicate check failed:",e.message);
    SUB_PROVISIONS[type].push(nm);saveCats();document.getElementById("add-cat-modal").style.display="none";renderContent();
  });
}

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
// INLINE RECODE (context + sliders + category dropdown)
// ═══════════════════════════════════════════════════
function getContextForProv(dealId,type,provText){
  // Build full context from all provisions of this type for this deal
  var allProvs=PROVISIONS.filter(function(p){return p.type===type&&p.dealId===dealId}).map(function(p){return p.text});
  var fullText=allProvs.join(" ");
  if(!provText||!fullText)return{fullText:fullText||"",selStart:0,selEnd:0,viewStart:0,viewEnd:Math.min(fullText.length,2000)};
  var idx=fullText.indexOf(provText);
  if(idx<0)return{fullText:fullText,selStart:0,selEnd:0,viewStart:0,viewEnd:Math.min(fullText.length,2000)};
  // View window: ~100 words before and after selection
  var viewStart=idx,viewEnd=idx+provText.length;
  var wordsBefore=0,wordsAfter=0;
  while(viewStart>0&&wordsBefore<100){viewStart--;if(fullText[viewStart]===" ")wordsBefore++}
  while(viewEnd<fullText.length&&wordsAfter<100){viewEnd++;if(fullText[viewEnd]===" ")wordsAfter++}
  return{fullText:fullText,selStart:idx,selEnd:idx+provText.length,viewStart:viewStart,viewEnd:Math.min(viewEnd,fullText.length)};
}

function computeViewWindow(ctx){
  // Ensure the view window covers the selection plus ~100 words each side
  var ft=ctx.fullText;
  var vStart=ctx.selStart,vEnd=ctx.selEnd;
  var wb=0,wa=0;
  while(vStart>0&&wb<100){vStart--;if(ft[vStart]===" ")wb++}
  while(vEnd<ft.length&&wa<100){vEnd++;if(ft[vEnd]===" ")wa++}
  ctx.viewStart=vStart;ctx.viewEnd=Math.min(vEnd,ft.length);
}

function renderRecodeContext(dealId,ctx){
  var ft=ctx.fullText;
  var before=ft.substring(ctx.viewStart,ctx.selStart);
  var selected=ft.substring(ctx.selStart,ctx.selEnd);
  var after=ft.substring(ctx.selEnd,ctx.viewEnd);
  var h='<div class="recode-context-text" data-deal-id="'+dealId+'">';
  if(ctx.viewStart>0)h+='<span class="recode-ellipsis">&hellip; </span>';
  h+='<span class="recode-ctx">'+esc(before)+'</span>';
  h+='<span class="recode-sel" id="rsel-'+dealId+'">'+esc(selected)+'</span>';
  h+='<span class="recode-ctx">'+esc(after)+'</span>';
  if(ctx.viewEnd<ft.length)h+='<span class="recode-ellipsis"> &hellip;</span>';
  h+='</div>';
  // Range sliders spanning entire fullText, not just view window
  h+='<div class="recode-sliders">';
  h+='<div class="recode-slider-row"><label>Start</label><input type="range" class="recode-range" id="rslide-start-'+dealId+'" min="0" max="'+ctx.selEnd+'" value="'+ctx.selStart+'" oninput="updateRecodeSlider(\''+dealId+'\',\'start\',this.value)"></div>';
  h+='<div class="recode-slider-row"><label>End</label><input type="range" class="recode-range" id="rslide-end-'+dealId+'" min="'+ctx.selStart+'" max="'+ft.length+'" value="'+ctx.selEnd+'" oninput="updateRecodeSlider(\''+dealId+'\',\'end\',this.value)"></div>';
  h+='</div>';
  h+='<div style="display:flex;gap:6px;margin-top:4px"><button class="admin-edit" style="opacity:1;font-size:10px;color:var(--red)" onclick="resetRecodeSelection(\''+dealId+'\')">Reset Selection</button>'+(state.adminMode?'<button class="ann-add-btn" onclick="event.stopPropagation();recodeAnnotation(\''+dealId+'\')" title="Add annotation from selection">+ Ann</button>':'')+'</div>';
  return h;
}

// Store recode state per session
var _recodeCtx={};
function startInlineRecode(btn,cat,type,cols){
  var card=btn.closest(".prong-card");if(!card)return;
  var deals=state.selectedDeals.map(getDeal).filter(Boolean);
  _recodeCtx={type:type,origCat:cat,deals:{},exceptionLabels:{}};

  // Replace header buttons with category dropdown + save/cancel
  var headerRight=btn.parentElement;
  var cats=getCatsForType(type);
  var ddHtml='<select id="recode-cat-dd" class="recode-cat-select">';
  cats.forEach(function(c){ddHtml+='<option value="'+esc(c)+'"'+(c===cat?' selected':'')+'>'+esc(c)+'</option>'});
  ddHtml+='<option value="__add_new__">+ Add new category&hellip;</option></select>';
  headerRight.innerHTML=ddHtml+'<button class="admin-edit" style="color:var(--green);opacity:1" onclick="saveInlineRecode(this)">Save</button><button class="admin-edit" style="opacity:1" onclick="cancelInlineRecode()">Cancel</button>';
  // Handle "Add new" selection
  document.getElementById("recode-cat-dd").addEventListener("change",function(){
    if(this.value==="__add_new__"){
      var newName=prompt("New category name:");
      if(!newName||!newName.trim()){this.value=cat;return}
      newName=newName.trim();
      checkNewCatDuplicate(newName,type,this,cat);
    }
  });

  // Replace each cell's prong-text with context + sliders
  var cells=card.querySelectorAll(".prong-cell");
  cells.forEach(function(cell,idx){
    var d=deals[idx];if(!d)return;
    var prov=PROVISIONS.find(function(p){return p.type===type&&p.dealId===d.id&&p.category===cat});
    var textDiv=cell.querySelector(".prong-text");
    if(!textDiv)return;
    var ctx=getContextForProv(d.id,type,prov?prov.text:"");
    _recodeCtx.deals[d.id]=ctx;
    var wrapper=document.createElement("div");
    wrapper.className="recode-widget";
    wrapper.innerHTML=renderRecodeContext(d.id,ctx);
    textDiv.replaceWith(wrapper);
  });
  // Make exception sub-row labels editable instead of hiding them
  card.querySelectorAll(".prong-sub-label").forEach(function(lbl){
    var origText=lbl.textContent;
    var input=document.createElement("input");
    input.type="text";input.value=origText;
    input.className="recode-cat-select";
    input.style.cssText="width:100%;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--blue);background:#EBF2FB;border:1px solid var(--blue);padding:3px 8px";
    input.setAttribute("data-orig-label",origText);
    _recodeCtx.exceptionLabels[origText]=origText;
    input.addEventListener("change",function(){_recodeCtx.exceptionLabels[origText]=this.value.trim()||origText});
    lbl.innerHTML="";lbl.appendChild(input);
  });
  // Make exception sub-cells editable as textareas
  card.querySelectorAll(".prong-sub-cell").forEach(function(cell){
    var origText=cell.textContent.trim();
    if(origText==="\u2014")return;
    var ta=document.createElement("textarea");
    ta.value=origText;
    ta.style.cssText="width:100%;min-height:60px;padding:6px;border:1px solid var(--border);border-radius:4px;font:400 11px/1.55 var(--serif);color:var(--text3);resize:vertical;background:var(--bg)";
    cell.innerHTML="";cell.appendChild(ta);
  });
}

function checkNewCatDuplicate(newName,type,selectEl,fallbackCat){
  var existing=getCatsForType(type);
  if(existing.includes(newName)){alert("Already exists.");selectEl.value=fallbackCat;return}
  fetch("/api/ai/check-duplicate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({newCategory:newName,existingCategories:existing,provisionType:type})}).then(function(r){return r.json()}).then(function(data){
    if(data.is_duplicate&&(data.confidence==="medium"||data.confidence==="high")){
      if(!confirm("\""+newName+"\" may overlap with \""+data.similar_to+"\" ("+data.confidence+").\n\n"+data.explanation+"\n\nAdd anyway?")){selectEl.value=fallbackCat;return}
    }
    // Add the new option and select it
    var opt=document.createElement("option");opt.value=newName;opt.textContent=newName;
    selectEl.insertBefore(opt,selectEl.querySelector('option[value="__add_new__"]'));
    selectEl.value=newName;
    SUB_PROVISIONS[type].push(newName);saveCats();
  }).catch(function(){
    var opt=document.createElement("option");opt.value=newName;opt.textContent=newName;
    selectEl.insertBefore(opt,selectEl.querySelector('option[value="__add_new__"]'));
    selectEl.value=newName;
    SUB_PROVISIONS[type].push(newName);saveCats();
  });
}

function updateRecodeSlider(dealId,which,val){
  var ctx=_recodeCtx.deals[dealId];if(!ctx)return;
  val=parseInt(val);
  var ft=ctx.fullText;
  // Snap to word boundaries
  if(which==="start"){
    while(val>0&&ft[val]!==" ")val--;
    if(ft[val]===" ")val++;
    ctx.selStart=val;
    var endSlider=document.getElementById("rslide-end-"+dealId);
    if(endSlider)endSlider.min=val;
  }else{
    while(val<ft.length&&ft[val]!==" ")val++;
    ctx.selEnd=val;
    var startSlider=document.getElementById("rslide-start-"+dealId);
    if(startSlider)startSlider.max=val;
  }
  // Recompute dynamic view window around new selection
  computeViewWindow(ctx);
  // Re-render the text display
  var container=document.querySelector('.recode-context-text[data-deal-id="'+dealId+'"]');
  if(!container)return;
  var before=ft.substring(ctx.viewStart,ctx.selStart);
  var selected=ft.substring(ctx.selStart,ctx.selEnd);
  var after=ft.substring(ctx.selEnd,ctx.viewEnd);
  var h="";
  if(ctx.viewStart>0)h+='<span class="recode-ellipsis">&hellip; </span>';
  h+='<span class="recode-ctx">'+esc(before)+'</span>';
  h+='<span class="recode-sel" id="rsel-'+dealId+'">'+esc(selected)+'</span>';
  h+='<span class="recode-ctx">'+esc(after)+'</span>';
  if(ctx.viewEnd<ft.length)h+='<span class="recode-ellipsis"> &hellip;</span>';
  container.innerHTML=h;
}

function resetRecodeSelection(dealId){
  var ctx=_recodeCtx.deals[dealId];if(!ctx)return;
  // Clear selection to nothing, show full text in view
  ctx.selStart=0;ctx.selEnd=0;
  ctx.viewStart=0;ctx.viewEnd=Math.min(ctx.fullText.length,3000);
  // Re-render context and sliders
  var widget=document.querySelector('.recode-context-text[data-deal-id="'+dealId+'"]');
  if(widget){
    var parent=widget.parentElement;
    parent.innerHTML=renderRecodeContext(dealId,ctx);
  }
}

function recodeAnnotation(dealId){
  var ctx=_recodeCtx.deals[dealId];if(!ctx)return;
  var selected=ctx.fullText.substring(ctx.selStart,ctx.selEnd).trim();
  if(!selected||selected.length<3){alert("Select some text first using the sliders.");return}
  // Find the provision for this deal
  var prov=PROVISIONS.find(function(p){return p.type===_recodeCtx.type&&p.dealId===dealId&&p.category===_recodeCtx.origCat});
  if(!prov){alert("No provision found for annotation.");return}
  var startIdx=prov.text.indexOf(selected);
  if(startIdx<0){alert("Selected text not found in provision. Try a shorter selection.");return}
  // Open annotation popover
  var btn=document.querySelector('.recode-context-text[data-deal-id="'+dealId+'"]');
  var evt={target:btn,stopPropagation:function(){}};
  openNewAnnotationPopover(prov.id,selected,startIdx,startIdx+selected.length,evt);
}

function saveInlineRecode(btn){
  var card=btn.closest(".prong-card");if(!card)return;
  var newCat=document.getElementById("recode-cat-dd")?.value||_recodeCtx.origCat;
  if(newCat==="__add_new__")newCat=_recodeCtx.origCat;
  var type=_recodeCtx.type;
  var origCat=_recodeCtx.origCat;
  var deals=state.selectedDeals.map(getDeal).filter(Boolean);
  deals.forEach(function(d){
    var ctx=_recodeCtx.deals[d.id];if(!ctx)return;
    var nt=ctx.fullText.substring(ctx.selStart,ctx.selEnd).trim();
    if(!nt)return;
    var ex=PROVISIONS.findIndex(function(p){return p.type===type&&p.dealId===d.id&&p.category===origCat});
    if(ex>=0){PROVISIONS[ex].category=newCat;PROVISIONS[ex].text=nt;PROVISIONS[ex].isGold=true}
    else{PROVISIONS.push({id:"p_"+Date.now()+"_"+d.id,dealId:d.id,type:type,category:newCat,text:nt,isGold:true,favorability:"unrated"})}
    goldStandards.push({dealId:d.id,type:type,category:newCat,text:nt,correctedAt:new Date().toISOString()});
  });
  if(type==="IOC"){
    deals.forEach(function(d){
      var prov=PROVISIONS.find(function(p){return p.type===type&&p.dealId===d.id&&(p.category===origCat||p.category===newCat)});
      if(prov)delete IOC_PARSED_CACHE[prov.id];
    });
  }
  _recodeCtx={};
  saveGold();state.compareResults=null;renderContent();
}
function cancelInlineRecode(){_recodeCtx={};renderContent()}

// ═══════════════════════════════════════════════════
// ANNOTATION CREATION (admin)
// ═══════════════════════════════════════════════════
function enableAnnotationCreation(){
  if(!state.adminMode)return;
  document.querySelectorAll(".prong-text").forEach(function(el){
    el.addEventListener("mouseup",function(evt){
      var sel=window.getSelection();
      if(!sel.rangeCount||sel.isCollapsed)return;
      var selectedText=sel.toString().trim();
      if(!selectedText||selectedText.length<3)return;
      var cell=el.closest(".prong-cell");
      if(!cell)return;
      var provId=cell.getAttribute("data-prov-id");
      if(!provId)return;
      // Find the provision text to calculate offsets
      var prov=PROVISIONS.find(function(p){return p.id===provId});
      if(!prov)return;
      var startIdx=prov.text.indexOf(selectedText);
      if(startIdx<0)return;
      openNewAnnotationPopover(provId,selectedText,startIdx,startIdx+selectedText.length,evt);
    });
  });
}
function openNewAnnotationPopover(provId,phrase,startOffset,endOffset,evt){
  var pop=document.getElementById("ann-popover");
  var h='<div class="ann-phrase-quote">'+esc(phrase)+'</div>';
  h+='<div class="ann-edit-form" style="border-top:none;padding-top:0;margin-top:0">';
  h+='<label>Favorability</label><select id="new-ann-fav">';
  FAV_LEVELS.forEach(function(f){h+='<option value="'+f.key+'">'+f.label+'</option>'});
  h+='</select>';
  h+='<label>Note</label><textarea id="new-ann-note" placeholder="Add annotation note..."></textarea>';
  h+='<button class="ann-save-btn" onclick="createAnnotation(\''+provId+'\',\''+esc(phrase).replace(/'/g,"\\'")+'\','+startOffset+','+endOffset+')">Create Annotation</button>';
  h+='</div>';
  pop.innerHTML=h;
  var rect=evt.target.getBoundingClientRect();
  var top=rect.bottom+6;var left=rect.left;
  if(left+320>window.innerWidth)left=window.innerWidth-330;
  if(top+300>window.innerHeight)top=rect.top-310;
  pop.style.top=Math.max(0,top)+"px";pop.style.left=Math.max(0,left)+"px";pop.style.display="block";
  setTimeout(function(){var dismiss=function(e){if(!pop.contains(e.target)){pop.style.display="none";document.removeEventListener("click",dismiss)}};document.addEventListener("click",dismiss)},10);
}
function promptAnnotation(provId,btn){
  var prov=PROVISIONS.find(function(p){return p.id===provId});if(!prov)return;
  var pop=document.getElementById("ann-popover");
  var h='<div style="font:600 12px var(--sans);margin-bottom:8px">New Annotation</div>';
  h+='<div class="ann-edit-form" style="border-top:none;padding-top:0;margin-top:0">';
  h+='<label>Phrase (select text or type)</label><input type="text" id="new-ann-phrase" placeholder="Enter or paste phrase from provision..." style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:11px;font-family:var(--serif);background:var(--bg);outline:none;margin-bottom:4px">';
  h+='<label>Favorability</label><select id="new-ann-fav">';
  FAV_LEVELS.forEach(function(f){h+='<option value="'+f.key+'">'+f.label+'</option>'});
  h+='</select>';
  h+='<label>Note</label><textarea id="new-ann-note" placeholder="Add annotation note..."></textarea>';
  h+='<button class="ann-save-btn" onclick="submitAnnotationFromBtn(\''+provId+'\')">Create</button>';
  h+='</div>';
  pop.innerHTML=h;
  var rect=btn.getBoundingClientRect();
  pop.style.top=(rect.bottom+6)+"px";pop.style.left=Math.min(rect.left,window.innerWidth-330)+"px";pop.style.display="block";
  setTimeout(function(){document.getElementById("new-ann-phrase").focus();var dismiss=function(e){if(!pop.contains(e.target)&&e.target!==btn){pop.style.display="none";document.removeEventListener("click",dismiss)}};document.addEventListener("click",dismiss)},10);
}
function submitAnnotationFromBtn(provId){
  var phrase=document.getElementById("new-ann-phrase").value.trim();if(!phrase)return;
  var prov=PROVISIONS.find(function(p){return p.id===provId});if(!prov)return;
  var startIdx=prov.text.indexOf(phrase);
  if(startIdx<0){alert("Phrase not found in provision text. Copy it exactly.");return}
  createAnnotation(provId,phrase,startIdx,startIdx+phrase.length);
}
function createAnnotation(provId,phrase,startOffset,endOffset){
  var fav=document.getElementById("new-ann-fav").value;
  var note=document.getElementById("new-ann-note").value.trim();
  var payload={provision_id:provId,phrase:phrase,start_offset:startOffset,end_offset:endOffset,favorability:fav,note:note,is_ai_generated:false};
  fetch("/api/annotations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}).then(function(r){return r.json()}).then(function(data){
    if(data.annotation){
      if(!ANNOTATIONS_CACHE[provId])ANNOTATIONS_CACHE[provId]=[];
      ANNOTATIONS_CACHE[provId].push(data.annotation);
    }
    document.getElementById("ann-popover").style.display="none";
    renderContent();
  }).catch(function(e){
    // Fallback: store locally
    var localAnn={id:"local_"+Date.now(),provision_id:provId,phrase:phrase,start_offset:startOffset,end_offset:endOffset,favorability:fav,note:note,is_ai_generated:false,created_at:new Date().toISOString()};
    if(!ANNOTATIONS_CACHE[provId])ANNOTATIONS_CACHE[provId]=[];
    ANNOTATIONS_CACHE[provId].push(localAnn);
    document.getElementById("ann-popover").style.display="none";
    renderContent();
  });
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

// INIT — render fallback immediately, then try API
renderSidebar();renderContent();
loadFromAPI();
