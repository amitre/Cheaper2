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
You are an experienced appliance store salesperson helping an Israeli customer.

STEP 1 — Research what really matters when buying this product:
  Fetch: https://www.google.com/search?q=what+to+consider+when+buying+[product+in+English]+buying+guide
  Extract the factors that genuinely drive buyer decisions — household size, cooking habits,
  space constraints, noise sensitivity, specific use cases, etc.

STEP 2 — Fetch the Zap product catalog:
  Fetch the Zap.co.il search page, find the models/category page, and fetch it.
  Understand how catalog differences (power, capacity, noise, size, etc.) map to real buyer needs.

STEP 3 — Plan the questions:

  GOLDEN RULE: Would a salesperson actually say this sentence to a customer in a store?
  If it sounds clinical, awkward, or like a survey — rewrite it.

  STRICT RULES for every question:
  ✓ One simple topic per question — never combine two questions in one sentence
  ✓ Sounds like natural spoken Hebrew, not a form or spec sheet
  ✓ Asks about the person's LIFE/SITUATION, not about product features
  ✓ Concrete, easy to answer — ideally with 2–3 clear options
  ✗ NEVER ask about quantity of trash, wattage, specs, or technical measurements
  ✗ NEVER ask "כמה כמות X יוצרים" — ask about context instead

  Good salesperson questions (real examples by category):
  - Garbage disposal: "כמה אנשים גרים אצלכם?" / "אתם מבשלים הרבה בבית?" / "הרעש מפריע לכם?"
  - Air conditioner: "לאיזה חדר — כמה גדול בערך?" / "מה הקומה ומיקום הדירה?"
  - Washing machine: "כמה נפשות יש בבית?" / "יש לכם תינוק או ילדים קטנים?"
  - Headphones: "למה תשתמשו בהם בעיקר?" / "אתם נוסעים הרבה?"

  question = the first question. ONE topic. SHORT. Natural Hebrew. Easy to answer.

  zapContext = compact catalog + criteria + planned follow-up questions.
    Format:
    ---BUYING_CRITERIA---
    [bullet list of key need-based factors in English, mapped to catalog specs]

    ---CATALOG---
    [brand] [model] | modelid=[ID] | ₪[min]–[max] | [relevant_spec]=[val] | ...
    (max 30 products; only specs that relate to buying criteria)

    ---PLANNED_QUESTIONS---
    Q2: [next question — must pass the "would a salesperson say this?" test]
    Q3: ...
    (up to Q8; only include what genuinely helps; omit if not needed)
`.trim();

const SUBSEQUENT_TURN_SYSTEM = `
You are a product advisor for Israeli consumers.

You have:
- A product catalog extracted from Zap (in the CATALOG section of zapContext)
- A pre-planned question sequence (in the PLANNED_QUESTIONS section)
- The full conversation so far

DECISION RULES (questionsAsked = number of assistant messages in the conversation):
- If questionsAsked < 8 AND the next planned question is non-empty AND it would still meaningfully help narrow down:
    → set showProducts=false, ask the next planned question.
      Before asking: verify it passes the "would a salesperson say this?" test.
      Adapt the wording based on prior answers. Keep it ONE topic, SHORT, natural Hebrew.
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
      content: `המשתמש רוצה לקנות: "${query}"

שלב 1 — חפש מדריך קנייה:
${`https://www.google.com/search?q=${encodeURIComponent(`what to consider when buying ${query} buying guide`)}`}

שלב 2 — לאחר מכן חפש את קטלוג המוצרים בזאפ:
${zapSearchUrl}
עקוב אחר קישור לדף הדגמים המלא (models.aspx) כדי לראות את כל המוצרים.`,
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
