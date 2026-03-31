import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ProductSchema } from "@/lib/products";

const FirstTurnSchema = z.object({
  question: z.string(), // First clarifying question in Hebrew (about functional need, NOT price)
  zapContext: z.string(), // Full product catalog extracted from Zap — used to answer user later
  // Pre-planned second question if one is needed after the first answer (empty string = not needed)
  secondQuestion: z.string(),
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
You are a product research agent for Israeli consumers.

YOUR TASK — do these steps in order:

STEP 1 — Find the full product catalog:
  Fetch the Zap.co.il search results page for the query.
  Look for a link to a category/models listing page (models.aspx or ctg.aspx).
  Fetch that catalog page to see ALL available products with their full specs.

STEP 2 — Analyze differentiating dimensions:
  Look at the product specs across the whole range — like an e-commerce filter sidebar.
  Identify 2–4 dimensions that MOST differentiate products (e.g. motor power, noise level, capacity, usage type, connectivity, room size).
  Determine which dimensions matter most for narrowing from the full range to 3 candidates.
  Decide the MINIMUM number of questions needed (usually 1–2).
  NEVER include price/budget as a dimension to ask about.

STEP 3 — Plan and return:
  question = first clarifying question in Hebrew about the most important functional dimension.
    Keep it short, conversational, offering 2–4 concrete options if possible.
    Example format: "האם אתם מעדיפים X, Y או Z?" or "כמה [dimension]?"
  secondQuestion = the pre-planned second question to ask after getting the first answer (in Hebrew).
    Set to empty string "" if one question is enough.
  zapContext = the product catalog you extracted — formatted so it can be used later
    to match products to the user's answers WITHOUT fetching Zap again.
    Format each product on its own line:
    "[brand] [model] | modelid=[ID or empty] | ₪[priceMin]–[priceMax] | [dim1]=[val] | [dim2]=[val] | ..."
    Include ALL products you found, not just a summary.
`.trim();

const SUBSEQUENT_TURN_SYSTEM = `
You are a product advisor for Israeli consumers.

You have a product catalog extracted from Zap (in zapContext).
You have the conversation history showing what the user has told you about their needs.

DECISION:
- If the pre-planned secondQuestion was not yet asked AND it is non-empty AND you still need it, set showProducts=false and use it as your question.
- Otherwise set showProducts=true and return exactly 3 products.

SELECTING THE 3 PRODUCTS (when showProducts=true):
  Filter the catalog using the user's answers to find products that match their stated needs.
  From the matching products, pick:
  1. The CHEAPEST matching product (popularity="budget_pick")
  2. The best-balanced / most popular matching product (popularity="top_seller") — mark recommended=true
  3. The highest-spec / premium matching product (popularity="premium")
  If fewer than 3 products match, pick the closest alternatives from the catalog.

PRODUCT FIELD RULES:
1. All user-facing text (bestFor, popularityLabel, recommendationReason, mainDifferentiator, categoryTip) MUST be in HEBREW
2. name and brand = official English names exactly as on Zap
3. searchQuery = brand + model in English as sold in Israel
4. zapUrl = "https://www.zap.co.il/model.aspx?modelid=[ID]" using the modelid from zapContext, or "" if unknown
5. priceMin / priceMax in NIS from the catalog data
6. isKeyDiff=true on 1–2 specs that differentiate this product from the other two
7. mainDifferentiator = single key advantage over the other two options (Hebrew)
8. categoryTip = one practical buying tip for this category in Israel (Hebrew)
`.trim();

async function handleFirstTurn(
  query: string,
  client: Anthropic
): Promise<ChatApiResponse> {
  const zapSearchUrl = `https://www.zap.co.il/search.aspx?keyword=${encodeURIComponent(query)}`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `המשתמש רוצה לקנות: "${query}"\n\nהתחל מדף חיפוש הזאפ:\n${zapSearchUrl}\n\nעקוב אחר קישור לדף קטלוג הדגמים המלא כדי לראות את כל המוצרים והמפרטים שלהם.`,
    },
  ];

  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_fetch_20260209" as any, name: "web_fetch", allowed_callers: ["direct"] }],
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
          // Embed secondQuestion into zapContext so subsequent turns can access it
          const zapContextWithPlan = parsed.data.secondQuestion
            ? `[SECOND_QUESTION_IF_NEEDED]: ${parsed.data.secondQuestion}\n\n${parsed.data.zapContext}`
            : parsed.data.zapContext;
          return {
            type: "question",
            text: parsed.data.question,
            zapContext: zapContextWithPlan,
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

קטלוג מוצרים מזאפ (כולל שאלה שנייה מתוכננת אם קיימת):
${zapContext}

שיחה עד כה:
${conversationHistory}

החלט: האם יש לשאול את השאלה השנייה המתוכננת, או להציג 3 מוצרים מהקטלוג שמתאימים לצרכי המשתמש.`;

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
      products: data.products.slice(0, 3),
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
