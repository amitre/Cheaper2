import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { retailers } from "./retailers";

const RetailerPriceSchema = z.object({
  retailerName: z.string(),
  price: z.number().nullable(),
  available: z.boolean(),
  note: z.string().optional(),
  url: z.string().optional(), // Direct link from Zap to the retailer product page
});

const PriceResponseSchema = z.object({
  prices: z.array(RetailerPriceSchema),
  disclaimer: z.string(),
});

export type RetailerPrice = z.infer<typeof RetailerPriceSchema>;

const RETAILER_NAMES = retailers.map((r) => r.name).join(", ");

async function getPricesFromZap(
  productName: string,
  zapUrl: string,
  client: Anthropic
): Promise<RetailerPrice[]> {
  const isSearchUrl = zapUrl.includes("/search.aspx");

  const userContent = isSearchUrl
    ? `Fetch this Zap.co.il search page:\n${zapUrl}\n\nFind the product "${productName}" in the results. Then fetch its Zap product page (model.aspx URL) to get the full list of retailers and prices. Return every retailer with their price and direct link to the product on their site.`
    : `Fetch this Zap product page:\n${zapUrl}\n\nExtract all retailer prices for "${productName}". Return every retailer listed with their price and direct link to the product on their site.`;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userContent }];

  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_fetch_20260209" as any, name: "web_fetch" }],
      output_config: {
        format: zodOutputFormat(PriceResponseSchema),
      },
      system: `You are a price extraction expert for the Israeli market.
Fetch the Zap product page and extract all retailer prices shown.
- retailerName = the retailer's name as shown on Zap (in Hebrew or English)
- price = the price in NIS (number only, no ₪ sign)
- available = true for all retailers with a valid price
- url = the direct link to the product page on that retailer's site (if shown on Zap)
- disclaimer must be in Hebrew: "המחירים נלקחו מזאפ ועשויים להשתנות — לחץ לאימות"`,
      messages,
    });

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      if (textBlock) {
        const parsed = PriceResponseSchema.safeParse(
          JSON.parse(textBlock.text)
        );
        if (parsed.success) {
          return parsed.data.prices.filter(
            (p) => p.available && p.price !== null
          );
        }
      }
    }

    throw new Error(`Zap prices: unexpected stop_reason ${response.stop_reason}`);
  }

  throw new Error("Zap prices: max attempts exceeded");
}

async function getPricesFromAI(
  productName: string,
  searchQuery: string,
  client: Anthropic
): Promise<RetailerPrice[]> {
  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    output_config: {
      format: zodOutputFormat(PriceResponseSchema),
    },
    system: `You are a pricing expert for the Israeli retail market.
Given a product, return estimated current prices at each retailer in NIS (including 17% VAT).
- Set available=false and price=null if the retailer does NOT carry this product.
- Be conservative: when in doubt, set available=false.
- The disclaimer field must be in Hebrew, noting prices are estimates.`,
    messages: [
      {
        role: "user",
        content: `Product: "${productName}" (search term: "${searchQuery}")\nRetailers to check: ${RETAILER_NAMES}`,
      },
    ],
  });

  if (!response.parsed_output) throw new Error("Failed to parse prices");

  return response.parsed_output.prices.filter(
    (p) => p.available && p.price !== null
  );
}

export async function getPrices(
  productName: string,
  searchQuery: string,
  zapUrl?: string
): Promise<RetailerPrice[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Use provided zapUrl, or fall back to a Zap search for this specific product
  const effectiveZapUrl =
    zapUrl ||
    `https://www.zap.co.il/search.aspx?keyword=${encodeURIComponent(productName || searchQuery)}`;

  try {
    return await getPricesFromZap(productName, effectiveZapUrl, client);
  } catch (err) {
    console.warn("[prices] Zap fetch failed, falling back to AI:", err instanceof Error ? err.message : err);
    return await getPricesFromAI(productName, searchQuery, client);
  }
}
