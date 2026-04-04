"use client";

import { useState, useEffect } from "react";
import type { SiteResult, InternationalResults } from "@/app/api/international/route";

const SITE_META: Record<string, { logo: string; color: string; flag: string }> = {
  Amazon:     { logo: "amazon",     color: "text-orange-600",  flag: "🇺🇸" },
  eBay:       { logo: "ebay",       color: "text-blue-600",    flag: "🌍" },
  AliExpress: { logo: "aliexpress", color: "text-red-600",     flag: "🇨🇳" },
  Temu:       { logo: "temu",       color: "text-orange-500",  flag: "🇨🇳" },
};

interface Props {
  searchQuery: string;
}

export default function InternationalPrices({ searchQuery }: Props) {
  const [data, setData] = useState<InternationalResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/international", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchQuery }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d as InternationalResults);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [searchQuery]);

  if (loading) return <InternationalSkeleton />;
  if (error) return null; // silent fail — Zap section still shows
  if (!data) return null;

  const available = data.results.filter((r) => r.available && r.priceUSD);
  if (available.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
        מחירים בינלאומיים
      </h2>

      <div className="space-y-2">
        {data.results.map((site) => (
          <SiteRow key={site.site} site={site} usdToNis={data.usdToNis} />
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-3 text-right" dir="rtl">
        * מחירים לא כוללים מע&quot;מ (17%) ואגרות ייבוא. שער דולר: ₪{data.usdToNis.toFixed(2)}.
        הזמנות מעל $75 עשויות לחייב בנוסף מכס.
      </p>
    </section>
  );
}

function SiteRow({ site, usdToNis }: { site: SiteResult; usdToNis: number }) {
  const meta = SITE_META[site.site] ?? { color: "text-gray-600", flag: "🌐" };
  const totalUSD = (site.priceUSD ?? 0) + (site.shippingToIsraelUSD ?? 0);
  const totalNIS = totalUSD * usdToNis;

  const url = site.productUrl || `https://www.${site.site.toLowerCase()}.com/s?k=${encodeURIComponent("product")}`;

  if (!site.available || !site.priceUSD) {
    return (
      <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 opacity-50">
        <div className="flex items-center gap-2">
          <span>{meta.flag}</span>
          <span className="text-sm font-medium text-gray-500">{site.site}</span>
        </div>
        <span className="text-xs text-gray-400">לא נמצא</span>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-lg">{meta.flag}</span>
        <div>
          <p className={`text-sm font-semibold ${meta.color}`}>{site.site}</p>
          {site.note && (
            <p className="text-xs text-gray-400" dir="rtl">{site.note}</p>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-gray-900">
          ≈ ₪{Math.round(totalNIS).toLocaleString()}
        </p>
        <p className="text-xs text-gray-400">
          ${site.priceUSD.toFixed(0)}
          {site.shippingToIsraelUSD === 0
            ? " + משלוח חינם"
            : site.shippingToIsraelUSD
            ? ` + $${site.shippingToIsraelUSD} משלוח`
            : ""}
        </p>
      </div>
    </a>
  );
}

function InternationalSkeleton() {
  return (
    <section>
      <div className="h-3 w-36 bg-gray-100 rounded mb-3 animate-pulse" />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 animate-pulse">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 bg-gray-100 rounded" />
              <div className="h-4 w-20 bg-gray-100 rounded" />
            </div>
            <div className="h-4 w-16 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </section>
  );
}
