import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is not set.");
  console.error("Get a free key at: https://aistudio.google.com/apikey");
  process.exit(1);
}

const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const prompt =
  "A cozy café on a rainy day. Rain is falling outside the large windows, puddles on the cobblestone street reflect warm light from inside. Inside the café there are wooden tables, steaming coffee cups, and a warm ambient glow from hanging lamps. The atmosphere is peaceful and inviting.";
const style =
  "warm line art illustration, watercolor fill, off-white background, thin black outlines, soft pastel colors, emotional and tender";

const fullPrompt = `${prompt}. Style: ${style}`;

console.log("Generating image: café in the rain...");

try {
  const response = await genai.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) {
    console.error("No response from Gemini.");
    process.exit(1);
  }

  for (const part of parts) {
    if (part.inlineData) {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `rainy-cafe-${ts}.png`;
      const filepath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(filepath, Buffer.from(part.inlineData.data, "base64"));
      console.log(`Image saved to: ${filepath}`);
      process.exit(0);
    }
  }

  const textParts = parts
    .filter((p) => p.text)
    .map((p) => p.text)
    .join("\n");
  console.error(`Gemini returned text but no image:\n${textParts}`);
  process.exit(1);
} catch (err) {
  console.error(`Error generating image: ${err.message}`);
  process.exit(1);
}
