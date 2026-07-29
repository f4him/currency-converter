// Aliexpress adapter – finds the primary price span inside .la_i0 containers
// and extracts the amount (currency guessed from symbol, defaults to USD if $ present).

const ALIEXPRESS_HOST_RE = /(^|\.)((aliexpress)\.[a-z.]+|aliexpress)$/i;

function toPriceCandidate(node) {
  if (!node || !(node instanceof Element)) return null;
  // The primary price element is usually the first span containing a $ or numeric price
  const span = node.querySelector('span[data-spm-anchor-id]') || node.querySelector('span');
  if (!span) return null;
  const text = span.textContent.trim();
  // Match optional currency symbol followed by number (allow commas and periods)
  const match = text.match(/^(?:[$€£¥₹₩]|[A-Z]{3})?([\d.,]+)$/);
  if (!match) return null;
  const amount = match[1];
  const currency = /\$/.test(text) ? "USD" : null; // fallback to null for other symbols
  return { element: span, amount, currency };
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

    // Aliexpress product containers that hold price spans
    const containers = root.querySelectorAll('.la_i0');
    containers.forEach(push);

    return candidates;
  },
};
