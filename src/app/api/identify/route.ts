import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64 || !mimeType) {
      return Response.json({ error: "imageBase64 and mimeType required" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 128,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: imageBase64 },
            },
            {
              type: "text",
              text: `Identify the product in this image. Return ONLY the product name and model number as a short search query (e.g. "Samsung Galaxy S25", "Dyson V15 Detect", "Sony WH-1000XM5"). If it's a product category without a visible model, return the category name in Hebrew (e.g. "מזגן", "טוחן אשפה"). No explanation — just the search query.`,
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return Response.json({ query: text });
  } catch (err) {
    console.error("[identify API]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
