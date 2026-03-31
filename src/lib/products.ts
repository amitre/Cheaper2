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
  zapUrl: z.string(),
  priceMin: z.number(),
  priceMax: z.number(),
  keySpecs: z.array(KeySpecSchema),
  bestFor: z.string(),
  popularity: z.enum(["top_seller", "popular", "premium", "budget_pick"]).catch("popular"),
  popularityLabel: z.string(),
  recommended: z.boolean(),
  recommendationReason: z.string().optional(),
  mainDifferentiator: z.string().optional().default(""),
});

const RecommendationResponseSchema = z.object({
  products: z.array(ProductSchema),
  categoryTip: z.string(),
});

export { ProductSchema };
export type Product = z.infer<typeof ProductSchema>;
export type RecommendationResponse = z.infer<typeof RecommendationResponseSchema>;

const ZAP_SYSTEM_PROMPT = `
You are an expert product advisor for Israeli consumers.
You will fetch a Zap.co.il search page and extract a DIVERSE range of products.

RULES (non-negotiable):
1. All user-facing text (bestFor, popularityLabel, recommendationReason, mainDifferentiator, categoryTip) MUST be in HEBREW.
2. Product names and brand use the official English names as they appear on Zap.
3. searchQuery = the product name as it appears on Zap (English brand + model).
4. zapUrl = the direct URL to this product's page on Zap.co.il (e.g. https://www.zap.co.il/model.aspx?modelid=12345). Extract from search results. Empty string if not found.
5. Prices in NIS as shown on Zap (include VAT).
6. DIVERSITY IS CRITICAL: You MUST return 3–4 products representing different tiers:
   - The cheapest / most budget-friendly option available
   - The most popular / best-selling option (look for Zap's "מומלץ" or review counts)
   - A mid-range balanced option
   - A premium / highest-quality option (if exists)
   Do NOT return 4 products from the same price tier. Spread across budget → premium.
7. Mark exactly ONE product as recommended=true (best overall value for most users).
8. Set isKeyDiff=true for the 1–2 specs that most clearly separate this product from the others.
9. popularity: "top_seller" = highest reviews/sales on Zap, "popular" = widely purchased, "premium" = high-end, "budget_pick" = cheapest/best value.
10. mainDifferentiator = single most important advantage over the other options (Hebrew, 1 sentence).
11. categoryTip = one practical buying tip for this category in Israel (Hebrew, 1–2 sentences).
`.trim();

const AI_FALLBACK_PROMPT = `
You are an expert product advisor for Israeli consumers.

RULES (non-negotiable):
1. All user-facing text (bestFor, popularityLabel, recommendationReason, mainDifferentiator, categoryTip) MUST be in HEBREW.
2. Product names and brand use the official English names.
3. searchQuery = brand + model in English as sold in Israel.
4. zapUrl = empty string.
5. Prices in NIS reflect actual Israeli retail prices including 17% VAT.
6. Recommend 2–4 products that are actually sold in Israeli stores. Do not recommend niche imports.
7. Mark exactly ONE product as recommended=true (best overall value).
8. Set isKeyDiff=true only for specs that clearly differentiate this product from others.
9. popularity: "top_seller" = Zap bestseller, "popular" = widely purchased, "premium" = high-end, "budget_pick" = best value.
10. mainDifferentiator = single most important advantage over the others (Hebrew, 1 sentence).
11. categoryTip = one practical buying tip for this category in Israel (Hebrew, 1–2 sentences).
`.trim();

async function generateProductsFromZap(
  query: string,
  client: Anthropic
): Promise<RecommendationResponse> {
  const zapSearchUrl = `https://www.zap.co.il/search.aspx?keyword=${encodeURIComponent(query)}`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `The user wants to buy: "${query}"\n\nFetch this Zap.co.il search page:\n${zapSearchUrl}\n\nFrom the search results, extract 3–4 products that SPAN different price points — budget, mid-range, and premium. Do NOT pick 4 similar products. Look for the cheapest option, the most popular/reviewed, and the highest quality. For each, extract the Zap product page URL (model.aspx?modelid=...).`,
    },
  ];

  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_fetch_20260209" as any, name: "web_fetch", allowed_callers: ["direct"] }],
      output_config: {
        format: zodOutputFormat(RecommendationResponseSchema),
      },
      system: ZAP_SYSTEM_PROMPT,
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
        const parsed = RecommendationResponseSchema.safeParse(
          JSON.parse(textBlock.text)
        );
        if (parsed.success && parsed.data.products.length > 0) {
          return parsed.data;
        }
      }
    }

    throw new Error(`Zap fetch ended with stop_reason: ${response.stop_reason}`);
  }

  throw new Error("Zap fetch: max attempts exceeded");
}

async function generateProductsFromAI(
  query: string,
  client: Anthropic
): Promise<RecommendationResponse> {
  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    output_config: {
      format: zodOutputFormat(RecommendationResponseSchema),
    },
    system: AI_FALLBACK_PROMPT,
    messages: [
      {
        role: "user",
        content: `The user is looking to buy: "${query}"\n\nRecommend the best products available in the Israeli market.`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Failed to parse AI product recommendations");
  }

  return response.parsed_output;
}

export async function generateProducts(
  query: string
): Promise<RecommendationResponse> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    return await generateProductsFromZap(query, client);
  } catch (err) {
    console.warn("[products] Zap fetch failed, falling back to AI:", err instanceof Error ? err.message : err);
    return await generateProductsFromAI(query, client);
  }
}
