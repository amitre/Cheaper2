import { redirect } from "next/navigation";
import { retailers } from "@/lib/retailers";
import { getPrices } from "@/lib/prices";
import ImportCalculator from "@/components/ImportCalculator";

interface Props {
  searchParams: Promise<{
    name?: string;
    brand?: string;
    q?: string;
    min?: string;
    max?: string;
  }>;
}

export default async function ComparePage({ searchParams }: Props) {
  const params = await searchParams;
  const name = params.name?.trim() ?? "";
  const brand = params.brand?.trim() ?? "";
  const searchQuery = params.q?.trim() ?? name;
  const priceMin = parseInt(params.min ?? "0") || 0;
  const priceMax = parseInt(params.max ?? "0") || 0;

  if (!searchQuery) redirect("/");

  const hasPriceRange = priceMin > 0 && priceMax > 0;

  let prices: Awaited<ReturnType<typeof getPrices>> = [];
  try {
    prices = await getPrices(name || searchQuery, searchQuery);
  } catch (err) {
    console.error("[compare] getPrices failed:", err);
    // fallback — show empty, links still work
  }

  // Sort cheapest first
  prices.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

  const cheapest = prices[0];

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <a href="/" className="text-lg font-bold text-blue-600 shrink-0">
            Cheaper2
          </a>
          <span className="text-gray-300">›</span>
          <a
            href={`/search?q=${encodeURIComponent(name || searchQuery)}`}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors truncate"
          >
            חזור לאפשרויות
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-8">
        {/* Product header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{name || searchQuery}</h1>
            {brand && <p className="text-sm text-gray-400 mt-1">{brand}</p>}
          </div>
          {hasPriceRange && (
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-blue-600">
                ₪{priceMin.toLocaleString()}–{priceMax.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">טווח מחיר משוער</p>
            </div>
          )}
        </div>

        {/* Price comparison table */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            השוואת מחירים
          </h2>

          {prices.length > 0 ? (
            <>
              <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                {prices.map((item) => {
                  const retailer = retailers.find((r) => r.name === item.retailerName);
                  const isCheapest = item.retailerName === cheapest?.retailerName;

                  return (
                    <a
                      key={item.retailerName}
                      href={retailer?.searchUrl(searchQuery) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group ${
                        isCheapest ? "bg-green-50 hover:bg-green-50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900">
                              {item.retailerName}
                            </span>
                            {isCheapest && (
                              <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                                הזול ביותר
                              </span>
                            )}
                            {retailer?.badge && !isCheapest && (
                              <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                                {retailer.badge}
                              </span>
                            )}
                          </div>
                          {item.note && (
                            <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold ${isCheapest ? "text-green-700" : "text-gray-800"}`}>
                          ₪{item.price!.toLocaleString()}
                        </span>
                        <svg
                          className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                    </a>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center" dir="rtl">
                * המחירים משוערים ועשויים להשתנות — לחץ על חנות לאימות המחיר העדכני
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-5 text-right" dir="rtl">
              <p className="font-semibold text-amber-800 text-sm mb-1">המוצר אינו זמין בחנויות ישראליות</p>
              <p className="text-xs text-amber-700">
                לא מצאנו את המוצר הזה אצל הקמעונאים הישראלים שאנו עוקבים אחריהם.
                ייתכן שמדובר במוצר ייבוא — השתמש במחשבון למטה כדי לחשב את עלות הייבוא מאמזון / AliExpress.
              </p>
            </div>
          )}
        </section>

        {/* Import calculator */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            מחשבון ייבוא מחו&quot;ל
          </h2>
          <ImportCalculator />
        </section>
      </main>

      <footer className="border-t border-gray-100 py-5 text-center text-xs text-gray-400">
        Prices include 17% VAT · All prices in NIS
      </footer>
    </div>
  );
}
