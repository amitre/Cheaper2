"use client";

import { retailers } from "@/lib/retailers";

export interface Product {
  name: string;
  brand: string;
  searchQuery: string;
  priceRangeNIS: string;
  keySpecs: string[];
}

const FEATURED_RETAILERS = ["Zap", "KSP", "iDigital", "Ivory", "Bug"];

export default function ProductComparison({ products }: { products: Product[] }) {
  const featured = retailers.filter((r) => FEATURED_RETAILERS.includes(r.name));

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-px flex-1 bg-gray-100" />
        <span className="text-xs text-gray-400 uppercase tracking-wider">
          Recommended products
        </span>
        <div className="h-px flex-1 bg-gray-100" />
      </div>

      {products.map((product) => (
        <div
          key={product.name}
          className="border border-gray-100 rounded-xl overflow-hidden"
        >
          {/* Product header */}
          <div className="px-5 py-4 bg-gray-50 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900">{product.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{product.brand}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-blue-600">
                ₪{product.priceRangeNIS}
              </p>
              <p className="text-xs text-gray-400">est. price range</p>
            </div>
          </div>

          {/* Key specs */}
          {product.keySpecs.length > 0 && (
            <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-gray-100">
              {product.keySpecs.map((spec) => (
                <span
                  key={spec}
                  className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded-md"
                >
                  {spec}
                </span>
              ))}
            </div>
          )}

          {/* Retailer links */}
          <div className="divide-y divide-gray-50">
            {featured.map((retailer) => (
              <a
                key={retailer.name}
                href={retailer.searchUrl(product.searchQuery)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors group"
              >
                <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors">
                  {retailer.name}
                </span>
                <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-blue-500 transition-colors">
                  <span>Search on {retailer.name}</span>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
