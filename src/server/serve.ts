import { randomUUID } from "node:crypto";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { FOFAOAuthProvider } from "./oauth-provider.js";
import { loadSecrets } from "./crypto.js";
import { createMcpServer } from "./create-mcp-server.js";
import type { FOFAConfig } from "../client.js";

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

export async function startServer(): Promise<void> {
  const serverUrl = process.env.SERVER_URL || "http://localhost:3000";
  const secrets = loadSecrets();
  const listenAddr = process.env.LISTEN_ADDR || ":3000";

  // Parse host:port
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

  // Session 管理
  const sessions = new Map<string, SessionEntry>();

  // POST /mcp
  app.post("/mcp", authMiddleware, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // 已有 session
    if (sessionId && sessions.has(sessionId)) {
      const entry = sessions.get(sessionId)!;
      await entry.transport.handleRequest(req, res, req.body);
      return;
    }

    // 新 session（必须是 initialize 请求）
    if (!sessionId && isInitializeRequest(req.body)) {
      const authInfo = (req as unknown as { auth: AuthInfo }).auth;
      const config: FOFAConfig = {
        apiKey: authInfo.extra!.apiKey as string,
        email: authInfo.extra!.email as string,
        baseURL: authInfo.extra!.baseURL as string,
      };

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          sessions.set(sid, { transport, server });
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) sessions.delete(sid);
      };

      const server = createMcpServer(config);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: missing session ID or not an initialize request" },
      id: null,
    });
  });

  // GET /mcp — SSE stream
  app.get("/mcp", authMiddleware, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string;
    const entry = sessions.get(sessionId);
    if (!entry) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await entry.transport.handleRequest(req, res);
  });

  // DELETE /mcp — session termination
  app.delete("/mcp", authMiddleware, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string;
    const entry = sessions.get(sessionId);
    if (!entry) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await entry.transport.handleRequest(req, res);
  });

  app.listen(port, host, () => {
    console.log(`FOFA MCP HTTP 服务器已启动`);
    console.log(`监听: ${host}:${port}`);
    console.log(`公开地址: ${serverUrl}`);
    console.log(`MCP 端点: ${serverUrl}/mcp`);
  });

  process.on("SIGINT", async () => {
    console.log("\n正在关闭...");
    for (const [sid, entry] of sessions) {
      await entry.transport.close();
      sessions.delete(sid);
    }
    process.exit(0);
  });
}
