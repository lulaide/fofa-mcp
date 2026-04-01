# fofa-mcp

FOFA 搜索引擎的 MCP (Model Context Protocol) 工具服务器，让 AI 助手能够直接调用 FOFA API 进行网络资产搜索。

## 功能

- **fofa_search** - FOFA 资产搜索，支持完整查询语法
- **fofa_user_info** - 查询账户信息（F币余额、VIP等级等）
- **fofa_stats** - 搜索结果统计聚合分析
- **fofa_host** - 查询指定主机的详细信息

## 安装

### 使用 go install

```bash
go install github.com/lulaide/fofa-mcp@latest
```

### 从 Release 下载

前往 [Releases](https://github.com/lulaide/fofa-mcp/releases) 页面下载对应平台的预编译二进制文件。

### Claude Code 一键安装

```bash
claude mcp add fofa-mcp -- go run github.com/lulaide/fofa-mcp@latest
```

或指定环境变量：

```bash
claude mcp add fofa-mcp -e FOFA_API_KEY=your-api-key -e FOFA_BASE_URL=https://fofa.info -- go run github.com/lulaide/fofa-mcp@latest
```

如果已通过 `go install` 安装：

```bash
claude mcp add fofa-mcp -e FOFA_API_KEY=your-api-key -- fofa-mcp
```

### 从源码编译

```bash
git clone https://github.com/lulaide/fofa-mcp.git
cd fofa-mcp
go build -o fofa-mcp .
```

## 配置

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `FOFA_EMAIL` | 否 | FOFA 账户邮箱（部分中转 API 不需要，可留空） |
| `FOFA_API_KEY` | 是 | FOFA API Key（在 [个人中心](https://fofa.info/userInfo) 获取） |
| `FOFA_BASE_URL` | 否 | 自定义 FOFA API 地址，默认 `https://fofa.info` |

### Claude Desktop 配置

编辑 Claude Desktop 配置文件：

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fofa": {
      "command": "fofa-mcp",
      "env": {
        "FOFA_EMAIL": "your-email@example.com",
        "FOFA_API_KEY": "your-api-key",
        "FOFA_BASE_URL": "https://fofa.info"
      }
    }
  }
}
```

如果使用 `go install` 安装，需要指定完整路径：

```json
{
  "mcpServers": {
    "fofa": {
      "command": "/Users/yourname/go/bin/fofa-mcp",
      "env": {
        "FOFA_EMAIL": "your-email@example.com",
        "FOFA_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Cursor 配置

在 Cursor 的 MCP 设置中添加：

```json
{
  "mcpServers": {
    "fofa": {
      "command": "fofa-mcp",
      "env": {
        "FOFA_EMAIL": "your-email@example.com",
        "FOFA_API_KEY": "your-api-key"
      }
    }
  }
}
```

## 使用示例

配置完成后，你可以在 AI 助手中这样使用：

- "用 FOFA 搜索所有 domain 为 example.com 的资产"
- "查看我的 FOFA 账户信息"
- "统计 title=\"登录\" 的资产国家分布"
- "查询 1.1.1.1 的主机详细信息"

### fofa_search 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | FOFA 查询语句 |
| `fields` | string | 否 | 返回字段，逗号分隔，默认 `ip,port,protocol,host,domain,title,server` |
| `page` | integer | 否 | 页码，默认 1 |
| `size` | integer | 否 | 每页数量，默认 100，最大 10000 |
| `full` | boolean | 否 | 是否搜索全部数据，默认 false（仅最近一年） |

### fofa_stats 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | FOFA 查询语句 |
| `fields` | string | 否 | 统计字段，如 `country,port,protocol` |

### fofa_host 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `host` | string | 是 | 目标 IP 或域名 |
| `detail` | boolean | 否 | 是否获取详细信息 |

## 许可证

MIT License
