import { redirect } from "next/navigation";
import { retailers } from "@/lib/retailers";
import ImportCalculator from "@/components/ImportCalculator";

async function handleSearch(formData: FormData) {
  "use server";
  const query = formData.get("q")?.toString().trim();
  if (query) redirect(`/search?q=${encodeURIComponent(query)}`);
}

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  if (!query) redirect("/");

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header with inline search */}
      <header className="border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <a href="/" className="text-lg font-bold text-blue-600 shrink-0">
            Cheaper2
          </a>
          <form action={handleSearch} className="flex gap-2 flex-1">
            <input
              name="q"
              type="text"
              defaultValue={query}
              placeholder="Search a product..."
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-10">
        {/* Results heading */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Results for <span className="text-blue-600">&ldquo;{query}&rdquo;</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Click a retailer below to see live prices
          </p>
        </div>

        {/* Retailer search links */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Israeli retailers
          </h2>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {retailers.map((r) => (
              <a
                key={r.name}
                href={r.searchUrl(query)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                        {r.name}
                      </span>
                      {r.badge && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                          {r.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{r.description}</p>
                  </div>
                </div>
                <svg
                  className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ))}
          </div>
        </section>

        {/* Import calculator */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Import cost calculator
          </h2>
          <ImportCalculator />
        </section>

        {/* Consumer rights */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Your rights as an Israeli consumer
          </h2>
          <div className="border border-gray-100 rounded-xl divide-y divide-gray-100">
            {[
              {
                title: "14-day return (online)",
                body: "Online purchases may be returned within 14 days of delivery, no questions asked. Full refund minus shipping.",
              },
              {
                title: "7-day return (in-store)",
                body: "Physical store purchases over ₪50 can be returned within 7 days, unused and in original packaging.",
              },
              {
                title: "1-year minimum warranty",
                body: "Electronics must carry a minimum 1-year warranty. The retailer (not just the manufacturer) is legally responsible.",
              },
              {
                title: "Prices must include VAT",
                body: "All displayed prices must include 17% VAT by law. The displayed price is the legally binding price.",
              },
              {
                title: "Interest-free installments",
                body: "Retailers above a revenue threshold must offer at least 3 interest-free payments (tashlumim) for purchases over ₪500.",
              },
            ].map(({ title, body }) => (
              <div key={title} className="px-5 py-4">
                <p className="text-sm font-medium text-gray-800">{title}</p>
                <p className="text-xs text-gray-500 mt-1">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Best time to buy */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Best time to buy
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { period: "Black Friday (Nov)", tip: "15–40% off. Israeli retailers participate heavily." },
              { period: "Singles Day (11.11)", tip: "Best for AliExpress purchases." },
              { period: "Model changeovers", tip: "Old models drop 20–30% when new ones launch." },
            ].map(({ period, tip }) => (
              <div key={period} className="bg-gray-50 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-gray-800">{period}</p>
                <p className="text-xs text-gray-500 mt-1">{tip}</p>
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
