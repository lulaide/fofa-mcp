import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type FOFAConfig, isOfficialAPI } from "../client.js";
import { registerSearchTool } from "../tools/search.js";
import { registerExportTool } from "../tools/export.js";
import { registerOfficialTools } from "../tools/official.js";

export const VERSION = "0.6.0";

export function createMcpServer(config: FOFAConfig): McpServer {
  const server = new McpServer({
    name: "fofa-mcp",
    version: VERSION,
  });

  registerSearchTool(server, config);
  registerExportTool(server, config);

  if (isOfficialAPI(config.baseURL)) {
    registerOfficialTools(server, config);
  }

  return server;
}
