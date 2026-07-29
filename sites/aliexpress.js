// Aliexpress adapter – finds the primary price span inside .la_i0 containers
// and extracts the amount (currency guessed from symbol, defaults to USD if $ present).

const ALIEXPRESS_HOST_RE = /(^|\.)((aliexpress)\.[a-z.]+|aliexpress)$/i;

function toPriceCandidate(node) {
  if (!node || !(node instanceof Element)) return null;
  // Prefer aria-label which often contains the full price string (e.g., "BDT13,602.73")
  const aria = node.getAttribute && node.getAttribute('aria-label');
  let text = '';
  if (aria) {
    text = aria.trim();
  } else {
    // Fallback: gather visible spans that together represent the price
    const span = node.querySelector('span[data-spm-anchor-id]') || node.querySelector('span');
    if (!span) return null;
    text = span.textContent.trim();
  }
  // Match optional currency (symbol, three‑letter code, or "BDT") followed by a number with commas/decimals
  const match = text.match(/^(?:\$|€|£|¥|₹|₩|BDT|[A-Z]{3})?([\d.,]+)$/i);
  if (!match) return null;
  // Clean amount for parsing later (remove commas)
  const amount = match[1].replace(/,/g, '');
  // Resolve currency if explicitly present
  const currencyMatch = text.match(/^(\$|€|£|¥|₹|₩|BDT|[A-Z]{3})/i);
  let currency = null;
  if (currencyMatch) {
    const matchStr = currencyMatch[0];
    if (/^\$/i.test(matchStr)) {
      currency = 'USD';
    } else if (/^BDT$/i.test(matchStr)) {
      currency = 'BDT';
    } else if (/^[A-Z]{3}$/i.test(matchStr)) {
      currency = matchStr.toUpperCase();
    }
  }

  return { element: node, amount, currency };
}

window.bdtAdapters = window.bdtAdapters || {};
window.bdtAdapters.aliexpress = {
  matches(hostname) {
    return ALIEXPRESS_HOST_RE.test(hostname);
  },

  scan(root) {
    const candidates = [];
    const seen = new Set();

    const push = (node) => {
      if (!node || seen.has(node)) return;
      const candidate = toPriceCandidate(node);
      if (!candidate) return;
      if (seen.has(candidate.element)) return;
      seen.add(candidate.element);
      candidates.push(candidate);
    };

    // Aliexpress product containers that hold price spans (including dynamic classes)
    const containers = root.querySelectorAll('.la_i0, ._23lt5, ._3Mpbo, [aria-label]');
    containers.forEach(push);

    return candidates;
  },
};
