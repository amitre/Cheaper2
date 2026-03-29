"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ProductComparison, { type Product } from "./ProductComparison";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function parseProducts(text: string): { clean: string; products: Product[] | null } {
  const marker = "PRODUCTS_JSON:";
  const idx = text.indexOf(marker);
  if (idx === -1) return { clean: text, products: null };

  const clean = text.slice(0, idx).trim();
  const jsonStr = text.slice(idx + marker.length).trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return { clean, products: parsed.products ?? null };
  } catch {
    return { clean, products: null };
  }
}

function MessageBubble({ msg }: { msg: Message }) {
  const { clean } = parseProducts(msg.content);
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-gray-100 text-gray-800 rounded-bl-sm"
        }`}
      >
        {clean}
      </div>
    </div>
  );
}

export default function ChatResearch({ initialQuery }: { initialQuery: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () =>
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const sendMessage = useCallback(
    async (userContent: string, currentMessages: Message[]) => {
      const newMessages: Message[] = [
        ...currentMessages,
        { role: "user", content: userContent },
      ];
      setMessages(newMessages);
      setIsStreaming(true);

      const assistantMessage: Message = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages,
            initialQuery,
          }),
        });

        if (!res.ok || !res.body) throw new Error("Failed to connect");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: fullText,
            };
            return updated;
          });
        }

        // Extract products if present
        const { products: foundProducts } = parseProducts(fullText);
        if (foundProducts) setProducts(foundProducts);
      } catch (err) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
          };
          return updated;
        });
      } finally {
        setIsStreaming(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [initialQuery]
  );

  // Auto-start with the initial query
  useEffect(() => {
    if (!started && initialQuery) {
      setStarted(true);
      sendMessage(initialQuery, []);
    }
  }, [started, initialQuery, sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage(text, messages);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="/" className="text-lg font-bold text-blue-600 shrink-0">
            Cheaper2
          </a>
          <span className="text-gray-300">›</span>
          <span className="text-sm text-gray-500 truncate">
            Researching: <span className="text-gray-800 font-medium">{initialQuery}</span>
          </span>
        </div>
      </header>

      {/* Chat area */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {/* Streaming indicator */}
          {isStreaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}

          {/* Product comparison — shown when assistant provides recommendations */}
          {products && !isStreaming && (
            <ProductComparison products={products} />
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming}
            placeholder={
              products
                ? "Ask a follow-up question..."
                : "Type your answer..."
            }
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
