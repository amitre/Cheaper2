import type { Product } from "@/lib/products";

const popularityColors: Record<Product["popularity"], string> = {
  top_seller: "bg-amber-50 text-amber-700 border-amber-200",
  popular: "bg-blue-50 text-blue-700 border-blue-200",
  premium: "bg-purple-50 text-purple-700 border-purple-200",
  budget_pick: "bg-green-50 text-green-700 border-green-200",
};

interface Props {
  product: Product;
  originalQuery: string;
}

export default function ProductSelectionCard({ product, originalQuery }: Props) {
  const compareUrl = `/compare?name=${encodeURIComponent(product.name)}&brand=${encodeURIComponent(product.brand)}&q=${encodeURIComponent(product.searchQuery)}&min=${product.priceMin}&max=${product.priceMax}&zapUrl=${encodeURIComponent(product.zapUrl)}&oq=${encodeURIComponent(originalQuery)}`;

  return (
    <div
      className={`relative flex flex-col border rounded-2xl p-5 transition-shadow hover:shadow-md ${
        product.recommended
          ? "border-blue-200 shadow-sm shadow-blue-100"
          : "border-gray-100"
      }`}
    >
      {/* Recommended ribbon */}
      {product.recommended && (
        <div className="absolute -top-px left-5 right-5 h-0.5 bg-blue-500 rounded-full" />
      )}

      {/* Top row: popularity badge only — no prices (Zap shows real-time prices) */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap gap-1.5">
          {product.recommended && (
            <span className="text-xs font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-full">
              ✓ מומלץ
            </span>
          )}
          <span
            className={`text-xs border px-2 py-0.5 rounded-full ${popularityColors[product.popularity]}`}
          >
            {product.popularityLabel}
          </span>
        </div>
      </div>

      {/* Product name */}
      <p className="font-semibold text-gray-900 text-sm mb-0.5">{product.name}</p>
      <p className="text-xs text-gray-400 mb-3">{product.brand}</p>

      {/* Key specs */}
      <div className="space-y-1.5 mb-3">
        {product.keySpecs.map((spec) => (
          <div key={spec.label} className="flex items-center justify-between text-xs">
            <span className={spec.isKeyDiff ? "text-gray-700 font-medium" : "text-gray-400"}>
              {spec.label}
            </span>
            <span
              className={`${
                spec.isKeyDiff
                  ? "text-gray-900 font-semibold"
                  : "text-gray-500"
              }`}
            >
              {spec.value}
            </span>
          </div>
        ))}
      </div>

      {/* Main differentiator */}
      <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 text-right">
        <p className="text-xs text-gray-600" dir="rtl">
          {product.mainDifferentiator}
        </p>
      </div>

      {/* Best for */}
      <p className="text-xs text-gray-400 mb-4 text-right" dir="rtl">
        <span className="font-medium text-gray-500">מתאים ל:</span> {product.bestFor}
      </p>

      {/* Recommendation reason */}
      {product.recommended && product.recommendationReason && (
        <div className="bg-blue-50 rounded-lg px-3 py-2 mb-3 text-right">
          <p className="text-xs text-blue-700" dir="rtl">
            💡 {product.recommendationReason}
          </p>
        </div>
      )}

      {/* CTA */}
      <a
        href={compareUrl}
        className="mt-auto block w-full text-center py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        השווה מחירים ←
      </a>
    </div>
  );
}
