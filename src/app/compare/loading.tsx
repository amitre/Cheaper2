export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="text-lg font-bold text-blue-600">Cheaper2</div>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">מחפש מחירים עדכניים...</p>
        </div>
        <div className="border border-gray-100 rounded-xl overflow-hidden animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="space-y-1.5">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-3 w-40 bg-gray-100 rounded" />
              </div>
              <div className="h-6 w-20 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
