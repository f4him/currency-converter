const AMAZON_HOST_RE = /(^|\.)(amazon\.[a-z.]+|amazon)$/i;

function guessAmazonCurrency(hostname) {
  const parts = hostname.toLowerCase().split(".");
  const tld = parts[parts.length - 1];
  const secondTld = parts[parts.length - 2];

  if (tld === "uk" || (secondTld === "co" && tld === "uk")) return "GBP";
  if (tld === "ca") return "CAD";
  if (tld === "au" || (secondTld === "com" && tld === "au")) return "AUD";
  if (tld === "in") return "INR";
  if (tld === "jp" || (secondTld === "co" && tld === "jp")) return "JPY";
  if (tld === "mx" || (secondTld === "com" && tld === "mx")) return "MXN";
  if (tld === "br" || (secondTld === "com" && tld === "br")) return "BRL";
  if (tld === "sg") return "SGD";
  if (["de", "fr", "it", "es", "nl", "be"].includes(tld)) return "EUR";
  return "USD";
}

function parseAmountAndCurrency(text, hostname) {
  const cleaned = text.replace(/\s+/g, "");
  // Match currency symbol/code and the price amount
  const match = cleaned.match(
    /^(?:([$€£¥₹₩]|USD|EUR|GBP|JPY|INR|KRW|CAD|AUD|SGD|HKD|MXN|BRL|DKK|SEK|NOK|PLN|TRY|RUB|ZAR|AED)|C\$|A\$|S\$|NZ\$|HK\$)?([0-9][0-9.,]*)(?:([$€£¥₹₩]|USD|EUR|GBP|JPY|INR|KRW|CAD|AUD|SGD|HKD|MXN|BRL|DKK|SEK|NOK|PLN|TRY|RUB|ZAR|AED)|C\$|A\$|S\$|NZ\$|HK\$)?$/i,
  );
  if (!match) return null;

  const amountStr = match[2];
  const symbol = match[1] || match[3];

  let currency = null;
  if (symbol) {
    const symLower = symbol.toLowerCase();
    if (symLower.includes("$")) {
      const guess = guessAmazonCurrency(hostname);
      currency =
        guess && (guess.endsWith("D") || guess === "USD") ? guess : "USD";
    } else if (symLower === "€" || symLower === "eur") {
      currency = "EUR";
    } else if (symLower === "£" || symLower === "gbp") {
      currency = "GBP";
    } else if (symLower === "¥" || symLower === "jpy" || symLower === "cny") {
      currency = guessAmazonCurrency(hostname) === "JPY" ? "JPY" : "CNY";
    } else if (symLower === "₹" || symLower === "inr") {
      currency = "INR";
    } else if (symLower === "₩" || symLower === "krw") {
      currency = "KRW";
    } else {
      currency = symbol.toUpperCase();
    }
  } else {
    currency = guessAmazonCurrency(hostname);
  }

  return { amount: amountStr, currency };
}

window.bdtAdapters = window.bdtAdapters || {};
window.bdtAdapters.amazon = {
  matches(hostname) {
    return AMAZON_HOST_RE.test(hostname);
  },

  scan(root) {
    const candidates = [];
    const seen = new Set();
    const hostname = window.location.hostname;

    // 1. Process .a-price containers first
    root.querySelectorAll(".a-price").forEach((priceEl) => {
      console.log(priceEl);
      if (seen.has(priceEl)) return;

      const offscreenEl = priceEl.querySelector(".a-offscreen");
      const textToParse = offscreenEl
        ? offscreenEl.textContent
        : priceEl.textContent;
      const info = parseAmountAndCurrency(textToParse || "", hostname);

      if (info) {
        seen.add(priceEl);
        // Mark children as seen so we don't double annotate
        priceEl.querySelectorAll("*").forEach((child) => seen.add(child));

        candidates.push({
          element: priceEl,
          amount: info.amount,
          currency: info.currency,
        });
      }
    });

    // 2. Fallback for standalone elements that are not inside already processed .a-price elements
    root
      .querySelectorAll(".a-offscreen")
      .forEach((el) => {
        if (seen.has(el)) return;
        if (el.closest(".a-price") && seen.has(el.closest(".a-price"))) return;

        const info = parseAmountAndCurrency(el.textContent || "", hostname);
        if (info) {
          seen.add(el);
          candidates.push({
            element: el,
            amount: info.amount,
            currency: info.currency,
          });
        }
      });

    return candidates;
  },
};
