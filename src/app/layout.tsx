import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cheaper2 — Israeli Price Comparison",
  description: "Compare product prices across major Israeli retailers including Zap, KSP, iDigital, Ivory, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-white">{children}</body>
    </html>
  );
}
