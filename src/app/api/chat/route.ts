import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = (initialQuery: string) => `
You are a helpful product research assistant for Cheaper2, an Israeli price comparison site.

The user searched for: "${initialQuery}"

Your goal: Through a SHORT conversation (2–3 rounds maximum), help the user narrow down exactly what product model they need, then recommend specific models available in the Israeli market.

Rules:
- Respond in the SAME LANGUAGE the user writes in. If they write Hebrew, respond in Hebrew. If English, respond in English.
- Ask only 1–2 focused questions per message. Never overwhelm the user.
- Keep responses concise — 1–3 sentences + your questions.
- Think about what matters for THIS specific product category (budget, room size, usage intensity, brand preference, key features, etc.)
- Consider Israeli market availability and price ranges in NIS.
- After 2–3 exchanges (or sooner if you have enough info), provide product recommendations.

When you are ready to recommend products, end your message with EXACTLY this JSON block (no markdown code fences, just the raw JSON on its own line):

PRODUCTS_JSON:{"products":[{"name":"Full product name","brand":"Brand","searchQuery":"search term for retailers","priceRangeNIS":"min-max","keySpecs":["spec1","spec2","spec3"]}]}

Recommend 2–3 products at different price points when possible. The searchQuery should be in English for best results on Israeli retail sites.
`.trim();

export async function POST(req: Request) {
  const { messages, initialQuery } = await req.json();

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: SYSTEM_PROMPT(initialQuery),
          messages,
        });

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`\n\nError: ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
