const EBAY_HOST_RE = /(^|\.)(ebay\.[a-z.]+|ebay)$/i;

window.bdtAdapters = window.bdtAdapters || {};
window.bdtAdapters.ebay = {
  matches(hostname) {
    return EBAY_HOST_RE.test(hostname);
  },

  scan(root) {
    const candidates = [];
    const seen = new Set();

    const push = (node) => {
      if (!node || seen.has(node)) return;
      seen.add(node);
      candidates.push(node);
    };

    root.querySelectorAll('.s-item__price, .x-price-primary, [itemprop="price"]').forEach(push);
    return candidates;
  },
};
