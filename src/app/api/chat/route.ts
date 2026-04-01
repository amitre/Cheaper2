import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ProductSchema } from "@/lib/products";

// Turn 1: research + catalog → exactly 5 questions
const QuestionsSchema = z.object({
  questions: z.array(z.string()).min(3).max(5),
  zapContext: z.string(),
});

// Turn 2: all answers → products (only called once, after all 5 answers)
const ProductsSchema = z.object({
  products: z.array(ProductSchema),
  categoryTip: z.string(),
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatApiRequest {
  query: string;
  messages: ChatMessage[]; // empty = first turn; 10 messages (5 Q + 5 A) = final turn
  zapContext?: string;
}

export type ChatApiResponse =
  | { type: "questions"; questions: string[]; zapContext: string }
  | { type: "products"; products: z.infer<typeof ProductSchema>[]; categoryTip: string };

// ─── System prompts ──────────────────────────────────────────────────────────

const QUESTIONS_SYSTEM = `
You are an experienced appliance store salesperson helping an Israeli customer choose a product.

STEP 1 — Research buying criteria:
  Fetch a buying guide: https://www.google.com/search?q=what+to+consider+when+buying+[product]+buying+guide
  Identify the factors that genuinely drive purchase decisions.

STEP 2 — Fetch the Zap product catalog:
  Fetch the Zap search page, find the models/category page link, fetch it.
  Understand how the catalog's product range maps to buyer needs.

STEP 3 — Return exactly 3–5 questions and the catalog.

QUESTION RULES — every question must:
  ✓ Sound like something a real salesperson would say to a customer in a store
  ✓ Be about the person's situation/lifestyle — NOT about product specs
  ✓ Cover ONE topic only, be short and easy to answer
  ✓ Offer 2–4 concrete answer options when natural

  ✗ No wattage, no "כמה כמות", no technical terms
  ✗ No repeating themes across questions (each question covers a distinct dimension)
  ✗ No questions about pipes, blockages, or maintenance issues

  Good examples:
    "כמה אנשים גרים אצלכם?"
    "אתם מבשלים הרבה בבית, או לרוב אוכל מוכן?"
    "הרעש מפריע לכם — למשל, הכיור ליד סלון?"
    "יש לכם בית פרטי או דירה?"

  zapContext format:
    ---CATALOG---
    [brand] [model] | modelid=[ID] | ₪[min]–[max] | [spec_relevant_to_questions]=[val] | ...
    (max 30 products; one per line)
`.trim();

const PRODUCTS_SYSTEM = `
You are a product advisor for Israeli consumers.
Based on the catalog and the user's answers, return exactly 3 products.

SELECTING THE 3 PRODUCTS:
  Filter the catalog using the user's answers.
  Return:
  1. CHEAPEST matching product — popularity="budget_pick"
  2. BEST-BALANCED matching product — popularity="top_seller", recommended=true
  3. BEST-SPEC / premium match — popularity="premium"
  If fewer than 3 match, pick closest alternatives.

FIELD RULES:
1. All user-facing text (bestFor, popularityLabel, recommendationReason, mainDifferentiator, categoryTip) in HEBREW
2. name + brand = official English names as on Zap
3. searchQuery = brand + model in English
4. zapUrl = "https://www.zap.co.il/model.aspx?modelid=[ID]" from catalog, or ""
5. priceMin / priceMax in NIS from catalog
6. isKeyDiff=true on 1–2 specs differentiating this from the other two
7. mainDifferentiator = single key advantage over the other two (Hebrew)
8. categoryTip = one practical buying tip for Israel (Hebrew)
`.trim();

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleQuestionsTurn(
  query: string,
  client: Anthropic
): Promise<ChatApiResponse> {
  const zapSearchUrl = `https://www.zap.co.il/search.aspx?keyword=${encodeURIComponent(query)}`;
  const guideUrl = `https://www.google.com/search?q=${encodeURIComponent(`what to consider when buying ${query} buying guide`)}`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `המשתמש רוצה לקנות: "${query}"

שלב 1 — מדריך קנייה: ${guideUrl}
שלב 2 — קטלוג זאפ: ${zapSearchUrl} (עקוב אחר קישור לדף models.aspx)

החזר 3–5 שאלות שמוכר טוב בחנות היה שואל, ואת קטלוג המוצרים.`,
    },
  ];

  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_fetch_20260209" as any, name: "web_fetch", allowed_callers: ["direct"] }],
      output_config: { format: zodOutputFormat(QuestionsSchema) },
      system: QUESTIONS_SYSTEM,
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
          console.error("[chat/questions] JSON parse failed:", e, "\nRaw:", textBlock.text.slice(0, 500));
          throw new Error("Questions turn: invalid JSON from model");
        }
        const parsed = QuestionsSchema.safeParse(rawJson);
        if (parsed.success) {
          return {
            type: "questions",
            questions: parsed.data.questions,
            zapContext: parsed.data.zapContext,
          };
        }
        console.error("[chat/questions] Schema failed:", parsed.error.issues);
        throw new Error("Questions turn: " + parsed.error.issues.map((i) => i.message).join(", "));
      }
      console.error("[chat/questions] No text block. Content types:", response.content.map((b) => b.type));
      throw new Error("Questions turn: end_turn with no text block");
    }

    throw new Error(`Questions turn: unexpected stop_reason ${response.stop_reason}`);
  }

  throw new Error("Questions turn: max attempts exceeded");
}

async function handleProductsTurn(
  query: string,
  messages: ChatMessage[],
  zapContext: string,
  client: Anthropic
): Promise<ChatApiResponse> {
  const qa = messages
    .map((m) => `${m.role === "user" ? "תשובה" : "שאלה"}: ${m.content}`)
    .join("\n");

  const userContent = `המשתמש רוצה לקנות: "${query}"

קטלוג מוצרים מזאפ:
${zapContext}

שאלות ותשובות המשתמש:
${qa}

החזר 3 מוצרים מהקטלוג שהכי מתאימים לצרכים שתוארו.`;

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    output_config: { format: zodOutputFormat(ProductsSchema) },
    system: PRODUCTS_SYSTEM,
    messages: [{ role: "user", content: userContent }],
  });

  if (!response.parsed_output) {
    throw new Error("Products turn: failed to parse");
  }

  return {
    type: "products",
    products: response.parsed_output.products.slice(0, 3),
    categoryTip: response.parsed_output.categoryTip,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body: ChatApiRequest = await req.json();
    const { query, messages, zapContext } = body;

    if (!query) {
      return Response.json({ error: "query is required" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // messages.length === 0  → get questions
    // messages.length  > 0   → get products (all answers are in)
    const result =
      messages.length === 0
        ? await handleQuestionsTurn(query, client)
        : await handleProductsTurn(query, messages, zapContext ?? "", client);

    return Response.json(result);
  } catch (err) {
    console.error("[chat API]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
