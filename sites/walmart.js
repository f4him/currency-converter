const WALMART_HOST_RE = /(^|\.)(walmart\.com|walmart)$/i;

window.bdtAdapters = window.bdtAdapters || {};
window.bdtAdapters.walmart = {
  matches(hostname) {
    return WALMART_HOST_RE.test(hostname);
  },

  scan(root) {
    const candidates = [];
    const seen = new Set();

    const push = (node) => {
      if (!node || seen.has(node)) return;
      seen.add(node);
      candidates.push(node);
    };

    root.querySelectorAll('[data-automation-id="price"], .price-main, .price-group').forEach(push);
    return candidates;
  },
};
