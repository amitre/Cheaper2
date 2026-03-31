"use client";

import { useState, useEffect, useRef } from "react";
import type { Product } from "@/lib/products";
import type { ChatApiResponse, ChatMessage } from "@/app/api/chat/route";
import ProductSelectionCard from "./ProductSelectionCard";

interface Props {
  query: string;
}

interface DisplayMessage {
  role: "user" | "assistant" | "products";
  text?: string;
  products?: Product[];
  categoryTip?: string;
}

export default function ChatInterface({ query }: Props) {
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [apiMessages, setApiMessages] = useState<ChatMessage[]>([]);
  const [zapContext, setZapContext] = useState<string>("");
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const didInitRef = useRef(false);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayMessages, isLoading]);

  // Fire first turn on mount
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    callApi([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function callApi(messages: ChatMessage[]) {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, messages, zapContext }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data: ChatApiResponse = await res.json();

      if (data.type === "question") {
        if (data.zapContext) setZapContext(data.zapContext);
        setDisplayMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.text },
        ]);
        setApiMessages(messages);
        inputRef.current?.focus();
      } else {
        setDisplayMessages((prev) => [
          ...prev,
          { role: "products", products: data.products, categoryTip: data.categoryTip },
        ]);
        setIsDone(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא ידועה");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;

    setInputValue("");
    const userMessage: ChatMessage = { role: "user", content: text };
    const newApiMessages = [...apiMessages, userMessage];

    setDisplayMessages((prev) => [...prev, { role: "user", text }]);
    callApi(newApiMessages);
  }

  const showInput = !isDone && !isLoading && displayMessages.some((m) => m.role === "assistant");

  return (
    <div className="flex flex-col flex-1">
      {/* Messages */}
      <div className="flex-1 space-y-4 pb-4">
        {/* Query bubble */}
        <div className="flex justify-end">
          <div className="bg-blue-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-xs">
            {query}
          </div>
        </div>

        {displayMessages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="bg-blue-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-xs">
                  {msg.text}
                </div>
              </div>
            );
          }

          if (msg.role === "assistant") {
            return (
              <div key={i} className="flex justify-start">
                <div className="flex items-start gap-2.5 max-w-sm">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-blue-600 text-xs font-bold">C</span>
                  </div>
                  <div
                    className="bg-gray-100 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm"
                    dir="rtl"
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          }

          if (msg.role === "products" && msg.products) {
            return (
              <div key={i} className="space-y-4">
                <div className="flex justify-start">
                  <div className="flex items-start gap-2.5 max-w-sm">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-blue-600 text-xs font-bold">C</span>
                    </div>
                    <div className="bg-gray-100 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm" dir="rtl">
                      מצאתי {msg.products.length} מוצרים שמתאימים לך:
                    </div>
                  </div>
                </div>

                {msg.categoryTip && (
                  <div
                    className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-right"
                    dir="rtl"
                  >
                    <p className="text-xs text-amber-800">
                      <span className="font-semibold">טיפ: </span>
                      {msg.categoryTip}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    ...msg.products.filter((p) => p.recommended),
                    ...msg.products.filter((p) => !p.recommended),
                  ].map((product) => (
                    <ProductSelectionCard
                      key={product.name}
                      product={product}
                      originalQuery={query}
                    />
                  ))}
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-blue-600 text-xs font-bold">C</span>
              </div>
              <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2.5 max-w-sm">
              <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <span className="text-red-500 text-xs">!</span>
              </div>
              <div className="bg-red-50 border border-red-100 text-red-700 text-xs px-4 py-2.5 rounded-2xl rounded-tl-sm" dir="rtl">
                שגיאה: {error}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input form */}
      {showInput && (
        <form
          onSubmit={handleSubmit}
          className="sticky bottom-0 bg-white pt-3 pb-2 flex gap-2"
        >
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="הקלד את תשובתך..."
            dir="rtl"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            שלח
          </button>
        </form>
      )}
    </div>
  );
}
