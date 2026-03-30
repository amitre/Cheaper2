import { redirect } from "next/navigation";
import { retailers } from "@/lib/retailers";
import SearchSubmitButton from "@/components/SearchSubmitButton";

async function handleSearch(formData: FormData) {
  "use server";
  const query = formData.get("q")?.toString().trim();
  if (query) redirect(`/search?q=${encodeURIComponent(query)}`);
}

const examples = [
  "Samsung Galaxy S25",
  "Sony WH-1000XM5",
  "MacBook Air M3",
  "Dyson V15",
];

export default function Home() {
  const featured = retailers.filter((r) =>
    ["Zap", "KSP", "iDigital", "Ivory"].includes(r.name)
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <span className="text-xl font-bold text-blue-600">Cheaper2</span>
          <span className="text-sm text-gray-400">Israeli Price Comparison</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-xl w-full text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Find the best price in Israel
          </h1>
          <p className="text-gray-500 mb-10">
            Compare across Zap, KSP, iDigital, Ivory, Bug, and more — in seconds.
          </p>

          {/* Search form */}
          <form action={handleSearch} className="flex gap-2">
            <input
              name="q"
              type="text"
              placeholder="Search a product or model number..."
              autoFocus
              className="flex-1 px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <SearchSubmitButton label="Compare" loadingLabel="מחפש..." />
          </form>

          {/* Examples */}
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {examples.map((ex) => (
              <a
                key={ex}
                href={`/search?q=${encodeURIComponent(ex)}`}
                className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full transition-colors"
              >
                {ex}
              </a>
            ))}
          </div>
        </div>

        {/* Retailer pills */}
        <div className="mt-16 max-w-xl w-full">
          <p className="text-xs text-gray-400 text-center mb-4 uppercase tracking-wider">
            Searches across
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {featured.map((r) => (
              <div
                key={r.name}
                className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-center"
              >
                <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                {r.badge && (
                  <p className="text-xs text-blue-500 mt-0.5">{r.badge}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-5 text-center text-xs text-gray-400">
        Prices include 17% VAT · All prices in NIS
      </footer>
    </div>
  );
}
