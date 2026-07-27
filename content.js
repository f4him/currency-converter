// Scans the webpage for price patterns, wraps them in a span,
// and shows a tooltip in the user's selected currency on hover.

const PRICE_REGEX = /(A\$|C\$|S\$|\$|€|£|¥|₹|₩)\s?([\d,]+(?:\.\d{1,2})?)/g;

let cachedRates = null;
let cachedRatesBase = "BDT";
let targetCurrency = "BDT";

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

// rates[c] = units of c per 1 base
function convertAmount(amount, from, to, rates, base) {
  if (!rates || rates[from] == null || rates[to] == null) return null;
  const inBase = from === base ? amount : amount / rates[from];
  return to === base ? inBase : inBase * rates[to];
}

function formatCurrency(amount, code) {
  const info = CURRENCIES[code];
  if (!info) return amount.toFixed(2);

  const decimals = info.decimals ?? 2;
  const fixed =
    decimals === 0 ? Math.round(amount) : Number(amount.toFixed(decimals));

  if (code === "BDT") {
    const str = fixed.toString();
    if (str.length <= 3) return info.symbol + " " + str;
    const last3 = str.slice(-3);
    const rest = str.slice(0, -3);
    const formatted =
      rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
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

function wrapPriceSpan(textNode, match, fromCurrency, amount) {
  const span = document.createElement("span");
  span.className = "bdt-price";
  span.textContent = match;
  span.style.cssText = `
    border-bottom: 1.5px dashed #1D9E75;
    cursor: help;
    border-radius: 2px;
  `;

  span.addEventListener("mouseover", (e) => {
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
  span.addEventListener("mousemove", positionTooltip);
  span.addEventListener("mouseleave", hideTooltip);

  const after = textNode.splitText(textNode.nodeValue.indexOf(match));
  after.nodeValue = after.nodeValue.slice(match.length);
  textNode.parentNode.insertBefore(span, after);
}

function scanTextNode(node) {
  const text = node.nodeValue;
  if (!text || text.trim().length === 0) return;

  PRICE_REGEX.lastIndex = 0;
  const match = PRICE_REGEX.exec(text);
  if (!match) return;

  const fullMatch = match[0];
  const symbol = match[1];
  const amountStr = match[2].replace(/,/g, "");
  const amount = parseFloat(amountStr);
  const fromCurrency = CURRENCY_SYMBOLS[symbol];

  if (!fromCurrency || isNaN(amount) || amount <= 0) return;
  if (!cachedRates || cachedRates[fromCurrency] == null) return;

  wrapPriceSpan(node, fullMatch, fromCurrency, amount);
}

function scanDocument() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(tag))
          return NodeFilter.FILTER_REJECT;
        if (parent.classList.contains("bdt-price"))
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  nodes.forEach((n) => scanTextNode(n));
}

async function init() {
  await loadSettings();
  const rates = await loadRates();
  if (!rates) return;
  scanDocument();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.targetCurrency) {
    targetCurrency = changes.targetCurrency.newValue || "BDT";
  }

  if (changes.rates || changes.ratesBase) {
    cachedRates = changes.rates?.newValue ?? cachedRates;
    cachedRatesBase = changes.ratesBase?.newValue ?? cachedRatesBase;
  }
});

init();
