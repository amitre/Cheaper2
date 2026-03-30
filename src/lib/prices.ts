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
  searchQuery: string
): Promise<RetailerPrice[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    output_config: {
      format: zodOutputFormat(PriceResponseSchema),
    },
    system: `You are a pricing expert for the Israeli retail market.
Given a product, return estimated current prices at each retailer in NIS (including 17% VAT).

RULES:
- Set available=false and price=null if the retailer does NOT carry this specific product.
- Be CONSERVATIVE: when in doubt, set available=false. It is better to show fewer retailers than to send users to stores that don't carry the product.
- Consider each retailer's actual product category: Home Center sells home improvement/appliances (not niche imports), payngo/Machsanei Hashmal sells mainstream electronics/appliances, KSP/Bug/Ivory/iDigital sell computers & consumer electronics, Zap is a price comparison index.
- Only mark available=true if you are reasonably confident this specific product (or a direct equivalent) is actually stocked and sold by that Israeli retailer.
- Never mark available=true just because a retailer "might" carry it — require actual confidence.
- The disclaimer field must be in Hebrew, noting prices are estimates and should be verified.`,
    messages: [
      {
        role: "user",
        content: `Product: "${productName}" (search term: "${searchQuery}")
Retailers to check: ${RETAILER_NAMES}`,
      },
    ],
  });

  if (!response.parsed_output) throw new Error("Failed to parse prices");

  return response.parsed_output.prices.filter((p) => p.available && p.price !== null);
}
