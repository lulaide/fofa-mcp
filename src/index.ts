#!/usr/bin/env node

const command = process.argv[2];

if (command === "serve") {
  const { startServer } = await import("./server/serve.js");
  await startServer();
} else {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { loadConfig, isOfficialAPI } = await import("./client.js");
  const { registerSearchTool } = await import("./tools/search.js");
  const { registerExportTool } = await import("./tools/export.js");
  const { registerOfficialTools } = await import("./tools/official.js");
  const { VERSION } = await import("./server/create-mcp-server.js");

  const config = loadConfig();
  const server = new McpServer({ name: "fofa-mcp", version: VERSION });

  registerSearchTool(server, config);
  registerExportTool(server, config);
  if (isOfficialAPI(config.baseURL)) {
    registerOfficialTools(server, config);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
