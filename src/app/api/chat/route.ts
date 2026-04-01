import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ProductSchema } from "@/lib/products";

const FirstTurnSchema = z.object({
  question: z.string(), // First clarifying question in Hebrew
  zapContext: z.string(), // Full product catalog + planned question list
});

const SubsequentTurnSchema = z.object({
  showProducts: z.boolean(),
  question: z.string().optional(), // Next question (when showProducts=false)
  products: z.array(ProductSchema).optional(), // (when showProducts=true)
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

STEP 1 — Fetch the full product catalog:
  Fetch the Zap.co.il search results page for the query.
  Find the link to the category/models listing page (models.aspx or ctg.aspx) and fetch it.
  This gives you the complete product range with all specs.

STEP 2 — Identify filter dimensions:
  Study the specs across all products — like an e-commerce filter sidebar.
  Identify ALL meaningful dimensions that differentiate products
  (e.g. motor power, noise, capacity, room size, usage type, connectivity, wash temperature, spin speed, etc.)
  NEVER include price/budget as a dimension.

STEP 3 — Plan the question sequence and return:
  question = the FIRST clarifying question in Hebrew, about the single most important dimension.
    Short, conversational, offering 2–4 concrete options when possible.
    E.g.: "לאיזה שימוש בעיקר — מטבח קטן, משפחה רגילה, או שימוש אינטנסיבי?"

  zapContext = the extracted catalog PLUS a planned question list.
    Keep it CONCISE — max ~30 products, only the specs relevant to the planned questions.
    Format:
    ---CATALOG---
    [brand] [model] | modelid=[ID] | ₪[min]–[max] | [key_spec1]=[val] | [key_spec2]=[val]
    (one product per line; omit irrelevant specs; if >30 products, keep the most representative)

    ---PLANNED_QUESTIONS---
    Q2: [second question in Hebrew, or empty if not needed]
    Q3: [third question, or empty]
    Q4: [fourth question, or empty]
    (up to Q8 — only questions that genuinely help narrow down; omit empty ones)
`.trim();

const SUBSEQUENT_TURN_SYSTEM = `
You are a product advisor for Israeli consumers.

You have:
- A product catalog extracted from Zap (in the CATALOG section of zapContext)
- A pre-planned question sequence (in the PLANNED_QUESTIONS section)
- The full conversation so far

DECISION RULES (questionsAsked = number of assistant messages in the conversation):
- If questionsAsked < 8 AND the next planned question is non-empty AND it would still meaningfully help narrow down:
    → set showProducts=false, ask the next planned question (adapt it based on prior answers if needed)
- If the catalog is already narrow enough to confidently pick 3 products, OR questionsAsked >= 8:
    → set showProducts=true

SELECTING THE 3 PRODUCTS (when showProducts=true):
  Filter the catalog using ALL the user's answers to find the best matching products.
  Return exactly 3:
  1. The CHEAPEST matching product — popularity="budget_pick"
  2. The best-balanced / most popular match — popularity="top_seller", recommended=true
  3. The best-spec / premium match — popularity="premium"
  If the catalog has fewer than 3 matching products, pick the closest alternatives.

PRODUCT FIELD RULES:
1. All user-facing text (bestFor, popularityLabel, recommendationReason, mainDifferentiator, categoryTip) MUST be in HEBREW
2. name and brand = official English names exactly as shown on Zap
3. searchQuery = brand + model in English
4. zapUrl = "https://www.zap.co.il/model.aspx?modelid=[ID]" from catalog, or "" if no modelid
5. priceMin / priceMax in NIS from the catalog
6. isKeyDiff=true on 1–2 specs that differentiate this product from the other two
7. mainDifferentiator = the single most important advantage over the other two options (Hebrew)
8. categoryTip = one practical buying tip for this product category in Israel (Hebrew)
`.trim();

async function handleFirstTurn(
  query: string,
  client: Anthropic
): Promise<ChatApiResponse> {
  const zapSearchUrl = `https://www.zap.co.il/search.aspx?keyword=${encodeURIComponent(query)}`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `המשתמש רוצה לקנות: "${query}"\n\nהתחל מדף חיפוש זאפ:\n${zapSearchUrl}\n\nעקוב אחר קישור לדף קטלוג הדגמים המלא כדי לראות את כל המוצרים והמפרטים שלהם.`,
    },
  ];

  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_fetch_20260209" as any, name: "web_fetch", allowed_callers: ["direct"] }],
      output_config: { format: zodOutputFormat(FirstTurnSchema) },
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
        let rawJson: unknown;
        try {
          rawJson = JSON.parse(textBlock.text);
        } catch (e) {
          console.error("[chat/first-turn] JSON parse failed:", e, "\nRaw text (first 500):", textBlock.text.slice(0, 500));
          throw new Error("First turn: model returned invalid JSON");
        }
        const parsed = FirstTurnSchema.safeParse(rawJson);
        if (parsed.success) {
          return {
            type: "question",
            text: parsed.data.question,
            zapContext: parsed.data.zapContext,
          };
        }
        console.error("[chat/first-turn] Schema validation failed:", parsed.error.issues);
        throw new Error("First turn: schema mismatch — " + parsed.error.issues.map(i => i.message).join(", "));
      }
      console.error("[chat/first-turn] No text block found. Content types:", response.content.map(b => b.type));
      throw new Error("First turn: end_turn with no text block");
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
  const questionsAsked = messages.filter((m) => m.role === "assistant").length + 1; // +1 for first question
  const conversationHistory = messages
    .map((m) => `${m.role === "user" ? "משתמש" : "יועץ"}: ${m.content}`)
    .join("\n");

  const userContent = `משתמש רוצה לקנות: "${query}"
questionsAsked so far: ${questionsAsked}

קטלוג מוצרים ורשימת שאלות מתוכננות מזאפ:
${zapContext}

שיחה עד כה:
${conversationHistory}

החלט: לשאול שאלה נוספת מהרשימה המתוכננת, או להציג 3 מוצרים מהקטלוג שמתאימים לצרכים שתוארו.`;

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    output_config: { format: zodOutputFormat(SubsequentTurnSchema) },
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
      result = await handleSubsequentTurn(query, messages, zapContext ?? "", client);
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
