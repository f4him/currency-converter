const WALMART_HOST_RE = /(^|\.)(walmart\.com|walmart)$/i;

window.bdtAdapters = window.bdtAdapters || {};
window.bdtAdapters.walmart = {
  matches(hostname) {
    return WALMART_HOST_RE.test(hostname);
  },

  scan(root) {
    const candidates = [];
    const seen = new Set();
    const pricePattern = /\$\d+(\.\d{2})?/;

    const push = (node) => {
      const priceNode = node.closest('[data-automation-id="price"], .price-main, .price-group');
      if (!priceNode) return;

      const clickable = priceNode.closest('a, [role="link"], [role="button"]');
      if (!clickable || seen.has(clickable)) return;

      if (pricePattern.test(priceNode.textContent)) {
        seen.add(clickable);
        candidates.push(clickable);
      }
    };

    root.querySelectorAll('[data-automation-id="price"], .price-main, .price-group').forEach(push);
    return candidates;
  },
};
