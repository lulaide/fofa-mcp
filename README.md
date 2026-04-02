# fofa-mcp

FOFA 搜索引擎的 MCP (Model Context Protocol) 工具服务器，让 AI 助手能够直接调用 FOFA API 进行网络资产搜索。

## 功能

- **fofa_search** - FOFA 资产搜索，支持完整查询语法
- **fofa_export** - 导出搜索结果到文件（CSV/JSON），数据不进入上下文，避免 token 消耗
- **fofa_user_info** - 查询账户信息（仅官方 API）
- **fofa_stats** - 搜索结果统计聚合分析（仅官方 API）
- **fofa_host** - 查询指定主机的详细信息（仅官方 API）

> 使用自定义 API URL 时，仅注册 `fofa_search` 和 `fofa_export`，其余工具仅在官方 FOFA API 下可用。

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

### Go 版本（备选）

```bash
go install github.com/lulaide/fofa-mcp@latest
```

## 配置

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `FOFA_API_KEY` | 是 | FOFA API Key（在 [个人中心](https://fofa.info/userInfo) 获取） |
| `FOFA_EMAIL` | 否 | FOFA 账户邮箱（部分中转 API 不需要，可留空） |
| `FOFA_BASE_URL` | 否 | 自定义 FOFA API 地址，默认 `https://fofa.info` |

### Claude Desktop 配置

编辑 Claude Desktop 配置文件：

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

### Cursor 配置

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

## 使用示例

配置完成后，你可以在 AI 助手中这样使用：

- "用 FOFA 搜索所有 domain 为 example.com 的资产"
- "将 title='登录' 的搜索结果导出到 result.csv"
- "查看我的 FOFA 账户信息"
- "统计 title='登录' 的资产国家分布"
- "查询 1.1.1.1 的主机详细信息"

### fofa_search 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | FOFA 查询语句 |
| `fields` | string | 否 | 返回字段，逗号分隔，默认 `ip,port,protocol,host,domain,title,server` |
| `page` | integer | 否 | 页码，默认 1 |
| `size` | integer | 否 | 每页数量，默认 100，最大 10000 |
| `full` | boolean | 否 | 是否搜索全部数据，默认 false（仅最近一年） |

### fofa_export 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | FOFA 查询语句 |
| `output_file` | string | 是 | 输出文件的绝对路径，支持 `.csv` 和 `.json` |
| `fields` | string | 否 | 返回字段，默认 `ip,port,protocol,host,domain,title,server` |
| `page` | integer | 否 | 页码，默认 1 |
| `size` | integer | 否 | 每页数量，默认 100，最大 10000 |
| `full` | boolean | 否 | 是否搜索全部数据，默认 false |

### fofa_stats 参数（仅官方 API）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | FOFA 查询语句 |
| `fields` | string | 否 | 统计字段，如 `country,port,protocol` |

### fofa_host 参数（仅官方 API）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `host` | string | 是 | 目标 IP 或域名 |
| `detail` | boolean | 否 | 是否获取详细信息 |

## 许可证

MIT License
