// Shared currency dictionary — shortcode → metadata
const CURRENCIES = {
  BDT: { symbol: "৳", flag: "🇧🇩", name: "Bangladeshi Taka", decimals: 0 },
  USD: { symbol: "$", flag: "🇺🇸", name: "US Dollar", decimals: 2 },
  EUR: { symbol: "€", flag: "🇪🇺", name: "Euro", decimals: 2 },
  GBP: { symbol: "£", flag: "🇬🇧", name: "British Pound", decimals: 2 },
  JPY: { symbol: "¥", flag: "🇯🇵", name: "Japanese Yen", decimals: 0 },
  INR: { symbol: "₹", flag: "🇮🇳", name: "Indian Rupee", decimals: 0 },
  AUD: { symbol: "A$", flag: "🇦🇺", name: "Australian Dollar", decimals: 2 },
  CAD: { symbol: "C$", flag: "🇨🇦", name: "Canadian Dollar", decimals: 2 },
  SGD: { symbol: "S$", flag: "🇸🇬", name: "Singapore Dollar", decimals: 2 },
  SAR: { symbol: "﷼", flag: "🇸🇦", name: "Saudi Riyal", decimals: 2 },
  AED: { symbol: "د.إ", flag: "🇦🇪", name: "UAE Dirham", decimals: 2 },
  KRW: { symbol: "₩", flag: "🇰🇷", name: "South Korean Won", decimals: 0 },
};

// Symbol → shortcode for price detection on web pages
const CURRENCY_SYMBOLS = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₹": "INR",
  "₩": "KRW",
  A$: "AUD",
  C$: "CAD",
  S$: "SGD",
};
