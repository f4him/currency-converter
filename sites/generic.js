window.bdtAdapters = window.bdtAdapters || {};
window.bdtAdapters.generic = {
  matches(hostname) {
    return true;
  },

  scan(root) {
    const candidates = [];
    const seen = new Set();

    const push = (node) => {
      if (!node || seen.has(node)) return;
      seen.add(node);
      candidates.push(node);
    };

    root.querySelectorAll('[itemprop="price"], [data-price], [class*="price"], [class*="Price"]').forEach(push);
    return candidates;
  },
};
