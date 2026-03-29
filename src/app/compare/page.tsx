import { redirect } from "next/navigation";
import { retailers } from "@/lib/retailers";
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

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
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

        {/* Retailer comparison */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            השוואת מחירים באתרים
          </h2>
          <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
            {retailers.map((retailer) => (
              <a
                key={retailer.name}
                href={retailer.searchUrl(searchQuery)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 group-hover:text-blue-600 transition-colors">
                      {retailer.name}
                    </span>
                    {retailer.badge && (
                      <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                        {retailer.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {retailer.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-300 group-hover:text-blue-500 transition-colors shrink-0">
                  <span>ראה מחיר</span>
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
          <p className="text-xs text-gray-400 mt-2 text-center">
            לחץ על כל אתר לראות מחיר עדכני בזמן אמת
          </p>
        </section>

        {/* Import calculator */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            מחשבון ייבוא מחו&quot;ל
          </h2>
          <ImportCalculator />
        </section>

        {/* Consumer rights summary */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            זכויות הצרכן שלך
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { title: "החזרה 14 יום (אונליין)", body: "ביטול עסקה תוך 14 יום מקבלה, ללא צורך בהסבר." },
              { title: "אחריות שנה", body: "אחריות מינימלית של שנה על מוצרי אלקטרוניקה. המוכר אחראי — לא רק היצרן." },
              { title: "מחיר כולל מע\"מ", body: "כל המחירים חייבים לכלול מע\"מ 17% לפי חוק." },
            ].map(({ title, body }) => (
              <div key={title} className="bg-gray-50 rounded-xl px-4 py-3" dir="rtl">
                <p className="text-xs font-semibold text-gray-800 mb-1">{title}</p>
                <p className="text-xs text-gray-500">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 py-5 text-center text-xs text-gray-400">
        Prices include 17% VAT · All prices in NIS
      </footer>
    </div>
  );
}
