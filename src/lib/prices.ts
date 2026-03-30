import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { retailers } from "./retailers";

const RetailerPriceSchema = z.object({
  retailerName: z.string(),
  price: z.number().nullable(),
  available: z.boolean(),
  note: z.string().optional(),
});

const PriceResponseSchema = z.object({
  prices: z.array(RetailerPriceSchema),
  disclaimer: z.string(),
});

export type RetailerPrice = z.infer<typeof RetailerPriceSchema>;

const RETAILER_NAMES = retailers.map((r) => r.name).join(", ");

export async function getPrices(
  productName: string,
  searchQuery: string,
  availableAt: string[] = []
): Promise<RetailerPrice[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const retailersToCheck = availableAt.length > 0 ? availableAt.join(", ") : RETAILER_NAMES;

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    output_config: {
      format: zodOutputFormat(PriceResponseSchema),
    },
    system: `You are a pricing expert for the Israeli retail market.
Given a product, return estimated current prices at each retailer in NIS (including 17% VAT).

RULES:
- These retailers are known to carry this product — provide a realistic price for each.
- Set available=false and price=null only if you have strong reason to believe a specific listed retailer does NOT stock this exact product.
- Prices must be realistic NIS amounts based on your knowledge of the Israeli market.
- The disclaimer field must be in Hebrew, noting prices are estimates and should be verified.`,
    messages: [
      {
        role: "user",
        content: `Product: "${productName}" (search term: "${searchQuery}")
Retailers to check: ${retailersToCheck}`,
      },
    ],
  });

  if (!response.parsed_output) throw new Error("Failed to parse prices");

  return response.parsed_output.prices.filter((p) => p.available && p.price !== null);
}
