import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const server = new McpServer({
  name: "forced-logic-site",
  version: "1.0.0",
});

function safePath(relPath = ".") {
  const resolved = path.resolve(projectRoot, relPath);
  if (!resolved.startsWith(projectRoot)) {
    throw new Error("Path escapes website root.");
  }
  return resolved;
}

async function listFiles(dir = ".", depth = 2, out = [], currentDepth = 0) {
  const full = safePath(dir);
  const entries = await fsp.readdir(full, { withFileTypes: true });
  for (const entry of entries) {
    const rel = path.relative(projectRoot, path.join(full, entry.name));
    out.push({
      path: rel.replaceAll("\\", "/"),
      type: entry.isDirectory() ? "dir" : "file",
    });
    if (entry.isDirectory() && currentDepth < depth) {
      await listFiles(path.join(dir, entry.name), depth, out, currentDepth + 1);
    }
  }
  return out;
}

async function readText(filePath) {
  const absolute = safePath(filePath);
  return fsp.readFile(absolute, "utf8");
}

async function writeText(filePath, content) {
  const absolute = safePath(filePath);
  await fsp.mkdir(path.dirname(absolute), { recursive: true });
  await fsp.writeFile(absolute, String(content ?? ""), "utf8");
  return absolute;
}

function fileSummary() {
  return {
    root: projectRoot,
    hasIndex: fs.existsSync(path.join(projectRoot, "index.html")),
    hasStyles: fs.existsSync(path.join(projectRoot, "styles.css")),
    hasPackage: fs.existsSync(path.join(projectRoot, "package.json")),
    hasMcp: fs.existsSync(path.join(projectRoot, ".mcp.json")),
  };
}

server.registerTool(
  "health_check",
  {
    title: "Health Check",
    description: "Inspect the website workspace boundary and file availability.",
    inputSchema: z.object({}),
  },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(fileSummary(), null, 2) }],
  }),
);

server.registerTool(
  "list_files",
  {
    title: "List Files",
    description: "List files under the website workspace without crossing the boundary.",
    inputSchema: z.object({
      dir: z.string().default("."),
      depth: z.number().int().min(0).max(6).default(2),
    }),
  },
  async ({ dir, depth }) => ({
    content: [{ type: "text", text: JSON.stringify({ root: projectRoot, files: await listFiles(dir, depth) }, null, 2) }],
  }),
);

server.registerTool(
  "read_file",
  {
    title: "Read File",
    description: "Read a text file inside the website workspace.",
    inputSchema: z.object({
      filePath: z.string(),
    }),
  },
  async ({ filePath }) => ({
    content: [{ type: "text", text: await readText(filePath) }],
  }),
);

server.registerTool(
  "write_file",
  {
    title: "Write File",
    description: "Write a text file inside the website workspace.",
    inputSchema: z.object({
      filePath: z.string(),
      content: z.string(),
    }),
  },
  async ({ filePath, content }) => {
    const absolute = await writeText(filePath, content);
    return {
      content: [{ type: "text", text: JSON.stringify({ ok: true, filePath: absolute }, null, 2) }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
