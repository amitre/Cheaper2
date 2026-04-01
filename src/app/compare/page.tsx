import { redirect } from "next/navigation";
import ImportCalculator from "@/components/ImportCalculator";

interface Props {
  searchParams: Promise<{
    name?: string;
    brand?: string;
    q?: string;
    min?: string;
    max?: string;
    zapUrl?: string;
    oq?: string;
  }>;
}

export default async function ComparePage({ searchParams }: Props) {
  const params = await searchParams;
  const name = params.name?.trim() ?? "";
  const brand = params.brand?.trim() ?? "";
  const searchQuery = params.q?.trim() ?? name;
  const priceMin = parseInt(params.min ?? "0") || 0;
  const priceMax = parseInt(params.max ?? "0") || 0;
  const zapUrl = params.zapUrl?.trim() ?? "";
  const originalQuery = params.oq?.trim() ?? "";

  if (!searchQuery) redirect("/");

  const hasPriceRange = priceMin > 0 && priceMax > 0;

  // Only use zapUrl if it contains a real numeric modelid (e.g. modelid=1234567).
  // Claude sometimes fabricates modelids like 0 or non-numeric strings — those redirect to Zap homepage.
  const modelIdMatch = zapUrl.match(/modelid=(\d{4,})/);
  const zapLink = modelIdMatch
    ? zapUrl
    : `https://www.zap.co.il/search.aspx?keyword=${encodeURIComponent(
        [brand, name].filter(Boolean).join(" ") || originalQuery || searchQuery
      )}`;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <a href="/" className="text-lg font-bold text-blue-600 shrink-0">
            Cheaper2
          </a>
          <span className="text-gray-300">›</span>
          <a
            href={`/chat?q=${encodeURIComponent(originalQuery || searchQuery)}`}
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

        {/* Zap price comparison */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            השוואת מחירים
          </h2>
          <a
            href={zapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-5 py-5 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors group"
          >
            <div dir="rtl">
              <p className="font-semibold text-orange-900 text-sm">
                ראה מחירים מכל החנויות בזאפ
              </p>
              <p className="text-xs text-orange-700 mt-0.5">
                זאפ משווה מחירים מכל הקמעונאים הישראלים בזמן אמת
              </p>
            </div>
            <svg
              className="w-5 h-5 text-orange-400 group-hover:text-orange-600 transition-colors shrink-0"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
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
