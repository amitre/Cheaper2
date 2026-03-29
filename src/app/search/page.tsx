import { redirect } from "next/navigation";
import { generateProducts } from "@/lib/products";
import ProductSelectionCard from "@/components/ProductSelectionCard";

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

  let data;
  let error = false;

  try {
    data = await generateProducts(query);
  } catch {
    error = true;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky header */}
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
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-6">
        {error ? (
          /* Fallback when API unavailable */
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm mb-2">
              לא ניתן לטעון המלצות כרגע.
            </p>
            <a
              href={`/compare?q=${encodeURIComponent(query)}&name=${encodeURIComponent(query)}&brand=&min=0&max=0`}
              className="text-blue-600 text-sm hover:underline"
            >
              חפש ישירות באתרים →
            </a>
          </div>
        ) : data ? (
          <>
            {/* Heading */}
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                אפשרויות עבור{" "}
                <span className="text-blue-600">&ldquo;{query}&rdquo;</span>
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                בחר מוצר לצפייה בהשוואת מחירים מלאה
              </p>
            </div>

            {/* Category tip */}
            {data.categoryTip && (
              <div
                className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-right"
                dir="rtl"
              >
                <p className="text-xs text-amber-800">
                  <span className="font-semibold">טיפ: </span>
                  {data.categoryTip}
                </p>
              </div>
            )}

            {/* Product cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Recommended first */}
              {[
                ...data.products.filter((p) => p.recommended),
                ...data.products.filter((p) => !p.recommended),
              ].map((product) => (
                <ProductSelectionCard key={product.name} product={product} />
              ))}
            </div>

            {/* Not finding what you need */}
            <p className="text-center text-xs text-gray-400 pt-2">
              לא מצאת מה שחיפשת?{" "}
              <a href="/" className="text-blue-500 hover:underline">
                חזור לחיפוש
              </a>
            </p>
          </>
        ) : null}
      </main>

      <footer className="border-t border-gray-100 py-5 text-center text-xs text-gray-400">
        Prices include 17% VAT · All prices in NIS
      </footer>
    </div>
  );
}
