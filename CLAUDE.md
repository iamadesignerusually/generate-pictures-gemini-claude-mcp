# Image MCP Server

This repo IS an MCP server for generating images via Google Gemini. Do NOT write custom scripts — use the MCP tools directly.

## Available MCP Tools

- `create_project` — Creates a project folder under ~/claude-pictures/ (call first)
- `generate_image` — Generate an image from a text prompt
- `edit_image` — Edit an existing image with instructions

## Setup (runs automatically)

Dependencies are installed via npm. If `node_modules/` is missing, run `npm install` first.

## Workflow

1. Call `create_project` with a short title based on what the user wants
2. Use `generate_image` / `edit_image` to create images
3. Images are saved to ~/claude-pictures/{project-folder}/
