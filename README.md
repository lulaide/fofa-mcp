# fofa-mcp

FOFA 搜索引擎的 MCP (Model Context Protocol) 工具服务器，让 AI 助手能够直接调用 FOFA API 进行网络资产搜索。

## 功能

- **fofa_search** - FOFA 资产搜索，支持完整查询语法
- **fofa_export** - 导出搜索结果到文件（CSV/JSON），数据不进入上下文，避免 token 消耗
- **fofa_user_info** - 查询账户信息（仅官方 API）
- **fofa_stats** - 搜索结果统计聚合分析（仅官方 API）
- **fofa_host** - 查询指定主机的详细信息（仅官方 API）

> 使用自定义 API URL 时，仅注册 `fofa_search` 和 `fofa_export`，其余工具仅在官方 FOFA API 下可用。

### 双模式运行

- **stdio 模式**（默认）：`fofa-mcp` — 用于 Claude Code、Cursor 等本地客户端
- **HTTP 模式**：`fofa-mcp serve` — 用于 Claude.ai 网页端（Custom Connector），支持 OAuth 2.1 + PKCE

## 安装

### npx 直接运行（无需安装）

```bash
npx fofa-mcp
```

### 全局安装

```bash
npm install -g fofa-mcp
```

### Claude Code 一键安装

```bash
claude mcp add fofa-mcp -e FOFA_API_KEY=your-api-key -- npx fofa-mcp
```

指定自定义 API 地址：

```bash
claude mcp add fofa-mcp -e FOFA_API_KEY=your-api-key -e FOFA_BASE_URL=https://your-api.com -- npx fofa-mcp
```

## 配置

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `FOFA_API_KEY` | 是 | FOFA API Key（在 [个人中心](https://fofa.info/userInfo) 获取） |
| `FOFA_EMAIL` | 否 | FOFA 账户邮箱（部分中转 API 不需要，可留空） |
| `FOFA_BASE_URL` | 否 | 自定义 FOFA API 地址，默认 `https://fofa.info` |

### Claude Desktop

编辑配置文件：

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fofa": {
      "command": "npx",
      "args": ["fofa-mcp"],
      "env": {
        "FOFA_API_KEY": "your-api-key",
        "FOFA_BASE_URL": "https://fofa.info"
      }
    }
  }
}
```

### Cursor

```json
{
  "mcpServers": {
    "fofa": {
      "command": "npx",
      "args": ["fofa-mcp"],
      "env": {
        "FOFA_API_KEY": "your-api-key"
      }
    }
  }
}
```

## 工具参数

### fofa_search

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | FOFA 查询语句 |
| `fields` | string | 否 | 返回字段，逗号分隔，默认 `ip,port,protocol,host,domain,title,server` |
| `page` | integer | 否 | 页码，默认 1 |
| `size` | integer | 否 | 每页数量，默认 100，最大 10000 |
| `full` | boolean | 否 | 是否搜索全部数据，默认 false（仅最近一年） |

### fofa_export

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | FOFA 查询语句 |
| `output_file` | string | 是 | 输出文件路径，支持 `.csv` 和 `.json` |
| `fields` | string | 否 | 返回字段，默认 `ip,port,protocol,host,domain,title,server` |
| `page` | integer | 否 | 页码，默认 1 |
| `size` | integer | 否 | 每页数量，默认 100，最大 10000 |
| `full` | boolean | 否 | 是否搜索全部数据，默认 false |

### fofa_stats（仅官方 API）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | FOFA 查询语句 |
| `fields` | string | 否 | 统计字段，如 `country,port,protocol` |

### fofa_host（仅官方 API）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `host` | string | 是 | 目标 IP 或域名 |
| `detail` | boolean | 否 | 是否获取详细信息 |

## HTTP 模式（serve）

用于部署为远程 MCP 服务器，支持 Claude.ai 网页端通过 OAuth Custom Connector 接入。

### 启动

```bash
SERVER_URL=https://your-domain.com fofa-mcp serve
```

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `SERVER_URL` | 否 | `http://localhost:3000` | 服务对外公开地址 |
| `JWE_SECRET` | 否 | 自动生成 | 32 字节 base64 编码密钥（加密 authorization code） |
| `JWS_SECRET` | 否 | 自动生成 | 32+ 字节 base64 编码密钥（签名 access token） |
| `LISTEN_ADDR` | 否 | `:3000` | 监听地址（如 `0.0.0.0:8080`） |

> 未设置 `JWE_SECRET`/`JWS_SECRET` 时自动随机生成，重启后旧 token 失效，客户端会自动重新 OAuth。如需重启后 token 持续有效，手动设置固定密钥。

### 工作原理

1. Claude.ai 发现 OAuth 元数据（`/.well-known/oauth-authorization-server`）
2. 用户在浏览器授权页面填写 FOFA API 配置（base_url + api_key）
3. 服务端将配置加密为 JWE code，再签发 JWS access token
4. Claude.ai 使用 token 调用 `/mcp` 端点，服务端从 token 解出配置代为请求
5. **完全无状态**：服务端不存储任何用户凭据

### Claude.ai 配置

在 Claude.ai 中添加 Custom Connector，填入你部署的服务器地址即可，OAuth 发现和认证流程自动完成。

## 许可证

MIT License
