export type RetailerCategory = "electronics" | "computers" | "appliances" | "home" | "pharmacy";

export interface Retailer {
  name: string;
  url: string;
  searchUrl: (query: string) => string;
  category: RetailerCategory[];
  description: string;
  badge?: string;
}

export const retailers: Retailer[] = [
  {
    name: "Zap",
    url: "https://www.zap.co.il",
    searchUrl: (q) => `https://www.zap.co.il/search.aspx?keyword=${encodeURIComponent(q)}`,
    category: ["electronics", "computers", "appliances", "home"],
    description: "Price comparison engine — 2M+ monthly visitors",
    badge: "Best for comparison",
  },
  {
    name: "KSP",
    url: "https://ksp.co.il",
    searchUrl: (q) => `https://ksp.co.il/search/${encodeURIComponent(q)}`,
    category: ["electronics", "computers"],
    description: "Israel's largest electronics retailer. Price-match guarantee.",
    badge: "Price match",
  },
  {
    name: "iDigital",
    url: "https://www.idigital.co.il",
    searchUrl: (q) => `https://www.idigital.co.il/search?q=${encodeURIComponent(q)}`,
    category: ["electronics"],
    description: "Apple Premium Reseller. Best for Apple & premium brands.",
  },
  {
    name: "Ivory",
    url: "https://www.ivory.co.il",
    searchUrl: (q) => `https://www.ivory.co.il/catalog.php?act=cat&q=${encodeURIComponent(q)}`,
    category: ["electronics", "computers"],
    description: "Wide selection, competitive pricing on computers & peripherals.",
  },
  {
    name: "Bug",
    url: "https://www.bug.co.il",
    searchUrl: (q) => `https://www.bug.co.il/search?s=${encodeURIComponent(q)}`,
    category: ["computers"],
    description: "Strong in PC components. Has a used/refurbished section.",
  },
  {
    name: "Home Center",
    url: "https://www.homecenter.co.il",
    searchUrl: (q) => `https://www.homecenter.co.il/homecenter/html/main/search.html?q=${encodeURIComponent(q)}`,
    category: ["appliances", "home"],
    description: "Large home improvement & appliances retailer.",
  },
  {
    name: "Machsanei Hashmal",
    url: "https://www.mahsane.co.il",
    searchUrl: (q) => `https://www.mahsane.co.il/search?q=${encodeURIComponent(q)}`,
    category: ["appliances"],
    description: "Electrical appliance warehouse. Competitive on large appliances.",
  },
  {
    name: "Super-Pharm",
    url: "https://www.super-pharm.co.il",
    searchUrl: (q) => `https://www.super-pharm.co.il/search?q=${encodeURIComponent(q)}`,
    category: ["pharmacy"],
    description: "Israel's largest pharmacy. Frequent 1+1 deals.",
  },
];

export const CUSTOMS_FREE_THRESHOLD_USD = 75;
export const VAT_RATE = 0.17;
export const CUSTOMS_RATE = 0.12;
