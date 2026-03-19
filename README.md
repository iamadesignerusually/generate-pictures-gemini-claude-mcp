# image-mcp — Gemini Image Generation MCP Server

A local MCP (Model Context Protocol) server that connects Claude Desktop to Google Gemini for image generation and editing.

## Tools

### `generate_image`
Generate an image from a text prompt.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | yes | Text description of the image to generate |
| `style` | string | no | Style guide appended to the prompt. Defaults to: *"warm line art illustration, watercolor fill, off-white background, thin black outlines, soft pastel colors, emotional and tender"* |

### `edit_image`
Edit an existing image with a text instruction.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_path` | string | yes | Local file path or URL of the image to edit |
| `instruction` | string | yes | Editing instruction, e.g. "replace the countertop with marble" |

Both tools return the image inline and save it to the `output/` directory.

## Setup

### 1. Clone and install

```bash
git clone https://github.com/iamadesignerusually/generate-pictures-gemini-claude-mcp.git
cd generate-pictures-gemini-claude-mcp
npm install
```

### 2. Configure your Gemini API key

Copy the example env file and add your key:

```bash
cp .env.example .env
```

Edit `.env` and set your [Google AI Studio](https://aistudio.google.com/apikey) API key:

```
GEMINI_API_KEY=your-key-here
```

### 3. Test the server

```bash
npm start
```

The server communicates over stdio — you should see `image-mcp server running on stdio` on stderr. Press Ctrl+C to stop.

### 4. Register in Claude Desktop

Open your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the `image-mcp` entry (see `claude-desktop-config.json` for a template):

```json
{
  "mcpServers": {
    "image-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/generate-pictures-gemini-claude-mcp/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-api-key-here"
      }
    }
  }
}
```

Replace the path with the actual absolute path on your machine. Restart Claude Desktop.

### 5. Use it

In Claude Desktop, you can now ask:

> "Generate an image of a cat sitting on a windowsill watching rain"

> "Edit this image (path: ./output/generated-2025-01-01.png) — make the sky purple"

Generated and edited images are saved in the `output/` folder.

## Disclaimer / Rechtliches

Dieses Projekt nutzt die **Google Gemini API** zur Bildgenerierung und -bearbeitung. Dieses Projekt ist **nicht** von Google genehmigt, gesponsert oder anderweitig mit Google verbunden.

- Die generierten Bilder unterliegen den [Google Gemini API Nutzungsbedingungen](https://ai.google.dev/gemini-api/terms) und den [Google AI Generative API Additional Terms of Service](https://ai.google.dev/gemini-api/terms).
- Dieses Projekt beansprucht **keinerlei Rechte** an der Gemini API, den generierten Bildern oder an Google-Marken.
- Du bist selbst verantwortlich für die Einhaltung der Google-Nutzungsbedingungen.
- Bitte prüfe vor **kommerzieller Nutzung** der generierten Bilder die aktuellen Google-Richtlinien.
- Der Gemini API Free Tier ist kostenlos, unterliegt aber Nutzungslimits (siehe [Google AI Studio Pricing](https://ai.google.dev/pricing)).

This project uses the Google Gemini API. It is **not** endorsed, sponsored, or affiliated with Google. Generated images are subject to Google's [Gemini API Terms of Service](https://ai.google.dev/gemini-api/terms). You are solely responsible for complying with Google's terms. Check Google's policies before any commercial use of generated images.
