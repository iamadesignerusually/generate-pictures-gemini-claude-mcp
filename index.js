import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ENV_PATH = path.join(__dirname, ".env");

const SETUP_GUIDE = [
  "## Gemini API Key fehlt!",
  "",
  "Um Bilder zu generieren, brauchst du einen kostenlosen Google Gemini API Key.",
  "Das dauert nur 1 Minute:",
  "",
  "1. Öffne https://aistudio.google.com/apikey",
  "2. Melde dich mit deinem Google-Konto an",
  '3. Klicke auf "Create API Key"',
  "4. Kopiere den Key",
  `5. Erstelle eine Datei \`${ENV_PATH}\` mit folgendem Inhalt:`,
  "",
  "```",
  "GEMINI_API_KEY=dein-key-hier-einfügen",
  "```",
  "",
  "Alternativ kannst du den Key auch direkt in der Claude Desktop Config setzen",
  "(unter `env.GEMINI_API_KEY` im MCP-Server-Eintrag).",
  "",
  "Danach Claude Desktop neu starten — fertig! Der Free Tier ist kostenlos",
  "und reicht für normale Nutzung vollkommen aus.",
].join("\n");

function assertApiKey() {
  if (!GEMINI_API_KEY) {
    return {
      content: [{ type: "text", text: SETUP_GUIDE }],
      isError: true,
    };
  }
  return null;
}

const genai = GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  : null;

const DEFAULT_STYLE =
  "warm line art illustration, watercolor fill, off-white background, thin black outlines, soft pastel colors, emotional and tender";

const MODEL = "gemini-2.0-flash-exp";

function generateFilename(prefix) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${ts}.png`;
}

async function saveImage(base64Data, prefix) {
  const filename = generateFilename(prefix);
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(base64Data, "base64"));
  return filepath;
}

// --- MCP Server ---

const server = new McpServer({
  name: "image-mcp",
  version: "1.0.0",
});

server.tool(
  "generate_image",
  "Generate an image from a text prompt using Google Gemini. Returns the generated image saved locally.",
  {
    prompt: z.string().describe("Text description of the image to generate"),
    style: z
      .string()
      .optional()
      .describe(
        `Style guide appended to the prompt. Defaults to: "${DEFAULT_STYLE}"`
      ),
  },
  async ({ prompt, style }) => {
    const missing = assertApiKey();
    if (missing) return missing;

    const fullPrompt = `${prompt}. Style: ${style || DEFAULT_STYLE}`;

    try {
      const response = await genai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts) {
        return {
          content: [{ type: "text", text: "No response from Gemini." }],
        };
      }

      for (const part of parts) {
        if (part.inlineData) {
          const filepath = await saveImage(
            part.inlineData.data,
            "generated"
          );
          const imageData = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || "image/png";

          return {
            content: [
              {
                type: "image",
                data: imageData,
                mimeType,
              },
              {
                type: "text",
                text: `Image saved to: ${filepath}`,
              },
            ],
          };
        }
      }

      const textParts = parts
        .filter((p) => p.text)
        .map((p) => p.text)
        .join("\n");
      return {
        content: [
          {
            type: "text",
            text: `Gemini returned text but no image:\n${textParts}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error generating image: ${err.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "edit_image",
  "Edit an existing image using Google Gemini. Provide a local file path or URL and an editing instruction.",
  {
    image_path: z
      .string()
      .describe("Local file path or URL of the image to edit"),
    instruction: z
      .string()
      .describe(
        'Editing instruction, e.g. "replace the countertop with marble"'
      ),
  },
  async ({ image_path, instruction }) => {
    const missing = assertApiKey();
    if (missing) return missing;

    try {
      let imageData;
      let mimeType = "image/png";

      if (image_path.startsWith("http://") || image_path.startsWith("https://")) {
        const response = await fetch(image_path);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const contentType = response.headers.get("content-type");
        if (contentType) mimeType = contentType.split(";")[0];
        const arrayBuffer = await response.arrayBuffer();
        imageData = Buffer.from(arrayBuffer).toString("base64");
      } else {
        const resolvedPath = path.resolve(image_path);
        if (!fs.existsSync(resolvedPath)) {
          throw new Error(`File not found: ${resolvedPath}`);
        }
        const ext = path.extname(resolvedPath).toLowerCase();
        if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
        else if (ext === ".webp") mimeType = "image/webp";
        else if (ext === ".gif") mimeType = "image/gif";
        imageData = fs.readFileSync(resolvedPath).toString("base64");
      }

      const response = await genai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: imageData,
                  mimeType,
                },
              },
              {
                text: instruction,
              },
            ],
          },
        ],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts) {
        return {
          content: [{ type: "text", text: "No response from Gemini." }],
        };
      }

      for (const part of parts) {
        if (part.inlineData) {
          const filepath = await saveImage(part.inlineData.data, "edited");
          const outMime = part.inlineData.mimeType || "image/png";

          return {
            content: [
              {
                type: "image",
                data: part.inlineData.data,
                mimeType: outMime,
              },
              {
                type: "text",
                text: `Edited image saved to: ${filepath}`,
              },
            ],
          };
        }
      }

      const textParts = parts
        .filter((p) => p.text)
        .map((p) => p.text)
        .join("\n");
      return {
        content: [
          {
            type: "text",
            text: `Gemini returned text but no image:\n${textParts}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error editing image: ${err.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("image-mcp server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
