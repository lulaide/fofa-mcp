import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { loadSecrets, type ServerSecrets } from "./crypto.js";
import {
  handleOAuthMetadata,
  handleResourceMetadata,
  handleRegister,
  handleAuthorizeGet,
  handleAuthorizePost,
  handleToken,
  extractConfigFromToken,
} from "./oauth.js";
import { createMcpServer } from "./mcp-server.js";

interface Env {
  SERVER_URL?: string;
  JWE_SECRET?: string;
  JWS_SECRET?: string;
}

// Per-instance session store (Worker 实例内共享)
const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();
let cachedSecrets: ServerSecrets | null = null;

function getSecrets(env: Env): ServerSecrets {
  if (!cachedSecrets) {
    cachedSecrets = loadSecrets(env as unknown as Record<string, string | undefined>);
  }
  return cachedSecrets;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const serverUrl = (env.SERVER_URL || url.origin).replace(/\/+$/, "");
    const secrets = getSecrets(env);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // OAuth discovery
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      return handleOAuthMetadata(serverUrl);
    }
    if (url.pathname === "/.well-known/oauth-protected-resource/mcp" ||
        url.pathname === "/.well-known/oauth-protected-resource") {
      return handleResourceMetadata(serverUrl);
    }

    // Dynamic client registration
    if (url.pathname === "/register" && request.method === "POST") {
      const body = await request.json() as Record<string, unknown>;
      return handleRegister(body);
    }

    // Authorization
    if (url.pathname === "/authorize") {
      if (request.method === "GET") {
        return handleAuthorizeGet(url, serverUrl);
      }
      if (request.method === "POST") {
        const text = await request.text();
        const body = new URLSearchParams(text);
        return handleAuthorizePost(body, secrets);
      }
    }

    // Token exchange
    if (url.pathname === "/token" && request.method === "POST") {
      const text = await request.text();
      const body = new URLSearchParams(text);
      return handleToken(body, secrets);
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // Verify token
      const authResult = await extractConfigFromToken(request, secrets);
      if (authResult instanceof Response) return authResult;

      const { config } = authResult;
      const sessionId = request.headers.get("mcp-session-id");

      // POST — MCP JSON-RPC
      if (request.method === "POST") {
        const body = await request.json();

        // Existing session
        if (sessionId && sessions.has(sessionId)) {
          const transport = sessions.get(sessionId)!;
          return transport.handleRequest(request, { parsedBody: body });
        }

        // New session (must be initialize)
        if (!sessionId && isInitializeRequest(body)) {
          const transport = new WebStandardStreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            onsessioninitialized: (sid) => {
              sessions.set(sid, transport);
            },
            onsessionclosed: (sid) => {
              sessions.delete(sid);
            },
          });

          const server = createMcpServer(config);
          await server.connect(transport);
          return transport.handleRequest(request, { parsedBody: body });
        }

        return Response.json(
          { jsonrpc: "2.0", error: { code: -32000, message: "Bad Request" }, id: null },
          { status: 400, headers: corsHeaders() }
        );
      }

      // GET — SSE stream
      if (request.method === "GET" && sessionId && sessions.has(sessionId)) {
        return sessions.get(sessionId)!.handleRequest(request);
      }

      // DELETE — close session
      if (request.method === "DELETE" && sessionId && sessions.has(sessionId)) {
        return sessions.get(sessionId)!.handleRequest(request);
      }

      return new Response("Bad Request", { status: 400, headers: corsHeaders() });
    }

    // Health check
    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({ status: "ok", service: "fofa-mcp" }, { headers: corsHeaders() });
    }

    return new Response("Not Found", { status: 404 });
  },
};
