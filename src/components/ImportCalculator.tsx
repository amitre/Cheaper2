"use client";

import { useState } from "react";
import { CUSTOMS_FREE_THRESHOLD_USD, VAT_RATE, CUSTOMS_RATE } from "@/lib/retailers";

export default function ImportCalculator() {
  const [priceUSD, setPriceUSD] = useState("");
  const [shippingUSD, setShippingUSD] = useState("");
  const [exchangeRate, setExchangeRate] = useState("3.7");
  const [isElectronics, setIsElectronics] = useState(true);

  const price = parseFloat(priceUSD) || 0;
  const shipping = parseFloat(shippingUSD) || 0;
  const rate = parseFloat(exchangeRate) || 3.7;

  const totalUSD = price + shipping;
  const aboveThreshold = totalUSD > CUSTOMS_FREE_THRESHOLD_USD;
  const customsRate = aboveThreshold && !isElectronics ? CUSTOMS_RATE : 0;
  const customsDuty = totalUSD * customsRate;
  const vatBase = totalUSD + customsDuty;
  const vat = vatBase * VAT_RATE;
  const landedUSD = totalUSD + customsDuty + vat;
  const landedNIS = landedUSD * rate;

  const hasInput = price > 0;

  return (
    <div className="border border-gray-100 rounded-xl p-5 space-y-5">
      <p className="text-xs text-gray-500">
        Estimate the real cost of importing a product from abroad (Amazon, AliExpress, etc.)
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Product price (USD)</label>
          <input
            type="number"
            min="0"
            value={priceUSD}
            onChange={(e) => setPriceUSD(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Shipping (USD)</label>
          <input
            type="number"
            min="0"
            value={shippingUSD}
            onChange={(e) => setShippingUSD(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">USD → NIS rate</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col justify-between">
          <label className="text-xs text-gray-500 block mb-1">Category</label>
          <button
            type="button"
            onClick={() => setIsElectronics(!isElectronics)}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
              isElectronics
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "border-gray-200 text-gray-600"
            }`}
          >
            {isElectronics ? "Electronics (0% customs)" : "Other (12% customs)"}
          </button>
        </div>
      </div>

      {hasInput && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Product + shipping</span>
            <span className="text-gray-800">${totalUSD.toFixed(2)}</span>
          </div>
          {aboveThreshold && !isElectronics && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Customs duty (12%)</span>
              <span className="text-gray-800">${customsDuty.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">VAT (17%)</span>
            <span className="text-gray-800">${vat.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-200">
            <span className="text-gray-900">Total landed cost</span>
            <span className="text-blue-600">
              ₪{landedNIS.toFixed(0)} <span className="font-normal text-gray-400 text-xs">(${landedUSD.toFixed(2)})</span>
            </span>
          </div>
          {!aboveThreshold && (
            <p className="text-xs text-green-600">
              Under ${CUSTOMS_FREE_THRESHOLD_USD} threshold — no customs duty applies.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
