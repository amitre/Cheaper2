import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const SiteResultSchema = z.object({
  site: z.string(),           // "Amazon", "eBay", etc.
  available: z.boolean(),
  priceUSD: z.number().optional(),
  shippingToIsraelUSD: z.number().optional(), // 0 = free
  productUrl: z.string().optional(),
  note: z.string().optional(), // short Hebrew note, e.g. "משלוח חינם 3–4 שבועות"
});

const InternationalResultsSchema = z.object({
  results: z.array(SiteResultSchema),
  usdToNis: z.number(), // exchange rate used
});

export type SiteResult = z.infer<typeof SiteResultSchema>;
export type InternationalResults = z.infer<typeof InternationalResultsSchema>;

const SYSTEM_PROMPT = `
You are a price research agent. Search for a product on multiple international shopping sites
and extract real prices using web_fetch.

For each site below, fetch the search results page and extract:
- The first relevant matching product's price in USD
- Whether international shipping to Israel is available
- Typical shipping cost to Israel in USD (0 = free)
- Direct URL to the product or search results page
- A short Hebrew note about shipping time/conditions

Sites to search:
1. Amazon: https://www.amazon.com/s?k=[encoded query]
2. eBay: https://www.ebay.com/sch/i.html?_nkw=[encoded query]&LH_Sold=0
3. AliExpress: https://www.aliexpress.com/wholesale?SearchText=[encoded query]
4. Temu: https://www.temu.com/search_result.html?search_key=[encoded query]

Typical shipping costs to Israel when not listed:
- Amazon: $15–35 for electronics via standard international shipping
- eBay: $10–25 depending on seller location
- AliExpress: free or $3–8 (AliExpress Standard Shipping, 2–4 weeks)
- Temu: free shipping on orders over ~$20, 7–15 days

usdToNis: use 3.65 (approximate current rate)

If a product is not found or the site is unavailable, set available=false.
Always include all 4 sites in results even if unavailable.
`.trim();

export async function POST(req: Request) {
  try {
    const { searchQuery } = await req.json() as { searchQuery: string };
    if (!searchQuery) {
      return Response.json({ error: "searchQuery required" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const encoded = encodeURIComponent(searchQuery);

    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `חפש את המוצר הבא באתרים בינלאומיים: "${searchQuery}"

Amazon:     https://www.amazon.com/s?k=${encoded}
eBay:       https://www.ebay.com/sch/i.html?_nkw=${encoded}
AliExpress: https://www.aliexpress.com/wholesale?SearchText=${encoded}
Temu:       https://www.temu.com/search_result.html?search_key=${encoded}

חלץ מחירים, עלויות משלוח לישראל, וקישורים לכל אתר.`,
      },
    ];

    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 8192,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [{ type: "web_fetch_20260209" as any, name: "web_fetch", allowed_callers: ["direct"] }],
        output_config: { format: zodOutputFormat(InternationalResultsSchema) },
        system: SYSTEM_PROMPT,
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
          const parsed = InternationalResultsSchema.safeParse(JSON.parse(textBlock.text));
          if (parsed.success) {
            return Response.json(parsed.data);
          }
          console.error("[international] schema error:", parsed.error.issues);
          throw new Error("Schema mismatch: " + parsed.error.issues.map(i => i.message).join(", "));
        }
        throw new Error("No text block in response");
      }

      throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
    }

    throw new Error("Max attempts exceeded");
  } catch (err) {
    console.error("[international API]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
