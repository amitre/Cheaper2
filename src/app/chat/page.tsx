import { redirect } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function ChatPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  if (!query) redirect("/");

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <a href="/" className="text-lg font-bold text-blue-600 shrink-0">
            Cheaper2
          </a>
        </div>
      </header>

      <main className="flex flex-col flex-1 max-w-3xl mx-auto w-full px-6 py-6">
        <ChatInterface query={query} />
      </main>

      <footer className="border-t border-gray-100 py-5 text-center text-xs text-gray-400">
        Prices include 17% VAT · All prices in NIS
      </footer>
    </div>
  );
}
