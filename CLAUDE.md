# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 构建与运行

```bash
# 构建
npm run build

# stdio 模式（默认，本地客户端用）
node dist/index.js

# HTTP 模式（远程部署，Claude.ai 网页端用）
JWE_SECRET=... JWS_SECRET=... SERVER_URL=http://localhost:3000 node dist/index.js serve

# Worker（独立项目，在 worker/ 目录下）
cd worker && npm run dev      # 本地开发
cd worker && npm run deploy   # 部署到 Cloudflare
```

## 架构

项目有三种运行模式：

1. **stdio**（`fofa-mcp`）— 本地 MCP，通过 stdin/stdout 通信，配置来自环境变量
2. **serve**（`fofa-mcp serve`）— Express HTTP 服务器，OAuth 2.1 + PKCE 认证，配置来自 JWT token
3. **worker**（`worker/`）— Cloudflare Worker 无服务器部署，同样的 OAuth 流程，使用 Web Standard API

### 完全无状态 HTTP

`serve` 和 `worker` 都是无状态的——每个 POST `/mcp` 请求独立创建 `McpServer` + `Transport`，处理完即销毁。无 session，无跨请求内存状态。用户的 FOFA 配置（baseURL + apiKey）存在 JWS access token 中。

### 条件工具注册

`isOfficialAPI(baseURL)` 控制 `fofa_user_info`、`fofa_stats`、`fofa_host` 是否注册——这些只在官方 `fofa.info` 上可用。自定义/中转 API 地址只注册 `fofa_search` + `fofa_export`。

### OAuth token 流程（serve 和 worker）

- **authorization code**：JWE 加密（A256GCM），包含用户 FOFA 配置 + PKCE challenge，5 分钟过期
- **access token**：JWS 签名（HS256），包含 FOFA 配置，365 天过期
- 密钥未设置时自动随机生成（重启后旧 token 失效）

## 代码结构

- `src/index.ts` — CLI 分发：`process.argv[2] === "serve"` 进入 HTTP 模式
- `src/client.ts` — FOFA API 客户端（`search`、`userInfo`、`stats`、`hostDetail`）+ 环境变量配置加载
- `src/tools/` — 每个文件导出 `register*Tool(server, config)` 函数
- `src/server/create-mcp-server.ts` — 共享工厂函数，stdio 和 serve 模式都用
- `src/server/serve.ts` — Express 应用，挂载 SDK 的 `mcpAuthRouter` + 无状态 `/mcp` 处理
- `src/server/crypto.ts` — `jose` 库的 JWE/JWS 封装
- `src/server/oauth-provider.ts` — 实现 SDK 的 `OAuthServerProvider` 接口
- `worker/` — 独立项目，不依赖 Express，纯 fetch handler 实现 OAuth + MCP

## 发布流程

推送 `v*` 标签 → CI 自动发布 npm + 创建 GitHub Release：

```bash
# 更新 package.json 和 src/server/create-mcp-server.ts 中的版本号
git tag -a v0.x.x -m "描述"
git push origin main v0.x.x
```

Worker 独立部署：`cd worker && npx wrangler deploy`

## 约定

- 提交信息：conventional commits 中文（如 `feat: 新增...`、`fix: 修复...`）
- npm 包只发布 `dist/` 编译产物
- Worker 启用 `nodejs_compat` 兼容标志
