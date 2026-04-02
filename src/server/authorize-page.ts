export interface AuthorizePageParams {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  serverUrl: string;
}

export function renderAuthorizePage(params: AuthorizePageParams): string {
  return `<!DOCTYPE html>
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
  input[type="text"], input[type="password"] { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-size: 14px; outline: none; transition: border-color 0.2s; }
  input:focus { border-color: #3b82f6; }
  .hint { font-size: 11px; color: #64748b; margin-top: 4px; }
  button { width: 100%; margin-top: 24px; padding: 12px; border-radius: 8px; border: none; background: #3b82f6; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
  button:hover { background: #2563eb; }
  .footer { text-align: center; margin-top: 16px; font-size: 11px; color: #475569; }
</style>
</head>
<body>
<div class="card">
  <h1>FOFA MCP 授权</h1>
  <p class="subtitle">请填写你的 FOFA API 配置以授权访问</p>
  <form method="POST" action="${params.serverUrl}/authorize">
    <input type="hidden" name="client_id" value="${esc(params.clientId)}">
    <input type="hidden" name="redirect_uri" value="${esc(params.redirectUri)}">
    <input type="hidden" name="state" value="${esc(params.state)}">
    <input type="hidden" name="code_challenge" value="${esc(params.codeChallenge)}">
    <input type="hidden" name="code_challenge_method" value="${esc(params.codeChallengeMethod)}">
    <input type="hidden" name="response_type" value="code">
    <input type="hidden" name="scope" value="${esc(params.scope)}">

    <label for="base_url">FOFA API 地址</label>
    <input type="text" id="base_url" name="base_url" value="https://fofa.info" placeholder="https://fofa.info">
    <p class="hint">如使用中转 API，请修改为对应地址</p>

    <label for="api_key">API Key</label>
    <input type="password" id="api_key" name="api_key" required placeholder="你的 FOFA API Key">

    <label for="email">邮箱（可选）</label>
    <input type="text" id="email" name="email" placeholder="部分中转 API 不需要">

    <button type="submit">授权</button>
  </form>
  <p class="footer">你的凭据仅编码在 token 中，服务端不会存储</p>
</div>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
