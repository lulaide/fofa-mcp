#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, isOfficialAPI } from "./client.js";
import { registerSearchTool } from "./tools/search.js";
import { registerExportTool } from "./tools/export.js";
import { registerOfficialTools } from "./tools/official.js";

const config = loadConfig();

const server = new McpServer({
  name: "fofa-mcp",
  version: "0.5.0",
});

registerSearchTool(server, config);
registerExportTool(server, config);

if (isOfficialAPI(config.baseURL)) {
  registerOfficialTools(server, config);
}

const transport = new StdioServerTransport();
await server.connect(transport);
