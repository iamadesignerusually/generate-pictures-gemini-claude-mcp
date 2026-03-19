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

const SERVER_DIR = __dirname;

// ---------------------------------------------------------------------------
// Onboarding guide shown as an MCP prompt when the server is first connected.
// English, step-by-step, with all links.
// ---------------------------------------------------------------------------
const ONBOARDING_GUIDE = [
  "# Welcome to image-mcp!",
  "",
  "This MCP server lets you **generate and edit images** using Google Gemini — right from Claude.",
  "",
  "Before you can use it, you need a **(free) Gemini API key**. Here's how to set it up:",
  "",
  "---",
  "",
  "## Step 1 — Get a free Gemini API key",
  "",
  "1. Go to **https://aistudio.google.com/apikey**",
  "2. Sign in with your Google account",
  '3. Click **"Create API Key"**',
  "4. Copy the key",
  "",
  "This is Google's free tier — **you won't be charged**. It includes generous daily limits for image generation.",
  "",
  "## Step 2 — Add the key to your environment",
  "",
  "Open (or create) the `.env` file in the server directory:",
  "",
  "```",
  `${ENV_PATH}`,
  "```",
  "",
  "Add this line:",
  "```",
  "GEMINI_API_KEY=paste-your-key-here",
  "```",
  "",
  "**Alternatively**, you can set the key directly in your Claude Desktop config (see Step 3).",
  "",
  "## Step 3 — Register the server in Claude Desktop",
  "",
  "Open your Claude Desktop config file:",
  "",
  "- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`",
  "- **Windows**: `%APPDATA%\\Claude\\claude_desktop_config.json`",
  "",
  "Add (or merge) the following into your config:",
  "",
  "```json",
  "{",
  '  "mcpServers": {',
  '    "image-mcp": {',
  '      "command": "node",',
  `      "args": ["${SERVER_DIR}/index.js"],`,
  '      "env": {',
  '        "GEMINI_API_KEY": "paste-your-key-here"',
  "      }",
  "    }",
  "  }",
  "}",
  "```",
  "",
  "You can put the key in **either** the `.env` file **or** the config above — both work. Pick whichever you prefer.",
  "",
  "## Step 4 — Restart Claude Desktop",
  "",
  "Quit and reopen Claude Desktop so it picks up the new config.",
  "",
  "## Step 5 — Try it out!",
  "",
  'Ask Claude something like: *"Generate an image of a cozy coffee shop on a rainy day"* or *"Edit this photo — replace the countertop with marble"*.',
  "",
  "---",
  "",
  "**Legal note:** This project uses the Google Gemini API. Generated images are subject to",
  "Google's Terms of Service (https://ai.google.dev/gemini-api/terms).",
  "This project is not affiliated with Google and claims no rights to the API or generated content.",
].join("\n");

// ---------------------------------------------------------------------------
// Shorter message returned when a tool is called without an API key.
// Points the user back to the setup steps.
// ---------------------------------------------------------------------------
const MISSING_KEY_MESSAGE = [
  "**Gemini API key is not configured.** I can't generate or edit images without it.",
  "",
  "Don't worry — it's free and only takes a minute to set up:",
  "",
  "1. Go to **https://aistudio.google.com/apikey** and create a free API key",
  "2. Add it to your environment — pick one:",
  `   - **Option A:** Create \`${ENV_PATH}\` with the line: \`GEMINI_API_KEY=your-key\``,
  '   - **Option B:** Add it to your Claude Desktop config under `"env": { "GEMINI_API_KEY": "your-key" }` in the `"image-mcp"` server entry',
  "3. **Restart Claude Desktop**",
  "",
  "Then just ask me again — I'll be ready to go!",
  "",
  "For the full setup guide, use the **`setup_guide`** prompt in this server.",
].join("\n");

function assertApiKey() {
  if (!GEMINI_API_KEY) {
    return {
      content: [{ type: "text", text: MISSING_KEY_MESSAGE }],
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

// ---------------------------------------------------------------------------
// MCP Prompt: shown when the user selects "setup_guide" in Claude Desktop
// ---------------------------------------------------------------------------
server.prompt(
  "setup_guide",
  "Step-by-step setup instructions for the image-mcp server (API key, config, etc.)",
  () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: ONBOARDING_GUIDE,
        },
      },
    ],
  })
);

// ---------------------------------------------------------------------------
// Tool: setup_check — lets users quickly verify if everything is configured
// ---------------------------------------------------------------------------
server.tool(
  "setup_check",
  "Check if the image-mcp server is properly configured and ready to use. Run this first if you're not sure whether setup is complete.",
  {},
  async () => {
    if (GEMINI_API_KEY) {
      return {
        content: [
          {
            type: "text",
            text: "All good! Your Gemini API key is configured and image-mcp is ready to use.\n\nYou can now use **generate_image** to create images or **edit_image** to modify existing ones.",
          },
        ],
      };
    }
    return {
      content: [{ type: "text", text: MISSING_KEY_MESSAGE }],
      isError: true,
    };
  }
);

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
