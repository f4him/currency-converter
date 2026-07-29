// Scans the webpage for price patterns, wraps them in a span (or annotates
// the containing element directly), and shows a tooltip in the user's
// selected currency on hover.
//
// The detection layer is split into adapters: site-specific adapters run
// first, then structured data, split-node detection, and finally the generic
// regex fallback. Conversion, formatting, and tooltip behavior stay shared.

const siteAdapters = [
  window.bdtAdapters?.amazon,
  window.bdtAdapters?.aliexpress,
  window.bdtAdapters?.ebay,
  window.bdtAdapters?.walmart,
  window.bdtAdapters?.temu,
  window.bdtAdapters?.generic
].filter(Boolean);

// CURRENCIES and CURRENCY_SYMBOLS are already declared in currencies.js and shared via the global context


// ============================================================
// 1. STATE
// ============================================================

let cachedRates = null;
let cachedRatesBase = "BDT";
let targetCurrency = "BDT";

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "BUTTON",
]);
const INLINE_TAGS = new Set([
  "SPAN",
  "B",
  "I",
  "EM",
  "STRONG",
  "SMALL",
  "SUP",
  "SUB",
  "A",
  "U",
  "S",
  "MARK",
  "ABBR",
  "LABEL",
  "FONT",
]);

const MAX_REASONABLE_AMOUNT = 100_000_000;
const PRICE_SPAN_STYLE = `
  border-bottom: 1.5px dashed #1D9E75;
  cursor: help;
  border-radius: 2px;
`;

// ============================================================
// 2. REGEX + SYMBOL RESOLUTION
// ============================================================

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPriceRegex() {
  const symbols = [...new Set(Object.values(CURRENCIES).map((c) => c.symbol))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex);
  const codes = Object.keys(CURRENCIES).sort((a, b) => b.length - a.length);

  const symbolGroup = `(?:${symbols.join("|")})`;
  const codeGroup = `\\b(?:${codes.join("|")})\\b`;
  const marker = `(?:${symbolGroup}|${codeGroup})`;
  const number = `\\d[\\d.,\\s]*\\d|\\d`;

  return new RegExp(
    `(?<![A-Za-z0-9])(?<pre>${marker})\\s?(?<amt1>${number})(?![A-Za-z0-9])` +
      `|(?<![A-Za-z0-9.,])(?<amt2>${number})\\s?(?<post>${marker})(?![A-Za-z0-9])`,
    "g",
  );
}

let PRICE_REGEX = buildPriceRegex();

function containerHasPrice(text) {
  return new RegExp(PRICE_REGEX.source, "g").test(text);
}

const TLD_CURRENCY_MAP = {
  ca: "CAD",
  au: "AUD",
  nz: "NZD",
  sg: "SGD",
  hk: "HKD",
  mx: "MXN",
  jm: "JMD",
  tw: "TWD",
  ph: "PHP",
  cl: "CLP",
  co: "COP",
  ar: "ARS",
  uk: "GBP",
  gb: "GBP",
  in: "INR",
  jp: "JPY",
  de: "EUR",
  fr: "EUR",
  it: "EUR",
  es: "EUR",
  nl: "EUR",
  br: "BRL",
};
const LANG_CURRENCY_MAP = {
  "en-CA": "CAD",
  "fr-CA": "CAD",
  "en-AU": "AUD",
  "en-NZ": "NZD",
  "en-SG": "SGD",
  "en-HK": "HKD",
  "es-MX": "MXN",
};

function guessRegionCurrency() {
  const tld = location.hostname.split(".").pop();
  if (TLD_CURRENCY_MAP[tld]) return TLD_CURRENCY_MAP[tld];

  const lang = document.documentElement.lang || navigator.language;
  if (LANG_CURRENCY_MAP[lang]) return LANG_CURRENCY_MAP[lang];

  return null;
}

function currenciesForSymbol(symbol) {
  return Object.keys(CURRENCIES).filter((code) => CURRENCIES[code].symbol === symbol);
}

function resolveCurrencyCode(marker) {
  if (CURRENCIES[marker]) return marker;

  const candidates = currenciesForSymbol(marker);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const regionGuess = guessRegionCurrency();
  if (regionGuess && candidates.includes(regionGuess)) return regionGuess;

  return CURRENCY_SYMBOLS[marker] || candidates[0];
}

function parseLocaleAmount(raw) {
  const str = String(raw ?? "").trim().replace(/\s/g, "");
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");

  if (lastComma === -1 && lastDot === -1) return parseFloat(str);

  if (lastComma > lastDot) {
    return parseFloat(str.replace(/\./g, "").replace(",", "."));
  }
  return parseFloat(str.replace(/,/g, ""));
}

// ============================================================
// 3. SETTINGS + RATES
// ============================================================

async function loadSettings() {
  const stored = await chrome.storage.local.get(["targetCurrency"]);
  targetCurrency = stored.targetCurrency || "BDT";
}

async function loadRates() {
  const response = await chrome.runtime.sendMessage({ type: "GET_RATES" });
  cachedRates = response?.rates || null;
  cachedRatesBase = response?.ratesBase || "BDT";
  return cachedRates;
}

function convertAmount(amount, from, to, rates, base) {
  if (!rates || rates[from] == null || rates[to] == null) return null;
  const inBase = from === base ? amount : amount / rates[from];
  return to === base ? inBase : inBase * rates[to];
}

function formatCurrency(amount, code) {
  const info = CURRENCIES[code];
  if (!info) return amount.toFixed(2);

  const decimals = info.decimals ?? 2;
  const fixed = decimals === 0 ? Math.round(amount) : Number(amount.toFixed(decimals));

  if (code === "BDT") {
    const str = fixed.toString();
    if (str.length <= 3) return info.symbol + " " + str;
    const last3 = str.slice(-3);
    const rest = str.slice(0, -3);
    const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
    return info.symbol + " " + formatted;
  }

  const str = fixed.toFixed(decimals);
  const formatted = str.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return info.symbol + " " + formatted;
}

function formatRateLine(from, to, rates, base) {
  const oneUnit = convertAmount(1, from, to, rates, base);
  if (oneUnit == null) return "";
  return `1 ${from} = ${formatCurrency(oneUnit, to)}`;
}

// ============================================================
// 4. TOOLTIP UI
// ============================================================

const tooltip = document.createElement("div");
tooltip.id = "bdt-tooltip";
tooltip.style.cssText = `
  position: fixed;
  z-index: 2147483647;
  background: #1a1a1a;
  color: #f0f0f0;
  border-radius: 8px;
  padding: 8px 13px;
  font-size: 13px;
  font-family: system-ui, sans-serif;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  max-width: 200px;
  line-height: 1.5;
`;
document.body.appendChild(tooltip);

function showTooltip(e, convertedText, rateLine) {
  tooltip.innerHTML = `
    <div style="font-size:16px;font-weight:600;color:#9FE1CB">${convertedText}</div>
    <div style="font-size:12px;color:#fff;margin-top:2px">${rateLine}</div>
  `;
  tooltip.style.opacity = "1";
  positionTooltip(e);
}

function positionTooltip(e) {
  const x = e.clientX + 12;
  const y = e.clientY - 10;
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  tooltip.style.left = (x + tw > window.innerWidth ? x - tw - 24 : x) + "px";
  tooltip.style.top = (y + th > window.innerHeight ? y - th - 4 : y) + "px";
}

function hideTooltip() {
  tooltip.style.opacity = "0";
}

function attachPriceBehavior(target, fromCurrency, amount) {
  target.addEventListener("mouseover", (e) => {
    if (!cachedRates) return;
    const converted = convertAmount(
      amount,
      fromCurrency,
      targetCurrency,
      cachedRates,
      cachedRatesBase,
    );
    if (converted == null) return;
    showTooltip(
      e,
      formatCurrency(converted, targetCurrency),
      formatRateLine(fromCurrency, targetCurrency, cachedRates, cachedRatesBase),
    );
  });
  target.addEventListener("mousemove", positionTooltip);
  target.addEventListener("mouseleave", hideTooltip);
}

function wrapPriceSpan(textNode, matchText, matchIndex, fromCurrency, amount) {
  const span = document.createElement("span");
  span.className = "bdt-price";
  span.dataset.bdtPrice = "1";
  span.textContent = matchText;
  span.style.cssText = PRICE_SPAN_STYLE;
  attachPriceBehavior(span, fromCurrency, amount);

  const after = textNode.splitText(matchIndex);
  after.nodeValue = after.nodeValue.slice(matchText.length);
  textNode.parentNode.insertBefore(span, after);
}

function shouldAnnotate(target) {
  if (!target || !(target instanceof Element)) return false;
  if (target.dataset?.bdtPrice === "1" || target.classList.contains("bdt-price")) return false;
  return !target.closest("[data-bdt-price]");
}

function annotateContainer(el, fromCurrency, amount) {
  if (!shouldAnnotate(el)) return false;
  el.classList.add("bdt-price");
  el.dataset.bdtPrice = "1";
  el.style.borderBottom = "1.5px dashed #1D9E75";
  el.style.cursor = "help";
  el.style.borderRadius = "2px";
  attachPriceBehavior(el, fromCurrency, amount);
  return true;
}

// ============================================================
// 5. ADAPTER LAYER
// ============================================================

let pageCurrencyHint = null;

function getActiveAdapter(hostname = location.hostname) {
  return siteAdapters.find((adapter) => adapter.matches(hostname)) || siteAdapters.at(-1);
}

function extractPriceInfoFromText(text, fallbackCurrency = null) {
  const re = new RegExp(PRICE_REGEX.source, "g");
  const matches = [...String(text ?? "").matchAll(re)];
  if (matches.length === 0) return null;

  const m = matches[0];
  const marker = m.groups.pre ?? m.groups.post;
  const amountStr = m.groups.amt1 ?? m.groups.amt2;
  const amount = parseLocaleAmount(amountStr);
  if (isNaN(amount) || amount <= 0 || amount > MAX_REASONABLE_AMOUNT) return null;

  const fromCurrency = resolveCurrencyCode(marker) || fallbackCurrency;
  if (!fromCurrency || !cachedRates || cachedRates[fromCurrency] == null) return null;

  return { amount, fromCurrency };
}

function processAdapterCandidate(candidate) {
  const element = candidate?.element ?? candidate;
  if (!(element instanceof Element)) return;
  if (!shouldAnnotate(element)) return;

  const text =
    element.getAttribute("content") ||
    element.getAttribute("data-price") ||
    element.textContent ||
    "";

  if (candidate?.amount != null) {
    const amount = parseLocaleAmount(candidate.amount);
    const fromCurrency = candidate.currency || pageCurrencyHint || null;
    if (!isNaN(amount) && amount > 0 && fromCurrency && cachedRates?.[fromCurrency] != null) {
      annotateContainer(element, fromCurrency, amount);
    }
    return;
  }

  const info = extractPriceInfoFromText(text, pageCurrencyHint);
  if (!info) return;
  annotateContainer(element, info.fromCurrency, info.amount);
}

function scanSiteAdapter(root) {
  const adapter = getActiveAdapter(location.hostname);
  if (!adapter?.scan) return;
  const candidates = adapter.scan(root) || [];
  if (Array.isArray(candidates)) {
    candidates.forEach(processAdapterCandidate);
    return;
  }
  processAdapterCandidate(candidates);
}

// ============================================================
// 6. STRUCTURED DATA (JSON-LD / microdata / OpenGraph)
// ============================================================

function scanStructuredData(root) {
  root.querySelectorAll('[itemprop="price"]').forEach((el) => {
    const amountAttr = el.getAttribute("content") || el.textContent;
    const amount = parseLocaleAmount(amountAttr);
    if (isNaN(amount) || amount <= 0) return;

    const scope = el.closest("[itemscope]");
    const currencyEl = scope?.querySelector('[itemprop="priceCurrency"]');
    const currency = currencyEl?.getAttribute("content") || currencyEl?.textContent;
    if (!currency || !CURRENCIES[currency]) return;

    pageCurrencyHint = pageCurrencyHint || currency;
    annotateContainer(el, currency, amount);
  });

  const ogCurrency = document.querySelector('meta[property="product:price:currency"]')?.content;
  if (ogCurrency && CURRENCIES[ogCurrency]) pageCurrencyHint = pageCurrencyHint || ogCurrency;

  if (!pageCurrencyHint) {
    root.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      try {
        const data = JSON.parse(script.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const currency = item?.offers?.priceCurrency || item?.priceCurrency;
          if (currency && CURRENCIES[currency]) {
            pageCurrencyHint = currency;
            break;
          }
        }
      } catch {
        // malformed JSON-LD is common in the wild — ignore and move on
      }
    });
  }
}

// ============================================================
// 7. SPLIT-PRICE CONTAINER PASS
// ============================================================

function hasOnlyInlineDescendants(el, depth = 0) {
  if (depth > 4) return false;
  for (const child of el.children) {
    if (!INLINE_TAGS.has(child.tagName)) return false;
    if (!hasOnlyInlineDescendants(child, depth + 1)) return false;
  }
  return true;
}

function scanSplitPriceContainers(root) {
  const all = root.querySelectorAll("*");
  for (const el of all) {
    if (el.children.length < 2) continue;
    if (SKIP_TAGS.has(el.tagName) || el.isContentEditable) continue;
    if (el.querySelector("[data-bdt-price], .bdt-price")) continue;
    if (!hasOnlyInlineDescendants(el)) continue;

    const text = el.textContent.trim();
    if (!text || text.length > 40) continue;

    const alreadyMatchable = [...el.childNodes].some(
      (n) => n.nodeType === Node.TEXT_NODE && containerHasPrice(n.nodeValue),
    );
    if (alreadyMatchable) continue;

    const re = new RegExp(PRICE_REGEX.source, "g");
    const match = re.exec(text);
    if (!match) continue;

    const marker = match.groups.pre ?? match.groups.post;
    const amountStr = match.groups.amt1 ?? match.groups.amt2;
    const amount = parseLocaleAmount(amountStr);
    if (isNaN(amount) || amount <= 0 || amount > MAX_REASONABLE_AMOUNT) continue;

    const fromCurrency = resolveCurrencyCode(marker);
    if (!fromCurrency || !cachedRates || cachedRates[fromCurrency] == null) continue;

    annotateContainer(el, fromCurrency, amount);
  }
}

// ============================================================
// 8. TEXT-NODE PASS
// ============================================================

function scanTextNode(node) {
  const text = node.nodeValue;
  if (!text || !text.trim()) return;

  const re = new RegExp(PRICE_REGEX.source, "g");
  const matches = [...text.matchAll(re)];
  if (matches.length === 0) return;

  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const marker = m.groups.pre ?? m.groups.post;
    const amountStr = m.groups.amt1 ?? m.groups.amt2;
    const charAfter = text[m.index + m[0].length];
    if (charAfter === "%") continue;

    const amount = parseLocaleAmount(amountStr);
    if (isNaN(amount) || amount <= 0 || amount > MAX_REASONABLE_AMOUNT) continue;

    const fromCurrency = resolveCurrencyCode(marker);
    if (!fromCurrency || !cachedRates || cachedRates[fromCurrency] == null) continue;

    wrapPriceSpan(node, m[0], m.index, fromCurrency, amount);
  }
}

// ============================================================
// 9. DOM + SHADOW DOM TRAVERSAL
// ============================================================

function walkTextNodes(root, callback) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-bdt-price]")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node;
  while ((node = walker.nextNode())) callback(node);
}

function collectRoots(root, out = []) {
  out.push(root);
  const elements = root.querySelectorAll("*");
  for (const el of elements) {
    if (el.shadowRoot) collectRoots(el.shadowRoot, out);
  }
  return out;
}

function scanRoot(root) {
  scanStructuredData(root);
  scanSiteAdapter(root);
  scanSplitPriceContainers(root);

  const nodes = [];
  walkTextNodes(root, (n) => nodes.push(n));
  nodes.forEach(scanTextNode);
}

function scanAllRootsChunked(roots) {
  let i = 0;
  function step(deadline) {
    while (i < roots.length && (deadline?.timeRemaining?.() ?? 1) > 0) {
      scanRoot(roots[i]);
      i++;
    }
    if (i < roots.length) {
      requestIdleCallback(step);
    }
  }
  if ("requestIdleCallback" in window) {
    requestIdleCallback(step);
  } else {
    roots.forEach(scanRoot);
  }
}

// ============================================================
// 10. MUTATION OBSERVER
// ============================================================

let pendingRoots = new Set();
let observerScheduled = false;

function scheduleRescan(root) {
  pendingRoots.add(root);
  if (observerScheduled) return;
  observerScheduled = true;
  const run = () => {
    const roots = [...pendingRoots];
    pendingRoots.clear();
    observerScheduled = false;
    roots.forEach(scanRoot);
  };
  if ("requestIdleCallback" in window) requestIdleCallback(run);
  else setTimeout(run, 200);
}

function observeRoot(root) {
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && node.dataset?.bdtPrice) continue;
        scheduleRescan(root);
      }
      if (m.type === "characterData") scheduleRescan(root);
    }
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const shadowWatcher = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          collectRoots(node).forEach((r) => {
            if (r !== node) {
              scanRoot(r);
              observeRoot(r);
            }
          });
        }
      }
    }
  });
  shadowWatcher.observe(root, { childList: true, subtree: true });
}

// ============================================================
// 11. INIT
// ============================================================

async function init() {
  await loadSettings();
  const rates = await loadRates();
  if (!rates) return;

  const roots = collectRoots(document.body);
  scanAllRootsChunked(roots);
  roots.forEach(observeRoot);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.targetCurrency) {
    targetCurrency = changes.targetCurrency.newValue || "BDT";
  }

  if (changes.rates || changes.ratesBase) {
    const hadNoRates = !cachedRates;
    cachedRates = changes.rates?.newValue ?? cachedRates;
    cachedRatesBase = changes.ratesBase?.newValue ?? cachedRatesBase;

    if (hadNoRates && cachedRates) {
      const roots = collectRoots(document.body);
      scanAllRootsChunked(roots);
      roots.forEach(observeRoot);
    }
  }
});

init();
