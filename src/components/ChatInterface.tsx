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
  const [display, setDisplay] = useState<DisplayMessage[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<ChatMessage[]>([]);
  const [zapContext, setZapContext] = useState("");
  const [currentQ, setCurrentQ] = useState(0); // index into questions[]
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const didInitRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [display, isLoading, currentQ]);

  // First call: get questions
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchQuestions() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, messages: [], zapContext: "" }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data: ChatApiResponse = await res.json();
      if (data.type !== "questions") throw new Error("Expected questions response");

      setQuestions(data.questions);
      setZapContext(data.zapContext);
      // Show first question
      setDisplay([{ role: "assistant", text: data.questions[0] }]);
      setCurrentQ(0);
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchProducts(allAnswers: ChatMessage[]) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, messages: allAnswers, zapContext }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data: ChatApiResponse = await res.json();
      if (data.type !== "products") throw new Error("Expected products response");

      setDisplay((prev) => [
        ...prev,
        { role: "products", products: data.products, categoryTip: data.categoryTip },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue("");

    const userMsg: ChatMessage = { role: "user", content: text };
    const newAnswers = [...answers, userMsg];
    setAnswers(newAnswers);

    const nextQ = currentQ + 1;

    setDisplay((prev) => [
      ...prev,
      { role: "user", text },
      ...(nextQ < questions.length
        ? [{ role: "assistant" as const, text: questions[nextQ] }]
        : []),
    ]);

    if (nextQ < questions.length) {
      // More questions to ask locally — no API call
      setCurrentQ(nextQ);
      // Build full messages array: interleave questions (assistant) and answers (user)
      const fullMessages: ChatMessage[] = [];
      for (let i = 0; i <= currentQ; i++) {
        fullMessages.push({ role: "assistant", content: questions[i] });
        if (i < newAnswers.length) fullMessages.push(newAnswers[i]);
      }
      setAnswers(fullMessages.filter((m) => m.role === "user"));
      inputRef.current?.focus();
    } else {
      // All questions answered — fetch products
      const fullMessages: ChatMessage[] = [];
      for (let i = 0; i < questions.length; i++) {
        fullMessages.push({ role: "assistant", content: questions[i] });
        if (i < newAnswers.length) fullMessages.push(newAnswers[i]);
      }
      fetchProducts(fullMessages);
    }
  }

  const showInput =
    !isLoading &&
    questions.length > 0 &&
    currentQ < questions.length &&
    !display.some((m) => m.role === "products");

  const progress = questions.length > 0 ? `${Math.min(currentQ + 1, questions.length)}/${questions.length}` : null;

  return (
    <div className="flex flex-col flex-1">
      <div className="flex-1 space-y-4 pb-4">
        {/* Query bubble */}
        <div className="flex justify-end">
          <div className="bg-blue-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-xs">
            {query}
          </div>
        </div>

        {display.map((msg, i) => {
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
                  <div className="bg-gray-100 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm" dir="rtl">
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
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-blue-600 text-xs font-bold">C</span>
                    </div>
                    <div className="bg-gray-100 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm" dir="rtl">
                      מצאתי {msg.products.length} מוצרים שמתאימים לך:
                    </div>
                  </div>
                </div>
                {msg.categoryTip && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-right" dir="rtl">
                    <p className="text-xs text-amber-800">
                      <span className="font-semibold">טיפ: </span>{msg.categoryTip}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    ...msg.products.filter((p) => p.recommended),
                    ...msg.products.filter((p) => !p.recommended),
                  ].map((product) => (
                    <ProductSelectionCard key={product.name} product={product} originalQuery={query} />
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })}

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

      {showInput && (
        <form onSubmit={handleSubmit} className="sticky bottom-0 bg-white pt-3 pb-2">
          {progress && (
            <p className="text-xs text-gray-400 text-right mb-1.5" dir="rtl">
              שאלה {progress}
            </p>
          )}
          <div className="flex gap-2">
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
          </div>
        </form>
      )}
    </div>
  );
}
