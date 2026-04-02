import { type ServerSecrets, encryptCode, decryptCode, signToken, verifyToken, type TokenPayload } from "./crypto.js";

// In-memory client store (per Worker instance)
const clients = new Map<string, Record<string, unknown>>();

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
  };
}

export function handleOAuthMetadata(serverUrl: string): Response {
  return Response.json({
    issuer: serverUrl,
    authorization_endpoint: `${serverUrl}/authorize`,
    token_endpoint: `${serverUrl}/token`,
    registration_endpoint: `${serverUrl}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [],
  }, { headers: corsHeaders() });
}

export function handleResourceMetadata(serverUrl: string): Response {
  return Response.json({
    resource: `${serverUrl}/mcp`,
    authorization_servers: [serverUrl],
    scopes_supported: [],
    resource_name: "FOFA MCP Server",
  }, { headers: corsHeaders() });
}

export function handleRegister(body: Record<string, unknown>): Response {
  const clientId = crypto.randomUUID();
  const clientInfo = {
    ...body,
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
  };
  clients.set(clientId, clientInfo);
  return Response.json(clientInfo, { status: 201, headers: corsHeaders() });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function handleAuthorizeGet(url: URL, serverUrl: string): Response {
  const clientId = url.searchParams.get("client_id") || "";
  const redirectUri = url.searchParams.get("redirect_uri") || "";
  const state = url.searchParams.get("state") || "";
  const codeChallenge = url.searchParams.get("code_challenge") || "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") || "S256";
  const scope = url.searchParams.get("scope") || "";

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FOFA MCP - 授权</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: #1e293b; border-radius: 12px; padding: 32px; width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(0,0,0,0.3); }
  h1 { font-size: 20px; margin-bottom: 4px; color: #f1f5f9; }
  .subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
  label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; margin-top: 16px; }
  input[type="text"], input[type="password"] { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-size: 14px; outline: none; }
  input:focus { border-color: #3b82f6; }
  .hint { font-size: 11px; color: #64748b; margin-top: 4px; }
  button { width: 100%; margin-top: 24px; padding: 12px; border-radius: 8px; border: none; background: #3b82f6; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
  button:hover { background: #2563eb; }
  .footer { text-align: center; margin-top: 16px; font-size: 11px; color: #475569; }
</style>
</head>
<body>
<div class="card">
  <h1>FOFA MCP 授权</h1>
  <p class="subtitle">请填写你的 FOFA API 配置以授权访问</p>
  <form method="POST" action="${serverUrl}/authorize">
    <input type="hidden" name="client_id" value="${esc(clientId)}">
    <input type="hidden" name="redirect_uri" value="${esc(redirectUri)}">
    <input type="hidden" name="state" value="${esc(state)}">
    <input type="hidden" name="code_challenge" value="${esc(codeChallenge)}">
    <input type="hidden" name="code_challenge_method" value="${esc(codeChallengeMethod)}">
    <input type="hidden" name="response_type" value="code">
    <input type="hidden" name="scope" value="${esc(scope)}">
    <label for="base_url">FOFA API 地址</label>
    <input type="text" id="base_url" name="base_url" value="https://fofa.info">
    <p class="hint">如使用中转 API，请修改为对应地址</p>
    <label for="api_key">API Key</label>
    <input type="password" id="api_key" name="api_key" required>
    <label for="email">邮箱（可选）</label>
    <input type="text" id="email" name="email">
    <button type="submit">授权</button>
  </form>
  <p class="footer">你的凭据仅编码在 token 中，服务端不会存储</p>
</div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders() },
  });
}

export async function handleAuthorizePost(body: URLSearchParams, secrets: ServerSecrets): Promise<Response> {
  const apiKey = body.get("api_key");
  if (!apiKey) {
    return new Response("缺少 api_key", { status: 400 });
  }

  const code = await encryptCode(secrets, {
    baseURL: (body.get("base_url") || "https://fofa.info").replace(/\/+$/, ""),
    apiKey,
    email: body.get("email") || "fofa@fofa.info",
    codeChallenge: body.get("code_challenge") || "",
    codeChallengeMethod: body.get("code_challenge_method") || "S256",
    clientId: body.get("client_id") || "",
    redirectUri: body.get("redirect_uri") || "",
  });

  const redirectUri = new URL(body.get("redirect_uri") || "");
  redirectUri.searchParams.set("code", code);
  const state = body.get("state");
  if (state) redirectUri.searchParams.set("state", state);

  return Response.redirect(redirectUri.toString(), 302);
}

export async function handleToken(body: URLSearchParams, secrets: ServerSecrets): Promise<Response> {
  const grantType = body.get("grant_type");
  if (grantType !== "authorization_code") {
    return Response.json({ error: "unsupported_grant_type" }, { status: 400, headers: corsHeaders() });
  }

  const code = body.get("code");
  const codeVerifier = body.get("code_verifier");

  if (!code) {
    return Response.json({ error: "invalid_request", error_description: "缺少 code" }, { status: 400, headers: corsHeaders() });
  }

  let payload;
  try {
    payload = await decryptCode(secrets, code);
  } catch {
    return Response.json({ error: "invalid_grant", error_description: "code 无效或已过期" }, { status: 400, headers: corsHeaders() });
  }

  // PKCE 验证
  if (payload.codeChallenge && codeVerifier) {
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
    const computed = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    if (computed !== payload.codeChallenge) {
      return Response.json({ error: "invalid_grant", error_description: "PKCE 验证失败" }, { status: 400, headers: corsHeaders() });
    }
  }

  // 验证 redirect_uri
  const redirectUri = body.get("redirect_uri");
  if (redirectUri && redirectUri !== payload.redirectUri) {
    return Response.json({ error: "invalid_grant", error_description: "redirect_uri 不匹配" }, { status: 400, headers: corsHeaders() });
  }

  const accessToken = await signToken(secrets, {
    baseURL: payload.baseURL,
    apiKey: payload.apiKey,
    email: payload.email,
    clientId: payload.clientId,
  });

  return Response.json({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 31536000,
  }, { headers: corsHeaders() });
}

export async function extractConfigFromToken(
  request: Request,
  secrets: ServerSecrets
): Promise<{ config: { apiKey: string; email: string; baseURL: string }; clientId: string } | Response> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return Response.json(
      { error: "invalid_token", error_description: "缺少 Bearer token" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer", ...corsHeaders() } }
    );
  }

  try {
    const payload = await verifyToken(secrets, auth.slice(7));
    return {
      config: { apiKey: payload.apiKey, email: payload.email, baseURL: payload.baseURL },
      clientId: payload.clientId,
    };
  } catch {
    return Response.json(
      { error: "invalid_token", error_description: "token 无效或已过期" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer", ...corsHeaders() } }
    );
  }
}
