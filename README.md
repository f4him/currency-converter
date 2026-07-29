# Currency Converter

A chrome extension that lets you hover over prices on any webpage and instantly see the equivalent value in Bangladeshi Taka (BDT) or your chosen currency.

No API key is required. No setup is needed beyond installing the extension and browsing normally.

## What it does

- Hover over prices such as $1,299, €99, £49.99, or ₹5,000 to see a live conversion in a tooltip.
- Use the popup to choose a preferred target currency and run quick manual conversions.
- Fetch live exchange rates from [Frankfurter](https://frankfurter.dev) and cache them locally for 1 hour.
- Detect prices from regular text, site-specific storefront patterns, structured product markup, split-price containers, and shadow DOM content.
- Work across popular shopping sites such as Amazon, eBay, AliExpress, Walmart, Temu, and most other web pages.
- Respect user privacy with no account requirement, no tracking, and no personal data collection.

## Current features

- Hover tooltips with the converted amount and a quick rate line
- Popup-based converter with a saved default hover currency
- Support for many major currencies, including USD, EUR, GBP, JPY, INR, AUD, CAD, SGD, SAR, AED, and more
- Automatic handling of common currency symbols and currency codes
- Fast local caching to avoid repeated rate requests

## Supported currencies for hover detection

| Symbol | Currency |
| ------ | -------- |
| $      | USD      |
| €      | EUR      |
| £      | GBP      |
| ¥      | JPY      |
| ₹      | INR      |
| ₩      | KRW      |
| A$     | AUD      |
| C$     | CAD      |
| S$     | SGD      |

The extension also supports many additional currencies through the built-in currency dataset.

## Installation

1. Clone this repository.

   ```bash
   git clone https://github.com/f4him/bd-currency-converter
   ```

2. Open the project folder in your browser’s extension manager.

3. Load the extension from the repository root:
   - Open chrome://extensions, enable Developer mode, then choose Load unpacked and select the project folder.

No build step is required. The extension runs directly from the repository as a Manifest V3 extension.

## Project structure

```text
bd-currency-converter/
├── manifest.json          — Extension manifest (Manifest V3)
├── background.js          — Fetches and stores exchange rates
├── content.js             — Scans pages and shows hover tooltips
├── popup.html             — Popup UI
├── popup.js               — Popup converter logic
├── currencies.js          — Shared currency metadata and symbols
├── sites/                 — Site-specific adapters for major stores
└── icons/                 — Extension icons
```

## Store links

- [Chrome Webstore](https://chromewebstore.google.com/detail/bppglhdfcfnjgcjjohneaidfkfaeomjm)
- 🌐 [GitHub Repository](https://github.com/f4him/currency-converter)
- ❤️ [Support me on Patreon](https://patreon.com/f4him)

## Privacy

This extension does not collect, store, or transmit personal data. Exchange rates are fetched from the open-source [Frankfurter API](https://frankfurter.dev) and cached locally in your browser for 1 hour.

## License

MIT
