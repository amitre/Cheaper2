import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ProductSchema } from "@/lib/products";

const FirstTurnSchema = z.object({
  question: z.string(), // First clarifying question in Hebrew
  zapContext: z.string(), // Summary of Zap findings for use in subsequent turns
});

const SubsequentTurnSchema = z.object({
  showProducts: z.boolean(),
  question: z.string().optional(), // Next question (when showProducts=false)
  products: z.array(ProductSchema).optional(), // Final product list (when showProducts=true)
  categoryTip: z.string().optional(),
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatApiRequest {
  query: string;
  messages: ChatMessage[];
  zapContext?: string;
}

export type ChatApiResponse =
  | { type: "question"; text: string; zapContext?: string }
  | { type: "products"; products: z.infer<typeof ProductSchema>[]; categoryTip: string };

const FIRST_TURN_SYSTEM = `
You are a helpful product advisor for Israeli consumers using a chat interface.

Your job:
1. Fetch the Zap.co.il search page to see what products are available
2. Ask the user ONE focused clarifying question in Hebrew to help narrow down the best option

Rules:
- question must be in Hebrew, conversational, 1 sentence
- zapContext must briefly summarize what you found: product categories, price range (e.g., "מצאתי 8 מזגנים בטווח ₪1,500–₪6,000, כולל אפשרויות של Electra, Samsung ו-Tadiran")
- Keep it natural and friendly
`.trim();

const SUBSEQUENT_TURN_SYSTEM = `
You are a helpful product advisor for Israeli consumers.

Based on the user's answers, decide:
- If you need ONE more clarification (and fewer than 3 questions were already asked), set showProducts=false and provide a short Hebrew question
- Otherwise, set showProducts=true and return 2–3 products from Zap that best match what the user described

Product rules (when showProducts=true):
1. All user-facing text (bestFor, popularityLabel, recommendationReason, mainDifferentiator, categoryTip) MUST be in HEBREW
2. Product names and brand use the official English names as on Zap
3. searchQuery = brand + model as sold in Israel
4. zapUrl = direct Zap model page URL (model.aspx?modelid=...) extracted from zapContext, or empty string
5. Prices in NIS including 17% VAT
6. Mark exactly ONE as recommended=true
7. Set isKeyDiff=true for 1–2 specs that differentiate products
8. popularity: "top_seller", "popular", "premium", or "budget_pick"
9. mainDifferentiator = single most important advantage over the others (Hebrew)
10. categoryTip = one practical buying tip for this category in Israel (Hebrew)
`.trim();

async function handleFirstTurn(
  query: string,
  client: Anthropic
): Promise<ChatApiResponse> {
  const zapSearchUrl = `https://www.zap.co.il/search.aspx?keyword=${encodeURIComponent(query)}`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `המשתמש רוצה לקנות: "${query}"\n\nאנא אסוף מידע מזאפ:\n${zapSearchUrl}\n\nלאחר מכן שאל שאלה ראשונה אחת כדי לעזור לצמצם אפשרויות.`,
    },
  ];

  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_fetch_20260209" as any, name: "web_fetch" }],
      output_config: {
        format: zodOutputFormat(FirstTurnSchema),
      },
      system: FIRST_TURN_SYSTEM,
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
        const parsed = FirstTurnSchema.safeParse(JSON.parse(textBlock.text));
        if (parsed.success) {
          return {
            type: "question",
            text: parsed.data.question,
            zapContext: parsed.data.zapContext,
          };
        }
      }
    }

    throw new Error(`First turn: unexpected stop_reason ${response.stop_reason}`);
  }

  throw new Error("First turn: max attempts exceeded");
}

async function handleSubsequentTurn(
  query: string,
  messages: ChatMessage[],
  zapContext: string,
  client: Anthropic
): Promise<ChatApiResponse> {
  const conversationHistory = messages
    .map((m) => `${m.role === "user" ? "משתמש" : "יועץ"}: ${m.content}`)
    .join("\n");

  const userContent = `משתמש רוצה לקנות: "${query}"

מידע שנאסף מזאפ:
${zapContext}

שיחה עד כה:
${conversationHistory}

על סמך תשובות המשתמש, החלט אם צריך עוד שאלה אחת או שניתן להציג המלצות מוצרים.`;

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    output_config: {
      format: zodOutputFormat(SubsequentTurnSchema),
    },
    system: SUBSEQUENT_TURN_SYSTEM,
    messages: [{ role: "user", content: userContent }],
  });

  if (!response.parsed_output) {
    throw new Error("Failed to parse chat response");
  }

  const data = response.parsed_output;

  if (data.showProducts && data.products && data.products.length > 0) {
    return {
      type: "products",
      products: data.products,
      categoryTip: data.categoryTip ?? "",
    };
  }

  return {
    type: "question",
    text: data.question ?? "האם יש משהו נוסף שחשוב לך במוצר?",
  };
}

export async function POST(req: Request) {
  try {
    const body: ChatApiRequest = await req.json();
    const { query, messages, zapContext } = body;

    if (!query) {
      return Response.json({ error: "query is required" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let result: ChatApiResponse;
    if (messages.length === 0) {
      result = await handleFirstTurn(query, client);
    } else {
      result = await handleSubsequentTurn(
        query,
        messages,
        zapContext ?? "",
        client
      );
    }

    return Response.json(result);
  } catch (err) {
    console.error("[chat API]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
