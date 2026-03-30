import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const KeySpecSchema = z.object({
  label: z.string(),
  value: z.string(),
  isKeyDiff: z.boolean(),
});

const ProductSchema = z.object({
  name: z.string(),
  brand: z.string(),
  searchQuery: z.string(),
  priceMin: z.number(),
  priceMax: z.number(),
  keySpecs: z.array(KeySpecSchema),
  bestFor: z.string(),
  popularity: z.enum(["top_seller", "popular", "premium", "budget_pick"]),
  popularityLabel: z.string(),
  recommended: z.boolean(),
  recommendationReason: z.string().optional(),
  mainDifferentiator: z.string(),
});

const RecommendationResponseSchema = z.object({
  products: z.array(ProductSchema),
  categoryTip: z.string(),
});

export type Product = z.infer<typeof ProductSchema>;
export type RecommendationResponse = z.infer<typeof RecommendationResponseSchema>;

const SYSTEM_PROMPT = `
You are an expert product advisor for Israeli consumers.

RULES (non-negotiable):
1. All user-facing text (bestFor, popularityLabel, recommendationReason, mainDifferentiator, categoryTip) MUST be in HEBREW.
2. Product names and brand use the official English names.
3. searchQuery = the optimal Hebrew search term for Israeli retailer sites (Zap, KSP, payngo, etc.). Use Hebrew words for the product category. For well-known international brands, you may keep the brand name in English followed by the Hebrew category (e.g. "InSinkErator טוחן פסולת", "Dyson שואב אבק"). Avoid English-only generic terms that Israeli sites won't recognize.
4. Prices in NIS reflect actual current Israeli retail prices including 17% VAT.
5. Recommend 2–4 products at different price points.
6. Mark exactly ONE product as recommended=true (the best overall value for most users).
7. Set isKeyDiff=true only for specs that clearly differentiate this product from the others in the list.
8. popularity values: "top_seller" = Zap bestseller, "popular" = widely purchased, "premium" = high-end, "budget_pick" = best value.
9. mainDifferentiator = the single most important advantage this product has over the others (Hebrew, 1 sentence).
10. categoryTip = one practical buying tip specific to this product category in Israel (Hebrew, 1–2 sentences).
`.trim();

export async function generateProducts(query: string): Promise<RecommendationResponse> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    output_config: {
      format: zodOutputFormat(RecommendationResponseSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `The user is looking to buy: "${query}"\n\nRecommend the best products available in the Israeli market.`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Failed to parse product recommendations");
  }

  return response.parsed_output;
}
