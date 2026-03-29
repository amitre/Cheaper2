export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="text-lg font-bold text-blue-600 shrink-0">Cheaper2</div>
          <div className="h-9 flex-1 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">מנתח את החיפוש ומחפש אפשרויות...</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-100 rounded-2xl p-5 space-y-3 animate-pulse">
              <div className="flex justify-between">
                <div className="h-4 w-16 bg-gray-100 rounded-full" />
                <div className="h-4 w-20 bg-gray-100 rounded-full" />
              </div>
              <div className="h-5 w-3/4 bg-gray-200 rounded" />
              <div className="h-4 w-1/2 bg-gray-100 rounded" />
              <div className="space-y-2 pt-2">
                <div className="h-3 w-full bg-gray-100 rounded" />
                <div className="h-3 w-5/6 bg-gray-100 rounded" />
                <div className="h-3 w-4/6 bg-gray-100 rounded" />
              </div>
              <div className="h-9 w-full bg-gray-100 rounded-lg mt-2" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
