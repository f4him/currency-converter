// Rates are base-based: rates[currency] = how much 1 unit of base is in that currency

let rates = null;
let ratesBase = "BDT";
let targetCurrency = "BDT";

const fromAmountInput = document.getElementById("from-amount-input");
const fromCurrencySelect = document.getElementById("from-currency-select");
const toCurrencySelect = document.getElementById("to-currency-select");
const toAmountOutput = document.getElementById("to-amount-output");
const targetCurrencySelect = document.getElementById("target-currency-select");
const saveBtn = document.getElementById("save-btn");
const saveStatus = document.getElementById("save-status");
const activeBadge = document.getElementById("active-badge");
const rateBadge = document.getElementById("rate-badge");
const errorMsg = document.getElementById("error-msg");
const footer = document.getElementById("footer");

function currencyOptions() {
  return Object.entries(CURRENCIES)
    .map(
      ([code, info]) => `<option value="${code}">${info.flag} ${code}</option>`,
    )
    .join("");
}

function populateCurrencySelects() {
  const options = currencyOptions();
  fromCurrencySelect.innerHTML = options;
  toCurrencySelect.innerHTML = options;
  targetCurrencySelect.innerHTML = options;
  fromCurrencySelect.value = "USD";
  toCurrencySelect.value = "BDT";
}

function updateActiveBadge() {
  activeBadge.textContent = targetCurrency;
}

function formatBDT(amount, decimals = 0) {
  const fixed =
    decimals === 0 ? Math.round(amount) : Number(amount.toFixed(decimals));
  const [integer, fraction] = fixed.toString().split(".");
  const str = integer;
  if (str.length <= 3) {
    return "৳ " + (fraction ? `${str}.${fraction}` : str);
  }
  const last3 = str.slice(-3);
  const rest = str.slice(0, -3);
  const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  return "৳ " + formatted + (fraction ? `.${fraction}` : "");
}

function formatCurrency(amount, code, options = {}) {
  const info = CURRENCIES[code];
  if (!info) {
    const decimals = options.forceDecimals ?? 2;
    return amount.toFixed(decimals);
  }

  const decimals =
    options.forceDecimals != null
      ? options.forceDecimals
      : (info.decimals ?? 2);
  const fixed =
    decimals === 0 ? Math.round(amount) : Number(amount.toFixed(decimals));

  if (code === "BDT") return formatBDT(fixed, decimals);

  const str = fixed.toFixed(decimals);
  const formatted = str.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return info.symbol + " " + formatted;
}

function formatRate(amount, code) {
  const info = CURRENCIES[code];
  const decimals = info ? Math.max(2, info.decimals ?? 2) : 2;
  return formatCurrency(amount, code, { forceDecimals: decimals });
}

function convertAmount(amount, from, to) {
  if (!rates || rates[from] == null || rates[to] == null) return null;
  const inBase = from === ratesBase ? amount : amount / rates[from];
  return to === ratesBase ? inBase : inBase * rates[to];
}

function convert() {
  if (!rates) return;

  const amount = parseFloat(fromAmountInput.value);
  const from = fromCurrencySelect.value;
  const to = toCurrencySelect.value;

  if (isNaN(amount) || amount < 0 || rates[from] == null || rates[to] == null) {
    toAmountOutput.textContent = "—";
    rateBadge.textContent = "";
    return;
  }

  const result = convertAmount(amount, from, to);
  if (result == null) {
    toAmountOutput.textContent = "—";
    rateBadge.textContent = "";
    return;
  }

  toAmountOutput.textContent = formatCurrency(result, to);

  const oneUnit = convertAmount(1, from, to);
  rateBadge.textContent = `1 ${from} = ${formatRate(oneUnit, to)}`;
}

async function loadSavedTargetCurrency() {
  const stored = await chrome.storage.local.get("targetCurrency");
  targetCurrency = stored.targetCurrency || "BDT";
  if (CURRENCIES[targetCurrency]) {
    targetCurrencySelect.value = targetCurrency;
    toCurrencySelect.value = targetCurrency;
  }
  updateActiveBadge();
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
    targetCurrency = code;
    toCurrencySelect.value = code;
    updateActiveBadge();
    saveStatus.textContent = `Saved — hover tooltips now show ${code}`;
    convert();
    return;
  }

  saveStatus.textContent = "Could not fetch rates. Try another currency.";
}

async function init() {
  populateCurrencySelects();
  await loadSavedTargetCurrency();

  const response = await chrome.runtime.sendMessage({ type: "GET_RATES" });
  rates = response?.rates || null;
  ratesBase = response?.ratesBase || "BDT";

  if (!rates) {
    errorMsg.style.display = "block";
    activeBadge.textContent = "—";
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

fromAmountInput.addEventListener("input", convert);
fromCurrencySelect.addEventListener("change", convert);
toCurrencySelect.addEventListener("change", convert);
saveBtn.addEventListener("click", saveTargetCurrency);

init();
