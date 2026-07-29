const TEMU_HOST_RE = /(^|\.)(temu\.com|temu)$/i;

function guessTemuCurrency(hostname) {
  const parts = hostname.toLowerCase().split(".");
  const tld = parts[parts.length - 1];
  if (tld === "uk") return "GBP";
  if (tld === "ca") return "CAD";
  if (tld === "au") return "AUD";
  if (["de", "fr", "it", "es", "nl", "be"].includes(tld)) return "EUR";
  return "USD";
}

function parseTemuPrice(text, hostname) {
  const cleaned = text.replace(/\s+/g, "");
  // Match currency symbol followed by numbers or vice versa
  const match = cleaned.match(
    /(?:([$€£¥₹₩]|USD|EUR|GBP|JPY|INR|KRW|CAD|AUD|SGD|HKD|MXN|BRL|DKK|SEK|NOK|PLN|TRY|RUB|ZAR|AED)|C\$|A\$|S\$|NZ\$|HK\$)?([0-9]+[.,][0-9]+|[0-9]+)(?:([$€£¥₹₩]|USD|EUR|GBP|JPY|INR|KRW|CAD|AUD|SGD|HKD|MXN|BRL|DKK|SEK|NOK|PLN|TRY|RUB|ZAR|AED)|C\$|A\$|S\$|NZ\$|HK\$)?/i,
  );
  if (!match) return null;

  const amountStr = match[2];
  const symbol = match[1] || match[3];

  let currency = null;
  if (symbol) {
    const symLower = symbol.toLowerCase();
    if (symLower.includes("$")) {
      const guess = guessTemuCurrency(hostname);
      currency = guess && (guess.endsWith("D") || guess === "USD") ? guess : "USD";
    } else if (symLower === "€" || symLower === "eur") {
      currency = "EUR";
    } else if (symLower === "£" || symLower === "gbp") {
      currency = "GBP";
    } else {
      currency = symbol.toUpperCase();
    }
  } else {
    currency = guessTemuCurrency(hostname);
  }
  return { amount: amountStr, currency };
}

window.bdtAdapters = window.bdtAdapters || {};
window.bdtAdapters.temu = {
  matches(hostname) {
    return TEMU_HOST_RE.test(hostname);
  },

  scan(root) {
    const candidates = [];
    const seen = new Set();
    const hostname = window.location.hostname;

    // Use specific selectors, avoiding overly broad ones like div[aria-hidden="true"]
    const selectors = [
      '[data-testid="price"]',
      '[class*="price" i]',
      '[class*="Price" i]',
    ];

    const push = (node) => {
      if (!node || !(node instanceof Element) || seen.has(node)) return;

      const text = (node.textContent || "").trim();
      if (!text || !/[0-9]/.test(text)) return;

      // Ensure we don't process a large container element that just happens to contain a class with "price"
      if (text.length > 30) return;

      const info = parseTemuPrice(text, hostname);
      if (info) {
        seen.add(node);
        // Mark child elements as seen to prevent duplicates
        node.querySelectorAll("*").forEach((child) => seen.add(child));

        candidates.push({
          element: node,
          amount: info.amount,
          currency: info.currency,
        });
      }
    };

    selectors.forEach((selector) => {
      root.querySelectorAll(selector).forEach(push);
    });

    return candidates;
  },
};
