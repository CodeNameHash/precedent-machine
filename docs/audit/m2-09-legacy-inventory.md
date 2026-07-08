# M2-09 Legacy JSX Inventory — 2026-07-08T16:55:08.552Z

AST-derived inventory for WP-M2-09 Step 1a. Scope: inline review-page table functions plus `components/review/*Table*` modules.

Components audited: 20.

Named legacy components not present as live JSX functions on current main:

- NosolFourTables
- EmployeeBenefitsTable
- SecMeetingTable
- NoOtherRepsFraudTable
- ConsiderationTables

## ProvisionCardTable

Source: `components/review/ProvisionCardTable.jsx:93-119`

### JSX Elements
- L97, L101, L110: div {"data-testid":"provision-card-table","className":"space-y-6"}
- L99, L108: section {"data-testid":"definition-card-tab","className":"space-y-3"}
- L100, L109: h2 {"className":"font-display text-lg text-ink"}
- L102, L112: ProvisionCard {"key":"`def-${card.provision_instance_id}`"}

### Derived Values / Rollups
- None found.

### Hover / Click Handlers
- None found.

### Conditional Branches / Empty States
- L94: Array.isArray(reviewDeal?.sections)
- L95: Array.isArray(reviewDeal?.definitions)
- L98: definitions.length

### Helper Dependencies
- L102: definitions.map
- L107: sections.map

## ProvisionSubRowTable

Source: `components/review/ProvisionSubRowTable.jsx:1-64`

### JSX Elements
- L12, L45: tr {"key":"row.id","data-testid":"row.testId","className":"`align-top ${row.warning ? 'bg-amber-50' : ''}`"}
- L17, L34: td {"data-testid":"isSubrow ? undefined : 'col-term'","className":"`px-3 py-2 whitespace-normal break-words ${isSubrow ? 'pl-8 text-inkMid provision-subrow-term' : 'text-ink font-medium'}`"}
- L23, L24, L25, L29, L36: span {"className":"inline-flex items-start gap-1"}
- L43: table {"data-testid":"testId","className":"min-w-full text-xs font-ui provision-subrow-table"}
- L44: thead {"className":"bg-bg/60 border-b border-border"}
- L46, L49: th {"className":"px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap"}
- L54: tbody {"className":"divide-y divide-border"}

### Derived Values / Rollups
- L9: visibleRows = (rows || []).filter((row) => row && row.renderIf !== false)
- L11: renderRow = (row, isSubrow = false, isLast = false) => ( <tr key={row.id} data-testid={row.testId} className={`align-top ${row.warning ? 'bg-amber-50' : ''}`} > <td data-testid={isSubrow ? und
- L57: subrows = (row.subrows || []).filter((sub) => sub && sub.renderIf !== false)

### Hover / Click Handlers
- None found.

### Conditional Branches / Empty States
- L9: row
- L15: row.warning
- L18: isSubrow
- L19: isSubrow
- L22: isSubrow
- L24: isLast
- L28: row.party
- L35: row.provision === null || row.provision === undefined
- L36: row.subrows
- L36: row.subrows && row.subrows.length
- L57: sub

### Helper Dependencies
- L55: visibleRows.flatMap
- L56, L58: renderRow
- L58: out.push
- L58: subrows.forEach

## ProvisionTable

Source: `components/review/ProvisionTable.jsx:12-55`

### JSX Elements
- L19: section {"data-testid":"`provision-table-${config.id}`","className":"rounded border border-border bg-white shadow-sm"}
- L20, L25: div {"className":"border-b border-border bg-bg/60 px-3 py-2"}
- L21: p {"className":"font-ui text-[10px] font-medium uppercase tracking-wider text-inkFaint"}
- L26: table {"className":"min-w-full text-xs font-ui"}
- L27: thead {"className":"border-b border-border bg-bg/60"}
- L28, L42: tr
- L30: th {"key":"column.id","className":"px-3 py-2 text-left font-medium uppercase tracking-wider text-inkFaint"}
- L40: tbody {"className":"divide-y divide-border"}
- L44: td {"key":"`${row.id || row.label}-${column.id}`","className":"px-3 py-2 whitespace-pre-wrap break-words text-ink"}

### Derived Values / Rollups
- L14: rows = config.selectRows(reviewDeal)

### Hover / Click Handlers
- None found.

### Conditional Branches / Empty States
- L13: !config || typeof config.selectRows !== 'function'
- L15: !Array.isArray(rows) || rows.length === 0
- L16: Array.isArray(config.columns)
- L33: column.width
- L42: row.present
- L45: column.renderCell

### Helper Dependencies
- L14: config.selectRows
- L29, L43: columns.map
- L41: rows.map
- L45: column.renderCell

## BringDownTiersTable

Source: `pages/review/[id].js:754-799`

### JSX Elements
- L757, L784: div {"className":"mt-1 overflow-x-auto"}
- L758: table {"className":"min-w-full text-[11px] font-ui border border-border rounded"}
- L759: thead {"className":"bg-bg/60"}
- L760, L779: tr
- L761, L764, L767: th {"className":"px-2 py-1 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap"}
- L772: tbody {"className":"divide-y divide-border"}
- L780, L783, L789: td {"className":"px-2 py-1 text-ink whitespace-pre-wrap break-words"}
- L781, L786, L790: span {"className":"text-inkFaint/70 italic"}
- L785: CodeBadge

### Derived Values / Rollups
- None found.

### Hover / Click Handlers
- None found.

### Conditional Branches / Empty States
- L755: !Array.isArray(tiers) || tiers.length === 0
- L785: stdCode
- L786: stdCode

### Helper Dependencies
- L773: tiers.map

## CompensationItemsTable

Source: `pages/review/[id].js:808-859`

### JSX Elements
- L811, L836, L842: div {"className":"mt-1 overflow-x-auto"}
- L812: table {"className":"min-w-full text-[11px] font-ui border border-border rounded"}
- L813: thead {"className":"bg-bg/60"}
- L814, L834: tr
- L815, L818, L821: th {"className":"px-2 py-1 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap"}
- L826: tbody {"className":"divide-y divide-border"}
- L835, L841, L847: td {"className":"px-2 py-1 text-ink whitespace-nowrap"}
- L837, L843: CodeBadge
- L838, L844, L849, L850: span

### Derived Values / Rollups
- None found.

### Hover / Click Handlers
- None found.

### Conditional Branches / Empty States
- L809: !Array.isArray(items) || items.length === 0
- L837: itemCode
- L838: itemCode
- L843: stdCode
- L844: stdCode
- L848: txt

### Helper Dependencies
- L827: items.map

## IocAffirmativeCovenantsTableSingle

Source: `pages/review/[id].js:1822-2170`

### JSX Elements
- L1833, L1834, L1839, L2079, L2107, L2108, L2113: div {"className":"bg-white border border-border rounded-lg shadow-sm overflow-hidden"}
- L1835, L2109: p {"className":"text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider"}
- L2028, L2030, L2033, L2077, L2149: span {"className":"text-inkFaint/70 italic"}
- L2032, L2076, L2148: HoverSource {"key":"code"}
- L2073: ol {"className":"mt-2 space-y-1 border-l border-border pl-3 text-[11px] font-normal text-inkMid"}
- L2075: li {"key":"`${idx}-${limbText(child).slice(0, 24)}`","className":"space-y-1"}
- L2114: table {"className":"min-w-full text-xs font-ui"}
- L2115: thead {"className":"bg-bg/60 border-b border-border"}
- L2116, L2145: tr
- L2117, L2129, L2130: th {"className":"`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`"}
- L2133: tbody {"className":"divide-y divide-border"}
- L2146, L2156, L2159: td {"className":"`px-3 py-2 text-ink font-medium whitespace-normal break-words ${REVIEW_LABEL_COL_W}`"}
- L2147: TermCell

### Derived Values / Rollups
- L1823: matches = useMemo( () => findIocAffirmativeMatches(iocProvisions), [iocProvisions], )
- L1823: useMemo( () => findIocAffirmativeMatches(iocProvisions), [iocProvisions], )
- L1905: scopeCodesFromValue = (val) => { if (val == null || val === '') return []; const inner = isCitableValue(val) ? getCitableValue(val) : val; if (inner == null || inner === '') return []; if (Array.isArray
- L1940: matchingLimb = (features, bucket) => { const limbs = positiveObligationLimbsForDisplay(features); if (limbs.length === 0 || !bucket || !bucket.limbRe) return null; for (const limb of limbs) { if 
- L1954: standardCodesFor = (provision, bucket) => { const f = getStructuredFeatures(provision) || {}; const out = []; const seen = new Set(); const push = (code) => { if (code && !seen.has(code)) { seen.add(
- L1960, L1998: limb = matchingLimb(f, bucket)
- L1990: scopeCodesFor = (provision, bucket) => { const f = getStructuredFeatures(provision) || {}; const out = []; const seen = new Set(); const push = (code) => { if (code && !seen.has(code)) { seen.add(
- L2027: renderCodePills = (codes, dict, quote) => { if (!codes || codes.length === 0) return <span className="text-inkFaint/70 italic">—</span>; return ( <span className="inline-flex flex-wrap gap-1"> {code
- L2069: renderIncludedObligations = (limb, rowQuote) => { const children = Array.isArray(limb?.includedObligations) ? limb.includedObligations : []; if (children.length === 0) return null; return ( <ol className="mt-
- L2089: rows = matches.flatMap(({ bucket, provision, limbs }) => { if (!bucket.synthetic) return [{ key: bucket.code, bucket, provision, limb: null }]; const rowLimbs = Array.isArray(limbs) ? lim
- L2135: synthetic = !!bucket.synthetic
- L2139: stdCodes = synthetic && limb ? standardCodesForLimb(limb, rowQuote) : standardCodesFor(provision, bucket)
- L2140: scopeCodes = synthetic && limb ? scopeCodesForLimb(limb) : scopeCodesFor(provision, bucket)
- L2141: label = synthetic ? (limbText(limb) || fallbackText || 'Affirmative chapeau') : bucket.name

### Hover / Click Handlers
- None found.

### Conditional Branches / Empty States
- L1827: matches.length === 0
- L1831: !partyLabel
- L1851: !raw || typeof raw !== 'string'
- L1853: !s
- L1857: fromDict
- L1861: /^[A-Z][A-Z0-9_-]+$/.test(s)
- L1875: val == null || val === ''
- L1876: isCitableValue(val)
- L1877: inner == null || inner === ''
- L1878: isTaggedItem(inner)
- L1880: IOC_AFFIRMATIVE_STANDARDS[c]
- L1883: phrase
- L1886: typeof inner === 'string'
- L1888: !t
- L1891: IOC_AFFIRMATIVE_STANDARDS[upper]
- L1896: re.test(t)
- L1906: val == null || val === ''
- L1907: isCitableValue(val)
- L1908: inner == null || inner === ''
- L1909: Array.isArray(inner)
- L1910: isTaggedItem(inner)
- L1912: IOC_AFFIRMATIVE_SCOPE_CODES[c]
- L1914: phrase
- L1916: typeof inner === 'string'
- L1918: !t
- L1920: IOC_AFFIRMATIVE_SCOPE_CODES[upper]
- L1927: re.test(t)
- L1942: limbs.length === 0 || !bucket || !bucket.limbRe
- L1944: !limb || typeof limb !== 'object'
- L1946: phrase
- L1946: phrase && bucket.limbRe.test(phrase)
- L1958: code
- L1958: code && !seen.has(code)
- L1961: limb
- L1972: out.length === 0
- L1975: !l || typeof l !== 'object'
- L1981: out.length === 0
- L1994: code
- L1994: code && !seen.has(code)
- L1999: limb
- L2013: out.length === 0
- L2013: out.length === 0 && typeof provision.full_text === 'string'
- L2020: out.length === 0
- L2028: !codes || codes.length === 0
- L2045: code
- L2045: code && !seen.has(code)
- L2046: limb
- L2046: limb && typeof limb === 'object'
- L2052: out.length === 0
- L2052: out.length === 0 && fallbackText
- L2053: out.length === 0
- L2060: code
- L2060: code && !seen.has(code)
- L2061: limb
- L2061: limb && typeof limb === 'object'
- L2070: Array.isArray(limb?.includedObligations)
- L2071: children.length === 0
- L2090: !bucket.synthetic
- L2091: Array.isArray(limbs)
- L2092: rowLimbs.length === 0
- L2103: partyLabel
- L2136: typeof provision?.full_text === 'string'
- L2136: typeof provision?.full_text === 'string' && provision.full_text.trim()
- L2139: synthetic
- L2139: synthetic && limb
- L2140: synthetic
- L2140: synthetic && limb
- L2141: synthetic
- L2154: synthetic

### Helper Dependencies
- L1823: useMemo
- L1824: findIocAffirmativeMatches
- L1852: raw.trim
- L1855: taxonomyForFeatureKey
- L1856: labelForCode
- L1862: s.replace
- L1865: c.toUpperCase
- L1876, L1907: getCitableValue
- L1876, L1907: isCitableValue
- L1878, L1910: isTaggedItem
- L1883, L1962, L1963, L1964, L1965, L1970, L1971, L1976, L1977, L2047, L2048, L2049, L2050, L2052: standardCodeFromValue
- L1887, L1917: inner.trim
- L1890, L1919: t.toUpperCase
- L1896, L1927: re.test
- L1909: inner.flatMap
- L1914, L2000, L2001, L2002, L2004, L2014, L2062, L2063, L2064: scopeCodesFromValue
- L1927: hits.push
- L1941, L1973, L2091: positiveObligationLimbsForDisplay
- L1946: bucket.limbRe.test
- L1955, L1991, L2091: getStructuredFeatures
- L1958, L1981, L1994, L2045, L2053, L2060: out.push
- L1958, L1994, L2045, L2060: seen.add
- L1958, L1994, L2045, L2060: seen.has
- L1960, L1998: matchingLimb
- L2031: codes.map
- L2074: children.map
- L2075, L2077, L2142: limbText
- L2080, L2081, L2157, L2160: renderCodePills
- L2080, L2139: standardCodesForLimb
- L2081, L2140: scopeCodesForLimb
- L2089: matches.flatMap
- L2095: rowLimbs.map
- L2134: rows.map
- L2136: provision.full_text.trim
- L2139: standardCodesFor
- L2140: scopeCodesFor
- L2154: renderIncludedObligations

## IocAffirmativeCovenantsTable

Source: `pages/review/[id].js:2255-2269`

### JSX Elements
- L2258: div {"className":"space-y-3"}
- L2260: IocAffirmativeCovenantsTableSingle {"key":"group.role","onSelectProvision":"onSelectProvision"}

### Derived Values / Rollups
- L2256: groups = groupIocProvisionsByPartyRole(iocProvisions, side)

### Hover / Click Handlers
- L2260: IocAffirmativeCovenantsTableSingle onSelectProvision -> onSelectProvision

### Conditional Branches / Empty States
- None found.

### Helper Dependencies
- L2256: groupIocProvisionsByPartyRole
- L2259: groups.map

## IocGeneralExceptionsTableSingle

Source: `pages/review/[id].js:2285-2590`

### JSX Elements
- L2472, L2473, L2478, L2488, L2489, L2500, L2536, L2537, L2542, L2550, L2551, L2557, L2563: div {"className":"bg-white border border-border rounded-lg shadow-sm overflow-hidden"}
- L2474, L2490, L2501, L2538, L2552: p {"className":"text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider"}
- L2494: IocExceptionsMiniRows {"onSelectProvision":"onSelectProvision"}
- L2558: span {"className":"italic"}
- L2564, L2571, L2579: IocExceptionsGroup {"onSelectProvision":"onSelectProvision"}

### Derived Values / Rollups
- L2293: useMemo(() => { let neg = null; let pos = null; for (const p of iocProvisions || []) { const meta = getAiMetadata(p) || {}; const code = String(meta.code || p.code || ''); if (!neg
- L2355: positiveList = useMemo(() => { const raw = []; // Item 1 fix: collapsing/deduping now runs ONCE at the end via the pure // dedupeIocExceptionEntries (table-logic.js) — collect every raw entry // 
- L2355: useMemo(() => { const raw = []; // Item 1 fix: collapsing/deduping now runs ONCE at the end via the pure // dedupeIocExceptionEntries (table-logic.js) — collect every raw entry // 
- L2387: sourceRows = (iocProvisions || []) .filter((p) => p !== negativeProv) .map((p) => { const f = getStructuredFeatures(p) || {}; return { isNegativePreamble: false, isPositivePreamble: p === posit
- L2446: negativeList = useMemo(() => { if (!negativeProv) return []; const seen = new Set(); const out = []; for (const entry of extractList(negativeProv, 'negativePreambleExceptions')) { if (seen.has(en
- L2446: useMemo(() => { if (!negativeProv) return []; const seen = new Set(); const out = []; for (const entry of extractList(negativeProv, 'negativePreambleExceptions')) { if (seen.has(en
- L2486: overflowCount = Math.max(0, positiveList.length - visibleRows.length)
- L2513: posByCode = new Map(positiveList.map((r) => [r.code, r]))
- L2514: negByCode = new Map(negativeList.map((r) => [r.code, r]))

### Hover / Click Handlers
- L2494, L2564, L2571, L2579: IocExceptionsMiniRows onSelectProvision -> onSelectProvision

### Conditional Branches / Empty States
- L2299: !neg
- L2299: !neg && code === 'IOC-NEGATIVE-PREAMBLE'
- L2300: !pos
- L2300: !pos && code === 'IOC-POSITIVE-PREAMBLE'
- L2302: !pos
- L2305: p === neg
- L2306: isPreambleProvision(p)
- L2316: !prov
- L2318: Array.isArray(f[featureKey])
- L2321: isTaggedItem(item)
- L2329: typeof item === 'string'
- L2329: typeof item === 'string' && item.trim()
- L2395: Array.isArray(f.permittedExceptions)
- L2396: Array.isArray(f.generalExceptions)
- L2402: isTaggedItem(item)
- L2410: typeof item === 'string'
- L2410: typeof item === 'string' && item.trim()
- L2426: generalExceptionsProv
- L2426: generalExceptionsProv && !skipTextFallback
- L2428: text
- L2431: !label
- L2447: !negativeProv
- L2451: seen.has(entry.code)
- L2459: partyLabel
- L2468: !hasNegativeSide
- L2469: positiveList.length === 0
- L2470: !partyLabel
- L2499: overflowCount > 0
- L2519: negByCode.has(r.code)
- L2527: !posByCode.has(r.code)
- L2531: both.length === 0 && posOnly.length === 0
- L2533: allEmpty
- L2534: !partyLabel
- L2556: hasAsymmetry

### Helper Dependencies
- L2286: useShowEvidence
- L2293, L2355, L2446: useMemo
- L2297: getAiMetadata
- L2306: isPreambleProvision
- L2317, L2390: getStructuredFeatures
- L2321, L2402: isTaggedItem
- L2322, L2403: resolveTaggedLabel
- L2323, L2331, L2453: out.push
- L2329, L2330, L2410, L2411: item.trim
- L2332, L2413, L2433: label.toLowerCase
- L2362: raw.push
- L2394: isIocGeneralExceptions
- L2400: selectIocGeneralExceptionsItems
- L2428: splitGeneralExceptionsItems
- L2441: dedupeIocExceptionEntries
- L2450: extractList
- L2451: seen.has
- L2452: seen.add
- L2485: positiveList.slice
- L2513: positiveList.map
- L2514: negativeList.map
- L2519: negByCode.has
- L2521: both.push
- L2523: posOnly.push
- L2527: negOnly.push
- L2527: posByCode.has

## IocGeneralExceptionsTable

Source: `pages/review/[id].js:2652-2680`

### JSX Elements
- L2661: div {"className":"space-y-3"}
- L2663, L2671: IocGeneralExceptionsTableSingle {"onSelectProvision":"onSelectProvision"}

### Derived Values / Rollups
- L2653: targetProvs = (iocProvisions || []).filter((p) => p.type !== 'IOC-B')
- L2654: buyerProvs = (iocProvisions || []).filter((p) => p.type === 'IOC-B')

### Hover / Click Handlers
- L2663, L2671: IocGeneralExceptionsTableSingle onSelectProvision -> onSelectProvision

### Conditional Branches / Empty States
- L2657: generalExceptionsProv
- L2662: showTarget
- L2665: gxIsBuyer
- L2670: showBuyer
- L2673: gxIsBuyer

### Helper Dependencies
- None found.

## IocNegativeCovenantsTableSingle

Source: `pages/review/[id].js:2687-2982`

### JSX Elements
- L2706, L2707, L2712, L2899, L2900, L2905: div {"className":"bg-white border border-border rounded-lg shadow-sm overflow-hidden"}
- L2708, L2901: p {"className":"text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider"}
- L2906: table {"className":"min-w-full text-xs font-ui"}
- L2907: thead {"className":"bg-bg/60 border-b border-border"}
- L2908, L2931: tr
- L2909, L2910, L2911, L2912: th {"className":"`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`"}
- L2915: tbody {"className":"divide-y divide-border"}
- L2932, L2941, L2952, L2963: td {"className":"px-3 py-2 text-ink font-medium"}
- L2933: TermCell
- L2934: HoverSource
- L2935, L2943, L2949, L2955, L2961, L2965, L2971: span {"className":"text-left text-accent hover:underline font-medium"}
- L2945, L2957, L2967: Pill {"key":"code"}

### Derived Values / Rollups
- L2689: negative = (iocProvisions || []).filter((p) => { if (isHeadingOnlyIocRow(p)) return false; if (isPreambleProvision(p)) return false; if (isIocPositivePreambleProvision(p)) return false; if (i
- L2724: codeOrderIdx = new Map(codeOrder.map((c, i) => [c, i]))
- L2725: resolveIocCode = (p) => { const feats = getStructuredFeatures(p) || {}; const canonical = String(p.category_canonical || feats.categoryCanonical || feats.category_canonical || '').toUpperCase(); if
- L2729: dt = Array.isArray(feats.dollarThresholdsByCategory) ? feats.dollarThresholdsByCategory : null
- L2731: c = String((dt[0] && (dt[0].code || dt[0].bucket)) || '').toUpperCase()
- L2751: canonicalSorted = [...negative].sort((a, b) => { const aCode = resolveIocCode(a); const bCode = resolveIocCode(b); const aIdx = aCode ? codeOrderIdx.get(aCode) : Infinity; const bIdx = bCode ? codeO
- L2771: displayLabelByKey = buildIocRowDisplayLabels(sorted.map((p) => { const code = resolveIocCode(p); return { key: p.id, canonicalLabel: code && IOC_CATEGORY_META[code] && IOC_CATEGORY_META[code].label, f
- L2786: thresholdFor = (p) => { const f = getStructuredFeatures(p) || {}; const bits = []; // Audit block 6e: CapEx/Settlement threshold cells could show a verbose // descriptive sentence AND a separate 
- L2798: pushBit = (bitText) => { if (!bitText) return; const m = bitText.match(AMOUNT_RE); let compact = (m && bitText.trim().length > m[0].length + 20) ? m[0] : bitText; const ampKey = m ? m[0].rep
- L2818, L2865: push = (label, val) => { if (val === null || val === undefined || val === '' || val === false) return; if (Array.isArray(val) && val.length === 0) return; const u = isCitableValue(val) ? 
- L2825: t = u.map((x) => isTaggedItem(x) ? (x.label || x.code) : String(x)).filter(Boolean).join(', ')
- L2830: text = (!label || /(?:cap|threshold)/i.test(label)) ? (formatIocThresholdAmount(u, false) || String(u)) : String(u)
- L2846: ind = formatIocThresholdAmount(item.thresholdIndividual, true)
- L2847: agg = formatIocThresholdAmount(item.thresholdAggregate, true)
- L2861: exceptionPillsFor = (p) => { const f = getStructuredFeatures(p) || {}; const codes = []; const seen = new Set(); const push = (code) => { if (!code) return; const norm = String(code).toUpperCase().rep
- L2920: thrText = thresholdFor(p)

### Hover / Click Handlers
- None found.

### Conditional Branches / Empty States
- L2690: isHeadingOnlyIocRow(p)
- L2691: isPreambleProvision(p)
- L2692: isIocPositivePreambleProvision(p)
- L2693: isIocAffirmative(p)
- L2694: isIocGeneralExceptions(p)
- L2697: affCodes.has(code)
- L2700: partyLabel
- L2703: negative.length === 0
- L2704: !partyLabel
- L2728: canonical
- L2728: canonical && codeOrderIdx.has(canonical)
- L2729: Array.isArray(feats.dollarThresholdsByCategory)
- L2730: dt
- L2730: dt && dt.length > 0
- L2731: dt[0]
- L2732: c
- L2732: c && codeOrderIdx.has(c)
- L2735: cat
- L2739: re.test(cat)
- L2754: aCode
- L2755: bCode
- L2756: aIdx !== bIdx
- L2775: code && IOC_CATEGORY_META[code]
- L2799: !bitText
- L2801: m
- L2801: m && bitText.trim().length > m[0].length + 20
- L2802: m
- L2803: ampKey
- L2804: seenAmounts.has(ampKey)
- L2811: compact.trim() === m[0].trim()
- L2813: pct
- L2819: val === null || val === undefined || val === '' || val === false
- L2820: Array.isArray(val)
- L2820: Array.isArray(val) && val.length === 0
- L2821: isCitableValue(val)
- L2822: u === null || u === undefined || u === '' || u === false
- L2823: typeof u === 'boolean'
- L2824: Array.isArray(u)
- L2825: isTaggedItem(x)
- L2826: label
- L2826: t
- L2829: isTaggedItem(u)
- L2829: label
- L2830: !label || /(?:cap|threshold)/i.test(label)
- L2833: label
- L2843: Array.isArray(f.permittedExceptions)
- L2845: !item || typeof item !== 'object'
- L2848: ind || agg
- L2850: ind
- L2851: agg
- L2855: bits.length
- L2866: !code
- L2868: seen.has(norm)
- L2871: COMMON_EXCEPTION_CODES[norm]
- L2877: re.test(String(code))
- L2881: !seen.has('OTHER_SPECIFIC')
- L2884: !item
- L2885: isTaggedItem(item)
- L2886: typeof item === 'string'
- L2887: typeof item === 'object'
- L2887: typeof item === 'object' && (item.label || item.text)
- L2889: Array.isArray(f.permittedExceptions)
- L2891: f.consentStandard
- L2892: f.requiredByLawCarveout
- L2893: f.pandemicCarveout
- L2894: f.ordinaryCourseCarveout
- L2917: typeof p?.full_text === 'string'
- L2917: typeof p?.full_text === 'string' && p.full_text.trim()
- L2927: Array.isArray((getStructuredFeatures(p) || {}).restrictionComponents)
- L2942: componentCodes.length > 0
- L2945: IOC_CATEGORY_META[code]
- L2953: thrText
- L2964: excCodes.length > 0

### Helper Dependencies
- L2690: isHeadingOnlyIocRow
- L2691: isPreambleProvision
- L2692: isIocPositivePreambleProvision
- L2693: isIocAffirmative
- L2694: isIocGeneralExceptions
- L2695: getAiMetadata
- L2697: affCodes.has
- L2724: codeOrder.map
- L2726, L2750, L2777, L2787, L2862, L2927, L2928: getStructuredFeatures
- L2728, L2732: codeOrderIdx.has
- L2739, L2877: re.test
- L2752, L2753, L2772: resolveIocCode
- L2754, L2755: codeOrderIdx.get
- L2759: sortByAgreementOrder
- L2771: buildIocRowDisplayLabels
- L2771, L2916: sorted.map
- L2780: displayLabelByKey.get
- L2800: bitText.match
- L2801: bitText.trim
- L2802: m..replace
- L2804: seenAmounts.has
- L2805: seenAmounts.add
- L2811: compact.trim
- L2811: m..trim
- L2812: pctOfDealValue
- L2816: bits.push
- L2821: getCitableValue
- L2821: isCitableValue
- L2823, L2826, L2829, L2833, L2852: pushBit
- L2825, L2829, L2885: isTaggedItem
- L2825: u.map
- L2831, L2846, L2847: formatIocThresholdAmount
- L2850, L2851: parts.push
- L2852: parts.join
- L2855: bits.join
- L2868, L2877, L2881: seen.has
- L2872, L2877, L2881: codes.push
- L2872, L2877, L2881: seen.add
- L2890: consumeItem
- L2917: p.full_text.trim
- L2920: thresholdFor
- L2921: exceptionPillsFor
- L2936: displayLabelFor
- L2944: componentCodes.map
- L2956: thrText.split
- L2957: sourceContextForValue
- L2966: excCodes.map

## IocNegativeCovenantsTable

Source: `pages/review/[id].js:2986-3011`

### JSX Elements
- L2992: div {"className":"space-y-3"}
- L2994, L3002: IocNegativeCovenantsTableSingle {"onSelectProvision":"onSelectProvision"}

### Derived Values / Rollups
- L2987: targetProvs = (iocProvisions || []).filter((p) => p.type !== 'IOC-B')
- L2988: buyerProvs = (iocProvisions || []).filter((p) => p.type === 'IOC-B')

### Hover / Click Handlers
- L2994, L3002: IocNegativeCovenantsTableSingle onSelectProvision -> onSelectProvision

### Conditional Branches / Empty States
- L2993: showTarget
- L3001: showBuyer

### Helper Dependencies
- None found.

## StructTable

Source: `pages/review/[id].js:3757-4267`

### JSX Elements
- L3860, L4148, L4206, L4210: span {"className":"italic text-inkFaint"}
- L3868, L3871, L4147: CodeBadge
- L3930, L3931, L3932, L4071, L4154, L4158, L4159, L4222, L4230, L4246: div {"className":"space-y-0.5"}
- L4160, L4247: p {"className":"text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider"}
- L4164: table {"className":"min-w-full text-xs font-ui"}
- L4165: thead {"className":"bg-bg/60 border-b border-border"}
- L4166, L4193: tr
- L4167, L4168: th {"className":"`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`"}
- L4171: tbody {"className":"divide-y divide-border"}
- L4194, L4216: td {"className":"px-3 py-2 whitespace-normal break-words"}
- L4197, L4253: button {"onClick":"() => showEvidence(p._synthEvidence)","className":"text-left text-accent hover:underline font-medium","title":"truncateTip(p._synthEvidence)"}
- L4209: TermCell
- L4220: HoverSource
- L4228: dl {"className":"space-y-1"}
- L4231: dt {"className":"text-[10px] text-inkFaint uppercase tracking-wider"}
- L4232: dd
- L4250: ul {"className":"flex flex-wrap gap-x-3 gap-y-1"}
- L4252: li {"key":"p.id"}

### Derived Values / Rollups
- L3798: joined = provisions .map((p) => (p.full_text || '').trim()) .filter(Boolean) .join('\n\n')
- L3996: allRows = provisions.map((p) => { const features = getStructuredFeatures(p) || {}; const kind = classifyStruct(p); let displayCategory = p.category || 'General'; let cells; if (kind === 'mer
- L4077: otherListProvisions = allRows .filter(({ p }) => demoteStructToOtherList(p)) .map(({ p }) => p)
- L4080: rows = allRows.filter(({ p }) => !demoteStructToOtherList(p))

### Hover / Click Handlers
- L4197, L4216, L4253: button onClick -> () => showEvidence(p._synthEvidence)

### Conditional Branches / Empty States
- L3769: !heroDealStructure
- L3769: !heroDealStructure && f.dealStructure
- L3771: isCitableValue(rawDs)
- L3772: isTaggedItem(ds)
- L3778: isCitableValue(rawDs)
- L3779: isTaggedItem(ds)
- L3780: p.full_text
- L3783: !heroMergerForm
- L3783: !heroMergerForm && f.mergerForm
- L3784: isCitableValue(f.mergerForm)
- L3785: isTaggedItem(mf)
- L3789: heroDealStructure
- L3789: heroDealStructure && heroMergerForm
- L3797: !heroDealStructure || !heroMergerForm
- L3802: joined
- L3803: !heroDealStructure
- L3804: /\bTender\s+Offer\b/i.test(joined) || /\bExchange\s+Offer\b/i.test(joined)
- L3806: /\bScheme\s+of\s+Arrangement\b/i.test(joined)
- L3808: /\bAsset\s+Purchase\b/i.test(joined)
- L3810: /\bagreement\s+and\s+plan\s+of\s+merger\b/i.test(joined)
- L3814: !heroMergerForm
- L3820: subIntoCompany
- L3821: companyIntoSub
- L3822: companyIntoParent
- L3843: code === 'STRUCT-OFFER' || cat.includes('tender offer')
- L3844: cat.includes('effective')
- L3845: cat.includes('effect')
- L3845: cat.includes('effect') && cat.includes('merger')
- L3846: cat.includes('closing')
- L3847: cat.includes('merger')
- L3847: cat.includes('merger') && !cat.includes('agreement')
- L3860: !raw
- L3861: isCitableValue(raw)
- L3862: isTaggedItem(raw)
- L3879: explicit
- L3880: isCitableValue(explicit)
- L3881: v
- L3888: m
- L3896: explicit
- L3897: isCitableValue(explicit)
- L3898: v
- L3902: m
- L3908: v === null || v === undefined
- L3910: isCitableValue(cur)
- L3911: cur === null || cur === undefined
- L3912: typeof cur === 'object'
- L3917: !text
- L3919: dayMatch
- L3922: !/marketing\s+period/i.test(text)
- L3926: parentNotice
- L3927: afterEnd
- L3945: typeof features.mainConcept === 'string'
- L3955: isCharterCat
- L3955: isCharterCat && isBylawsCat
- L3957: exMatch
- L3959: /certificate\s+of\s+incorporation\s+of\s+(?:the\s+)?Merger\s+Sub/i.test(text)
- L3960: /bylaws\s+of\s+(?:the\s+)?Merger\s+Sub|Merger\s+Sub(?:'s)?[^.]{0,60}bylaws/i.test(text)
- L3962: exMatch
- L3963: charterHalf || bylawsHalf
- L3965: charterHalf
- L3966: bylawsHalf
- L3971: isCharterCat
- L3973: ex
- L3974: /certificate\s+of\s+incorporation\s+of\s+(?:the\s+)?Merger\s+Sub/i.test(text)
- L3979: /bylaws/i.test(cat)
- L3980: /bylaws\s+of\s+(?:the\s+)?Merger\s+Sub|Merger\s+Sub(?:'s)?[^.]{0,60}bylaws/i.test(text)
- L3984: ex
- L3987: /directors?\s*(?:&|and)\s*officers?|directors?\s+of\s+the\s+surviving|officers?\s+of\s+the\s+surviving/i.test(cat)
- L3988: /(?:directors?|officers?)\s+of\s+(?:the\s+)?Merger\s+Sub/i.test(text)
- L4001: kind === 'merger'
- L4004: kind === 'offer'
- L4016: cell.raw !== null && cell.raw !== undefined
- L4017: cells.length === 0
- L4018: kind === 'closing'
- L4026: v === null || v === undefined
- L4028: isCitableValue(cur)
- L4029: cur === null || cur === undefined
- L4030: typeof cur === 'object'
- L4046: explicitDeadlineStr !== '' && explicitDeadlineStr !== closingTimingStr
- L4047: explicitDeadlineStr !== ''
- L4053: typeof explicitDeadlineRaw === 'number'
- L4058: kind === 'effects'
- L4061: kind === 'effective'
- L4066: short
- L4086: ai !== bi
- L4097: !s || typeof s !== 'string'
- L4098: !/^[A-Z][A-Z0-9_]+$/.test(s)
- L4115: heroDealStructure
- L4118: !src
- L4121: /merger/i.test(p.category || '')
- L4123: mergerProv
- L4146: raw
- L4173: typeof p.id === 'string'
- L4179: isSynth
- L4182: q
- L4187: rowQuote
- L4190: t.length > n
- L4195: isSynth
- L4196: p._synthEvidence
- L4217: detailsClickable
- L4218: detailsClickable
- L4221: cells.length === 1
- L4223: cells[0].render
- L4232: render
- L4245: otherListProvisions.length > 0
- L4255: onSelectProvision

### Helper Dependencies
- L3758: useShowEvidence
- L3768, L3997: getStructuredFeatures
- L3771, L3784, L3861, L3880, L3897, L3910, L4028: getCitableValue
- L3771, L3778, L3784, L3861, L3880, L3897, L3910, L4028: isCitableValue
- L3772, L3779, L3785, L3862: isTaggedItem
- L3773, L3786, L3863: resolveTaggedLabel
- L3778: getCitableText
- L3780: p.full_text.slice
- L3798, L3996: provisions.map
- L3843, L3844, L3845, L3846, L3847: cat.includes
- L3916, L4040, L4041: unwrap
- L3918, L3923, L3924, L3956, L3972, L3983: text.match
- L3921: text.replace
- L3926: parentNotice..replace
- L3927: afterEnd..replace
- L3958, L3962: exMatch..toUpperCase
- L3965, L3966: parts.push
- L3967: parts.join
- L3973, L3984: ex..toUpperCase
- L3998: classifyStruct
- L4033: JSON.stringify
- L4050: cells.push
- L4059: shortEffectsRef
- L4062: shortEffectiveTime
- L4065: shortGovernance
- L4077, L4080: allRows.filter
- L4078, L4080: demoteStructToOtherList
- L4083: rows.sort
- L4084, L4085: STRUCT_ORDER.indexOf
- L4099: s.replace
- L4102: c.toUpperCase
- L4103: m.replace
- L4116: humanizeDealStructure
- L4121, L4122: provisions.find
- L4124: mergerProv.full_text.slice
- L4127: rows.unshift
- L4172: rows.map
- L4173: p.id.startsWith
- L4181, L4184: evidenceQuote
- L4186: buildRowQuote
- L4190: t.slice
- L4199, L4218: showEvidence
- L4201: truncateTip
- L4224: cells..render
- L4225, L4232: renderFeatureCell
- L4229: cells.map
- L4231: humanizeKey
- L4232: render
- L4251: otherListProvisions.map
- L4255: onSelectProvision

## CategoryFeatureSummaryTable

Source: `pages/review/[id].js:4700-4937`

### JSX Elements
- L4816, L4817, L4818, L4823, L4915: div {"className":"space-y-3"}
- L4819, L4916: p {"className":"text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider"}
- L4824: table {"className":"min-w-full text-xs font-ui"}
- L4825: thead {"className":"bg-bg/60 border-b border-border"}
- L4826, L4833, L4856: tr
- L4827, L4828: th {"className":"`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`"}
- L4831: tbody {"className":"divide-y divide-border"}
- L4834, L4857, L4875: td {"className":"px-3 py-3 text-xs font-ui italic text-inkFaint"}
- L4863: TermCell
- L4865, L4879: HoverSource
- L4866, L4871: span {"className":"text-left text-accent hover:underline font-medium"}
- L4919: ul {"className":"flex flex-wrap gap-x-3 gap-y-1"}
- L4921: li {"key":"p.id"}
- L4922: button {"onClick":"() => onSelectProvision && onSelectProvision(p)","className":"text-xs font-ui text-accent hover:underline"}

### Derived Values / Rollups
- L4701: spec = CATEGORY_SUMMARY_FEATURES[type] || []
- L4739: rawRows = spec.map((row, originalIdx) => { let hit = null; if (row.maeCode) { hit = findCarveoutByCode(provisions, row.maeCode); if (!hit && row.keys && row.keys.length > 0) { hit = pickFirs
- L4790: rows = [...rawRows].sort((a, b) => { const aPresent = a.hit !== null && a.hit !== undefined; const bPresent = b.hit !== null && b.hit !== undefined; if (aPresent !== bPresent) return aPre
- L4798: sortedProvs = [...provisions].sort((a, b) => String(a.category || '').localeCompare(String(b.category || ''), undefined, { sensitivity: 'base' }) )
- L4802: titleLabel = (() => { if (type === 'NOSOL') return 'No-Solicitation Summary'; if (type === 'ANTI') return 'Regulatory Summary'; if (type === 'MISC') return 'Boilerplate Summary'; if (type === '
- L4908: consumedIds = new Set([ ...rows.map((row) => row.hit && row.hit.provision && row.hit.provision.id).filter(Boolean), ...allConsumedProvisionIds(provisions, rows.map((row) => row.keys).filter(Bool
- L4912: filtered = sortedProvs.filter((p) => !consumedIds.has(p.id) && !(excludeSet && excludeSet.has(p.id)))

### Hover / Click Handlers
- L4875, L4922: td onClick -> onClick

### Conditional Branches / Empty States
- L4702: excludeProvisionIds instanceof Set
- L4708: !deal || !deal.announce_date
- L4713: isCitableValue(raw)
- L4714: typeof unwrapped === 'string'
- L4714: typeof unwrapped === 'string' && unwrapped.trim()
- L4719: !outsideDateStr
- L4722: Number.isNaN(od.getTime()) || Number.isNaN(ad.getTime())
- L4741: row.maeCode
- L4743: !hit && row.keys
- L4743: !hit && row.keys && row.keys.length > 0
- L4746: row.keys
- L4746: row.keys && row.keys.length > 0
- L4752: !hit && row.keys && row.keys.includes('outsideDateMonths')
- L4752: !hit && row.keys && row.keys.includes('outsideDateMonths') && derivedOutsideDateMonths !== null
- L4763: !hit
- L4763: !hit && row.keys
- L4766: isSurvivalRow
- L4767: deal && deal.metadata
- L4767: deal && deal.metadata && Array.isArray(deal.metadata.classified_sections)
- L4770: s
- L4771: isPublic
- L4772: row.keys.includes('repsSurvivalPresent')
- L4774: row.keys.includes('repsSurvivalDuration')
- L4776: row.keys.includes('repsSurvivalExceptions')
- L4782: row.customRenderKey
- L4786: row.keys
- L4791: a.hit !== null
- L4792: b.hit !== null
- L4793: aPresent
- L4793: aPresent !== bPresent
- L4803: type === 'NOSOL'
- L4804: type === 'ANTI'
- L4805: type === 'MISC'
- L4806: type === 'MAE'
- L4807: type === 'TERMR' || type === 'TERMR-M' || type === 'TERMR-B' || type === 'TERMR-T'
- L4808: type === 'TERMF'
- L4809: type === 'COV'
- L4810: type === 'IOC' || type === 'IOC-T' || type === 'IOC-B'
- L4811: type === 'COND' || type === 'COND-M' || type === 'COND-B' || type === 'COND-S'
- L4832: rows.length === 0
- L4844: row.customRender
- L4844: row.customRender && !row.hit
- L4850: row.hit
- L4853: !!(quote && showEvidence)
- L4854: clickable
- L4863: row.hit
- L4864: clickable
- L4876: clickable
- L4880: customNode !== null
- L4880: customNode !== null && customNode !== undefined
- L4883: row.hit
- L4883: row.hit && row.hit.provision
- L4886: type === 'COV'
- L4886: type === 'COV' && hitCode === 'COV-DO'
- L4902: !hideProvisionsList
- L4909: row.hit && row.hit.provision
- L4912: !consumedIds.has(p.id)
- L4913: filtered.length === 0
- L4924: onSelectProvision

### Helper Dependencies
- L4703: useShowEvidence
- L4711: getStructuredFeatures
- L4713: getCitableValue
- L4713: isCitableValue
- L4714, L4715: unwrapped.trim
- L4722: ad.getTime
- L4722: od.getTime
- L4723: ad.getDate
- L4723: ad.getFullYear
- L4723: ad.getMonth
- L4723: od.getDate
- L4723: od.getFullYear
- L4723: od.getMonth
- L4726: computeOutsideDateMonths
- L4736, L4737: renderClearSkiesIocFallback
- L4739: spec.map
- L4742: findCarveoutByCode
- L4744, L4747: pickFirstNonEmpty
- L4752, L4772, L4774, L4776: row.keys.includes
- L4765: row.keys.some
- L4765: survivalKeys.has
- L4770: sections.some
- L4839, L4909, L4910: rows.map
- L4845: row.customRender
- L4851: evidenceQuote
- L4854: showEvidence
- L4884: getAiMetadata
- L4887: compactDoValue
- L4889: renderSummaryRowValue
- L4910: allConsumedProvisionIds
- L4912: consumedIds.has
- L4912: excludeSet.has
- L4912: sortedProvs.filter
- L4920: filtered.map
- L4924: onSelectProvision

## BringdownTable

Source: `pages/review/[id].js:6371-6445`

### JSX Elements
- L6396, L6397, L6402, L6427, L6429, L6430, L6431: div {"data-testid":"rowTestId","className":"space-y-1 text-[11px] font-ui"}
- L6398, L6399, L6403, L6405, L6433: span {"className":"text-[10px] text-inkFaint uppercase tracking-wider"}

### Derived Values / Rollups
- L6372: condProvs = (provisions || []).filter((p) => isCondRepProvision(p, repsType))
- L6417: repPool = (provisions || []).filter((p) => p.type === repsType)

### Hover / Click Handlers
- None found.

### Conditional Branches / Empty States
- L6379: scope
- L6381: Array.isArray(excepted)
- L6381: Array.isArray(excepted) && excepted.length > 0
- L6382: Array.isArray(f.bringDownTiers)
- L6384: t
- L6384: t && typeof t === 'object'
- L6388: tiers.length === 0
- L6390: repsType === 'REP-B'
- L6391: explicitScope === 'ALL_REPS_NOT_OTHERWISE_SPECIFIED' || !explicitScope
- L6394: scopeLabel
- L6401: explicitExcepted.length > 0
- L6406: typeof item === 'string'
- L6421: sec
- L6421: sec && !nameBySec[sec]
- L6435: r.general
- L6435: r.general && j === 0

### Helper Dependencies
- L6372: isCondRepProvision
- L6377, L6420: getStructuredFeatures
- L6384: tiers.push
- L6393: prettifyEnumValue
- L6404: explicitExcepted.map
- L6406: JSON.stringify
- L6424: buildBringdownTierLines
- L6428: rows.map
- L6432: splitBringdownCoveredPills

## RepGeneralExceptionsTable

Source: `pages/review/[id].js:7004-7350`

### JSX Elements
- L7038, L7108, L7117, L7118, L7126, L7133, L7135, L7154, L7308, L7312, L7320, L7331, L7336, L7341: span {"className":"italic text-inkFaint"}
- L7143, L7307, L7330: HoverSource
- L7144: button {"onClick":"() => showEvidence(quote)","className":"text-left text-accent hover:underline font-medium"}
- L7198: RepCiteNamesList
- L7271, L7272, L7280, L7281, L7286, L7302: div {"className":"bg-white border border-border rounded-lg shadow-sm overflow-hidden"}
- L7282: p {"className":"text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider"}
- L7287: table {"className":"min-w-full text-xs font-ui"}
- L7288: thead {"className":"bg-bg/60 border-b border-border"}
- L7289, L7296, L7326: tr
- L7290, L7291: th {"className":"`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`"}
- L7294: tbody {"className":"divide-y divide-border"}
- L7297, L7298, L7327, L7328: td {"className":"px-3 py-2 whitespace-nowrap"}
- L7300: dl {"className":"space-y-1.5"}
- L7303: dt {"className":"text-[10px] text-inkFaint uppercase tracking-wider"}
- L7304: dd {"className":"whitespace-pre-wrap break-words"}

### Derived Values / Rollups
- L7008: preamblePros = (provisions || []).filter((p) => { const c = String(p?.code || '').toUpperCase(); return c === 'REP-T-PREAMBLE' || c === 'REP-B-PREAMBLE'; })
- L7012: preambleFeats = preamblePros.map((p) => getStructuredFeatures(p) || {})
- L7187: secValues = secSubRows.map((sr) => { if (sr.custom === 'lookback') { const lookbackRaw = pickKey(['secFilingsExceptionLookbackDate']) || pickKey(['secFilingsLookbackMonths']) || pickKey(['secF

### Hover / Click Handlers
- L7144, L7308, L7331: button onClick -> () => showEvidence(quote)

### Conditional Branches / Empty States
- L7014: Array.isArray(keys)
- L7020: raw === null || raw === undefined || raw === '' || raw === false
- L7021: Array.isArray(raw)
- L7021: Array.isArray(raw) && raw.length === 0
- L7029: raw === null || raw === undefined || raw === '' || raw === false
- L7030: Array.isArray(raw)
- L7030: Array.isArray(raw) && raw.length === 0
- L7037: raw === null || raw === undefined
- L7057: !raw
- L7058: isCitableValue(raw)
- L7061: typeof v === 'string'
- L7062: typeof raw === 'string'
- L7083: m
- L7094: isCitableValue(monthsVal)
- L7096: isCitableValue(txtVal)
- L7098: isCitableValue(dateVal)
- L7107: !monthsVal && !txtVal && !dateVal
- L7107: !monthsVal && !txtVal && !dateVal && !derived
- L7117: txtVal
- L7118: dateVal
- L7126: derived
- L7127: monthsVal
- L7127: monthsVal && /^\d+$/.test(String(monthsVal).trim())
- L7133: n >= 3
- L7140: quote
- L7141: clickable
- L7171: f[k] !== null && f[k] !== undefined
- L7171: keys.some((k) => f[k] !== null && f[k] !== undefined && f[k] !== '')
- L7172: typeof p.full_text === 'string'
- L7173: text
- L7177: typeof p.full_text === 'string'
- L7178: text
- L7188: sr.custom === 'lookback'
- L7197: sr.label === 'Carved-out Reps'
- L7197: sr.label === 'Carved-out Reps' && v != null
- L7199: v != null
- L7200: v !== null
- L7212: typeof disclosureRaw === 'string'
- L7213: isCitableValue(disclosureRaw)
- L7215: t
- L7217: typeof inner === 'string'
- L7238: !disclosureStandard
- L7241: found
- L7268: !secAnyPresent
- L7268: !secAnyPresent && disclosureRaw === null
- L7269: Array.isArray(provisions)
- L7269: Array.isArray(provisions) && provisions.length > 0
- L7299: secAnyPresent
- L7309: s.quote
- L7309: s.quote && showEvidence
- L7310: s.quote
- L7310: s.quote && showEvidence
- L7329: disclosureRaw != null
- L7332: disclosureQuote
- L7332: disclosureQuote && showEvidence
- L7333: disclosureQuote
- L7333: disclosureQuote && showEvidence
- L7335: disclosureStandard

### Helper Dependencies
- L7012, L7017, L7068, L7170: getStructuredFeatures
- L7012: preamblePros.map
- L7040, L7199, L7337: renderFeatureCell
- L7058, L7094, L7096, L7098, L7213: isCitableValue
- L7059, L7061, L7063: candidates.push
- L7059: getCitableQuotes
- L7060, L7094, L7096, L7098, L7216: getCitableValue
- L7069, L7072: pushCitable
- L7082: text.match
- L7083: m..replace
- L7090, L7091, L7092, L7165, L7189, L7196, L7205: pickKey
- L7106: deriveCutoffPhrase
- L7133: formatLookbackYears
- L7137: useShowEvidence
- L7138: evidenceQuote
- L7146, L7310, L7333: showEvidence
- L7166, L7194, L7200, L7248: extractQuote
- L7171: keys.some
- L7172, L7177: p.full_text.trim
- L7187: secSubRows.map
- L7194: renderLookbackVal
- L7202: secValues.some
- L7203: secValues.find
- L7214: getCitableText
- L7221, L7240: extractCrossQualificationSentence
- L7297, L7327: renderLabelCell
- L7301: secValues.filter

## RepMaterialContractsTable

Source: `pages/review/[id].js:7368-7559`

### JSX Elements
- L7447, L7448, L7484, L7486, L7527, L7537: div {"className":"bg-white border border-border rounded-lg shadow-sm overflow-hidden"}
- L7449, L7464: p {"className":"text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider"}
- L7450, L7485, L7490, L7494, L7498, L7508, L7516, L7533, L7541: span {"className":"text-inkFaint/70"}
- L7453, L7528: button {"onClick":"() => onSelectProvision(source)","className":"text-[10px] font-ui text-accent hover:underline"}
- L7470: table {"className":"min-w-full text-xs font-ui"}
- L7471: thead {"className":"bg-bg/60 border-b border-border"}
- L7472, L7482: tr
- L7473, L7474: th {"data-testid":"col-term","className":"px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap"}
- L7477: tbody {"className":"divide-y divide-border"}
- L7483, L7505: td {"className":"px-3 py-2"}
- L7487: TermCell
- L7488, L7507: HoverSource

### Derived Values / Rollups
- L7380: buckets = Array.isArray(f.materialContractsBuckets) ? f.materialContractsBuckets : []
- L7381: thresholds = Array.isArray(f.materialContractsDollarThresholds) ? f.materialContractsDollarThresholds : []
- L7386: k = String(t.bucket || t.code || '').toUpperCase()
- L7408: clauseRows = buckets.map((b, i) => { const tagged = isTaggedItem(b); const code = tagged ? String(b.code || '').toUpperCase() : ''; const canonicalLabel = code && MATERIAL_CONTRACT_BUCKET_CODES
- L7411: canonicalLabel = code && MATERIAL_CONTRACT_BUCKET_CODES[code] ? MATERIAL_CONTRACT_BUCKET_CODES[code] : null
- L7419: threshRaw = (tagged && (b.threshold ?? b.qualifier)) ?? (code ? threshByCode.get(code) : null) ?? null
- L7420: thr = normThreshold(threshRaw)
- L7424: presentCodes = new Set(buckets.map((b) => isTaggedItem(b) ? String(b.code || '').toUpperCase() : '').filter(Boolean))
- L7444: canonicalCodes = Object.keys(MATERIAL_CONTRACT_BUCKET_CODES)

### Hover / Click Handlers
- L7453, L7508, L7528: button onClick -> () => onSelectProvision(source)

### Conditional Branches / Empty States
- L7376: code === 'REP-T-MATERIAL-CONTRACTS'
- L7377: /material\s+contracts/i.test(p.category || '')
- L7379: source
- L7380: Array.isArray(f.materialContractsBuckets)
- L7381: Array.isArray(f.materialContractsDollarThresholds)
- L7385: !t || typeof t !== 'object'
- L7387: k
- L7391: raw === null || raw === undefined || raw === ''
- L7392: isCitableValue(raw)
- L7395: typeof inner === 'object'
- L7395: typeof inner === 'object' && inner !== null
- L7396: inner === ''
- L7397: q
- L7397: q && q.length
- L7399: typeof raw === 'object'
- L7410: tagged
- L7411: code
- L7411: code && MATERIAL_CONTRACT_BUCKET_CODES[code]
- L7415: code && code !== 'OTHER'
- L7416: b.label
- L7416: tagged
- L7417: isCanonical
- L7418: tagged
- L7419: code
- L7419: tagged
- L7424: isTaggedItem(b)
- L7435: isTaggedItem(b)
- L7436: !text || text.length < 8
- L7438: presentCodes.has(code)
- L7440: re.test(text)
- L7452: source && onSelectProvision
- L7463: clauseRows.length === 0
- L7465: isEdit
- L7480: quote
- L7487: source
- L7489: row.isCanonical
- L7493: clickable
- L7506: row.thrText
- L7507: row.thrQuotes
- L7509: clickable
- L7510: row.thrQuotes && row.thrQuotes[0]
- L7510: row.thrQuotes && row.thrQuotes[0] && showEvidence
- L7533: showCoverage
- L7536: showCoverage
- L7544: present
- L7548: present

### Helper Dependencies
- L7369: useViewMode
- L7370: useShowEvidence
- L7371: useState
- L7374: getAiMetadata
- L7379: getStructuredFeatures
- L7387: threshByCode.set
- L7392: isCitableValue
- L7393: getCitableValue
- L7394: getCitableQuotes
- L7408, L7424: buckets.map
- L7409, L7424, L7435: isTaggedItem
- L7419: threshByCode.get
- L7420: normThreshold
- L7438, L7539: presentCodes.has
- L7440: presentCodes.add
- L7440: re.test
- L7455: onSelectProvision
- L7478: clauseRows.map
- L7485: romanizeLower
- L7510: showEvidence
- L7530: setShowCoverage
- L7538: canonicalCodes.map

## CondSingleTable

Source: `pages/review/[id].js:7915-8127`

### JSX Elements
- L8017, L8018, L8023, L8098: div {"className":"bg-white border border-border rounded-lg shadow-sm overflow-hidden"}
- L8019: p {"className":"text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider"}
- L8024: table {"className":"min-w-full text-xs font-ui"}
- L8025: thead {"className":"bg-bg/60 border-b border-border"}
- L8026, L8056, L8067: tr
- L8027, L8028: th {"className":"`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`"}
- L8031: tbody {"className":"divide-y divide-border"}
- L8041, L8077, L8083: span
- L8053: Fragment {"key":"sec.family"}
- L8057, L8074, L8089: td {"className":"px-3 py-2.5 text-xs font-ui font-semibold text-inkMid uppercase tracking-wider"}
- L8076: TermCell
- L8090: HoverSource
- L8091: CanonicalConditionDetails
- L8099: BringdownTable
- L8111: NotIncludedStrip {"title":"CONDITION_ABSENT_COPY"}

### Derived Values / Rollups
- L7919: isTenderDeal = useMemo(() => { for (const p of pool) { if (/tender\s+offer|acceptance\s+time|exchange\s+offer/i.test(String(p && p.full_text || ''))) return true; } return false; }, [pool])
- L7919: useMemo(() => { for (const p of pool) { if (/tender\s+offer|acceptance\s+time|exchange\s+offer/i.test(String(p && p.full_text || ''))) return true; } return false; }, [pool])
- L7927: parentApprovalRequired = useMemo(() => { for (const p of pool) { const f = getStructuredFeatures(p) || {}; const raw = isCitableValue(f.shareholderApprovalMethodParent) ? getCitableValue(f.shareholderAppro
- L7927: useMemo(() => { for (const p of pool) { const f = getStructuredFeatures(p) || {}; const raw = isCitableValue(f.shareholderApprovalMethodParent) ? getCitableValue(f.shareholderAppro
- L7941: sections = COND_FAMILY_SECTIONS.map((sec) => { const famProvs = pool.filter((p) => p && p.type === sec.family); const rowsRaw = sec.list.filter((row) => { if (row.tenderOnly && !isTenderDeal)
- L7942: famProvs = pool.filter((p) => p && p.type === sec.family)
- L7943: rowsRaw = sec.list.filter((row) => { if (row.tenderOnly && !isTenderDeal) return false; if (row.requireParentApproval && !parentApprovalRequired) return false; return true; })
- L7948: rows = rowsRaw .map((row, originalIdx) => { // Match on category regex OR, when the canonical row names a featureKey, // on any provision that populates that structured feature (e.g. the 
- L7954: matches = famProvs.filter((p) => { const f = getStructuredFeatures(p) || {}; const code = f.canonicalCode || (p && p.ai_metadata && p.ai_metadata.code) || null; if (conditionRowMatches(row, 
- L7990: famRowsInfo = rows.map(({ row, matches }) => ({ label: row.label, matches: matches.map((p) => ({ sectionNumber: (getStructuredFeatures(p) || {}).sectionNumber, fullText: p.full_text, })), }))
- L7997: certifies = certQuote ? resolveCertifiedConditions(certQuote, famRowsInfo) : []
- L8038: presentRows = sec.rows.filter(({ row, matches }) => matches.length > 0 || row.alwaysRender)
- L8039: absentRows = sec.rows.filter(({ row, matches }) => matches.length === 0 && !row.alwaysRender)

### Hover / Click Handlers
- None found.

### Conditional Branches / Empty States
- L7921: /tender\s+offer|acceptance\s+time|exchange\s+offer/i.test(String(p && p.full_text || ''))
- L7921: p
- L7930: isCitableValue(f.shareholderApprovalMethodParent)
- L7933: typeof raw === 'object'
- L7933: typeof raw === 'object' && raw
- L7935: s === 'SPECIAL_MEETING' || s === 'WRITTEN_CONSENT' || s === 'SIGN_AND_CONSENT'
- L7942: p
- L7944: row.tenderOnly
- L7944: row.tenderOnly && !isTenderDeal
- L7945: row.requireParentApproval
- L7945: row.requireParentApproval && !parentApprovalRequired
- L7956: p && p.ai_metadata
- L7957: conditionRowMatches(row, p, code)
- L7958: row.featureKey
- L7960: v !== undefined && v !== null && v !== ''
- L7960: v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
- L7967: a.present !== b.present
- L7981: raw === undefined || raw === null
- L7982: isCitableValue(raw)
- L7983: raw && typeof raw === 'object'
- L7983: raw && typeof raw === 'object' && typeof raw.text === 'string'
- L7985: /Sections?\s+\d/i.test(String(t || ''))
- L7997: certQuote
- L7998: certifies.length === 0
- L8003: /Officer.?s Certificate/i.test(row.label)
- L8006: isCitableValue(f.certificationRequired)
- L8009: certified
- L8039: matches.length === 0
- L8065: primary
- L8065: primary && typeof primary.full_text === 'string'
- L8069: /Stockholder Approval/i.test(row.label)
- L8069: /Stockholder Approval/i.test(row.label) && sec.family === 'COND-M'
- L8075: primary
- L8097: /Bring[\s-]*Down/i.test(row.label)
- L8110: absentRows.length > 0

### Helper Dependencies
- L7919, L7927: useMemo
- L7929, L7955, L7979, L7993, L8005: getStructuredFeatures
- L7930, L7982, L8006: isCitableValue
- L7931, L8006: getCitableValue
- L7941: COND_FAMILY_SECTIONS.map
- L7942: pool.filter
- L7943: sec.list.filter
- L7948: rowsRaw.map
- L7954: famProvs.filter
- L7957: conditionRowMatches
- L7982: getCitableQuotes
- L7983: texts.push
- L7990: rows.map
- L7992: matches.map
- L7997: resolveCertifiedConditions
- L8004: matches.some
- L8009: certifies.push
- L8009: row.label.replace
- L8032: sections.map
- L8038, L8039: sec.rows.filter
- L8063: presentRows.map
- L8115: absentRows.map

## CovSummaryTable

Source: `pages/review/[id].js:8756-8822`

### JSX Elements
- L8759, L8760, L8761, L8766: div {"className":"space-y-3"}
- L8762: p {"className":"text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider"}
- L8767: table {"className":"min-w-full text-xs font-ui"}
- L8768: thead {"className":"bg-bg/60 border-b border-border"}
- L8769, L8795: tr
- L8770, L8771: th {"className":"`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`"}
- L8774: tbody {"className":"divide-y divide-border"}
- L8775, L8776, L8777, L8778, L8779, L8780, L8781, L8790, L8791, L8792, L8803, L8809: DefaultFeatureRow
- L8782, L8804, L8807, L8808: CustomFeatureRow
- L8789, L8802, L8806: GroupHeaderRow
- L8796: td {"className":"px-3 py-1.5 text-[10px] font-ui font-semibold text-inkFaint uppercase tracking-wider border-t border-border"}
- L8814: ProvisionsInSectionList {"onSelectProvision":"onSelectProvision"}

### Derived Values / Rollups
- None found.

### Hover / Click Handlers
- L8814: ProvisionsInSectionList onSelectProvision -> onSelectProvision

### Conditional Branches / Empty States
- L8787: hasFinancing

### Helper Dependencies
- L8757: COV_FINANCING_KEYS.some
- L8757: pickFirstNonEmpty
- L8782: renderAccessCell
- L8804: renderPublicStatementsExceptionsCell
- L8807: renderDoInsuranceCapCell
- L8808: renderDoPeriodCell
- L8817: consumedProvisionIds

## MiscSummaryTable

Source: `pages/review/[id].js:8904-8964`

### JSX Elements
- L8906, L8907, L8908, L8913: div {"className":"space-y-3"}
- L8909: p {"className":"text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider"}
- L8914: table {"className":"min-w-full text-xs font-ui"}
- L8915: thead {"className":"bg-bg/60 border-b border-border"}
- L8916: tr
- L8917, L8918: th {"className":"`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`"}
- L8921: tbody {"className":"divide-y divide-border"}
- L8922, L8924, L8925, L8926, L8927, L8931, L8932, L8933, L8934, L8935, L8936, L8942, L8943, L8944, L8947, L8948, L8949, L8950, L8951: DefaultFeatureRow
- L8923, L8928: CustomFeatureRow
- L8930, L8938, L8946: GroupHeaderRow
- L8956: ProvisionsInSectionList {"onSelectProvision":"onSelectProvision"}

### Derived Values / Rollups
- None found.

### Hover / Click Handlers
- L8956: ProvisionsInSectionList onSelectProvision -> onSelectProvision

### Conditional Branches / Empty States
- None found.

### Helper Dependencies
- L8923: renderJurisdictionCell
- L8928: renderFeeExpenseCell
- L8959: consumedProvisionIds

## AntitrustSummaryTable

Source: `pages/review/[id].js:9134-9197`

### JSX Elements
- L9149, L9150, L9151, L9175, L9176: div {"className":"space-y-3"}
- L9153: ProvisionSubRowTable
- L9160: OutsideDatePillRow
- L9165: span {"className":"italic text-inkFaint"}
- L9170, L9177: button {"onClick":"() => onSelectProvision(row.hit.provision)","className":"text-left text-accent hover:underline font-medium"}
- L9189: ProvisionsInSectionList {"onSelectProvision":"onSelectProvision"}

### Derived Values / Rollups
- L9135: rows = buildAntitrustSummaryRows(provisions, allProvisions || provisions)
- L9136: consumedIds = new Set([ ...rows.map((r) => r.hit && r.hit.provision && r.hit.provision.id).filter(Boolean), ...allConsumedProvisionIds(provisions, ANTI_CONSUMED_KEY_GROUPS), ])

### Hover / Click Handlers
- L9170: button onClick -> () => onSelectProvision(row.hit.provision)
- L9189: ProvisionsInSectionList onSelectProvision -> onSelectProvision

### Conditional Branches / Empty States
- L9137: r.hit && r.hit.provision
- L9144: outsideProv
- L9145: outsideProv
- L9157: outsideDatePillSpec
- L9162: rows.length === 0
- L9168: /pull/i.test(row.label)
- L9169: row.hit && row.hit.provision
- L9169: row.hit && row.hit.provision && onSelectProvision
- L9174: /pull|timing agreement/i.test(row.label)

### Helper Dependencies
- L9135: buildAntitrustSummaryRows
- L9137, L9166: rows.map
- L9138: allConsumedProvisionIds
- L9141: getAiMetadata
- L9144: getStructuredFeatures
- L9146: buildOutsideDateExtensionDetail
- L9146: buildOutsideDatePillSpec
- L9170: onSelectProvision
- L9176, L9181: renderAntiHitValue
