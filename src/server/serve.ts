import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { FOFAOAuthProvider } from "./oauth-provider.js";
import { loadSecrets } from "./crypto.js";
import { createMcpServer } from "./create-mcp-server.js";
import type { FOFAConfig } from "../client.js";

export async function startServer(): Promise<void> {
  const serverUrl = process.env.SERVER_URL || "http://localhost:3000";
  const secrets = loadSecrets();
  const listenAddr = process.env.LISTEN_ADDR || ":3000";

  let host = "0.0.0.0";
  let port = 3000;
  if (listenAddr.startsWith(":")) {
    port = parseInt(listenAddr.slice(1), 10);
  } else if (listenAddr.includes(":")) {
    const idx = listenAddr.lastIndexOf(":");
    host = listenAddr.slice(0, idx);
    port = parseInt(listenAddr.slice(idx + 1), 10);
  }

  const provider = new FOFAOAuthProvider(secrets, serverUrl);
  const issuerUrl = new URL(serverUrl);
  const mcpServerUrl = new URL("/mcp", serverUrl);

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // OAuth 路由
  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl,
      baseUrl: issuerUrl,
      resourceServerUrl: mcpServerUrl,
      resourceName: "FOFA MCP Server",
      scopesSupported: [],
    })
  );

  // Bearer auth 中间件
  const authMiddleware = requireBearerAuth({
    verifier: provider,
    requiredScopes: [],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
  });

  // POST /mcp — 无状态：每个请求独立创建 server + transport
  app.post("/mcp", authMiddleware, async (req, res) => {
    const authInfo = (req as unknown as { auth: AuthInfo }).auth;
    const config: FOFAConfig = {
      apiKey: authInfo.extra!.apiKey as string,
      email: authInfo.extra!.email as string,
      baseURL: authInfo.extra!.baseURL as string,
    };

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const server = createMcpServer(config);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    await transport.close();
    await server.close();
  });

  app.listen(port, host, () => {
    console.log(`FOFA MCP HTTP 服务器已启动`);
    console.log(`监听: ${host}:${port}`);
    console.log(`公开地址: ${serverUrl}`);
    console.log(`MCP 端点: ${serverUrl}/mcp`);
  });
}
