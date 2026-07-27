importScripts("currencies.js");

const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const QUOTE_CODES = Object.keys(CURRENCIES).join(",");

function ratesUrl(base) {
  return `https://api.frankfurter.dev/v2/rates?base=${base}&quotes=${QUOTE_CODES}`;
}

async function fetchRates(base = "BDT") {
  try {
    console.log(ratesUrl());
    const response = await fetch(ratesUrl(base));
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const data = await response.json();

    const rates = {};
    for (const entry of data) {
      rates[entry.quote] = entry.rate;
    }
    rates[base] = 1;

    await chrome.storage.local.set({
      rates,
      ratesBase: base,
      ratesTimestamp: Date.now(),
    });

    return rates;
  } catch (err) {
    console.error("[BD Converter] Failed to fetch rates:", err);
    return null;
  }
}

async function getRates() {
  const stored = await chrome.storage.local.get([
    "rates",
    "ratesBase",
    "ratesTimestamp",
    "targetCurrency",
  ]);
  const now = Date.now();
  const targetCurrency = stored.targetCurrency || "BDT";

  if (
    stored.rates &&
    stored.ratesBase === targetCurrency &&
    stored.ratesTimestamp &&
    now - stored.ratesTimestamp < CACHE_TTL
  ) {
    return { rates: stored.rates, ratesBase: stored.ratesBase };
  }

  const rates = await fetchRates(targetCurrency);
  return rates ? { rates, ratesBase: targetCurrency } : null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_RATES") {
    getRates().then((result) => sendResponse(result || {}));
    return true;
  }

  if (message.type === "FETCH_RATES") {
    const base = message.base || "BDT";
    fetchRates(base).then((rates) =>
      sendResponse({ rates, ratesBase: base, ok: !!rates }),
    );
    return true;
  }

  if (message.type === "GET_RATES_TIMESTAMP") {
    chrome.storage.local.get("ratesTimestamp").then((stored) => {
      sendResponse({ timestamp: stored.ratesTimestamp || null });
    });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const { targetCurrency } = await chrome.storage.local.get("targetCurrency");
  fetchRates(targetCurrency || "BDT");
});
