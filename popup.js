// Rates are base-based: rates[currency] = how much 1 unit of base is in that currency

let rates = null;
let ratesBase = "BDT";

const amountInput = document.getElementById("amount-input");
const currencySelect = document.getElementById("currency-select");
const targetCurrencySelect = document.getElementById("target-currency-select");
const saveBtn = document.getElementById("save-btn");
const saveStatus = document.getElementById("save-status");
const bdtResult = document.getElementById("bdt-result");
const usdResult = document.getElementById("usd-result");
const eurResult = document.getElementById("eur-result");
const gbpResult = document.getElementById("gbp-result");
const inrResult = document.getElementById("inr-result");
const rateBadge = document.getElementById("rate-badge");
const errorMsg = document.getElementById("error-msg");
const footer = document.getElementById("footer");

function populateCurrencySelects() {
  const options = Object.entries(CURRENCIES)
    .map(
      ([code, info]) => `<option value="${code}">${info.flag} ${code}</option>`,
    )
    .join("");

  currencySelect.innerHTML = options;
  targetCurrencySelect.innerHTML = options;
  currencySelect.value = "USD";
}

function formatBDT(amount) {
  // Bangladeshi lakh system: 1,00,000
  const fixed = Math.round(amount);
  const str = fixed.toString();
  if (str.length <= 3) return "৳ " + str;
  const last3 = str.slice(-3);
  const rest = str.slice(0, -3);
  const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  return "৳ " + formatted;
}

function fmt(amount, symbol, decimals = 2) {
  return (
    symbol +
    " " +
    amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  );
}

function convertAmount(amount, from, to) {
  if (!rates || rates[from] == null || rates[to] == null) return null;
  const inBase = from === ratesBase ? amount : amount / rates[from];
  return to === ratesBase ? inBase : inBase * rates[to];
}

function convert() {
  if (!rates) return;

  const amount = parseFloat(amountInput.value);
  if (isNaN(amount) || amount < 0) return;

  const from = currencySelect.value;
  if (rates[from] == null) return;

  const bdtAmount = convertAmount(amount, from, "BDT");
  if (bdtAmount == null) return;

  const toUSD = convertAmount(amount, from, "USD");
  const toEUR = convertAmount(amount, from, "EUR");
  const toGBP = convertAmount(amount, from, "GBP");
  const toINR = convertAmount(amount, from, "INR");

  bdtResult.textContent = formatBDT(bdtAmount);
  usdResult.textContent = fmt(toUSD, "$");
  eurResult.textContent = fmt(toEUR, "€");
  gbpResult.textContent = fmt(toGBP, "£");
  inrResult.textContent = fmt(toINR, "₹", 0);

  const oneInBdt = convertAmount(1, from, "BDT");
  rateBadge.textContent = `1 ${from} = ${formatBDT(oneInBdt)}`;
}

async function loadSavedTargetCurrency() {
  const stored = await chrome.storage.local.get("targetCurrency");
  const saved = stored.targetCurrency || "BDT";
  if (CURRENCIES[saved]) {
    targetCurrencySelect.value = saved;
  }
}

async function saveTargetCurrency() {
  const code = targetCurrencySelect.value;
  saveBtn.disabled = true;
  saveStatus.textContent = "Fetching rates…";

  await chrome.storage.local.set({ targetCurrency: code });

  const response = await chrome.runtime.sendMessage({
    type: "FETCH_RATES",
    base: code,
  });

  saveBtn.disabled = false;

  if (response?.ok) {
    rates = response.rates;
    ratesBase = response.ratesBase;
    saveStatus.textContent = `Saved — tooltips will show ${code}`;
    convert();
    return;
  }

  saveStatus.textContent = "Could not fetch rates. Try again.";
}

async function init() {
  populateCurrencySelects();
  await loadSavedTargetCurrency();

  const response = await chrome.runtime.sendMessage({ type: "GET_RATES" });
  rates = response?.rates || null;
  ratesBase = response?.ratesBase || "BDT";

  if (!rates) {
    errorMsg.style.display = "block";
    rateBadge.textContent = "No data";
    return;
  }

  const tsResponse = await chrome.runtime.sendMessage({
    type: "GET_RATES_TIMESTAMP",
  });
  if (tsResponse?.timestamp) {
    const mins = Math.floor((Date.now() - tsResponse.timestamp) / 60000);
    const timeStr =
      mins < 1 ? "just now" : mins === 1 ? "1 min ago" : `${mins} mins ago`;
    footer.innerHTML = `Updated ${timeStr} · <a href="https://frankfurter.dev" target="_blank">frankfurter.dev</a>`;
  }

  convert();
}

amountInput.addEventListener("input", convert);
currencySelect.addEventListener("change", convert);
saveBtn.addEventListener("click", saveTargetCurrency);

init();
