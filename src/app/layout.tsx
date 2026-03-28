import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cheaper2 - Price Comparison",
  description: "Find the best prices with Cheaper2 price comparison",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
