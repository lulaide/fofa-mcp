import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type FOFAConfig, isOfficialAPI, fofaSearch, formatResults } from "./fofa-client.js";

const DEFAULT_FIELDS = "ip,port,protocol,host,domain,title,server";
const DEFAULT_SIZE = 100;
const MAX_SIZE = 10000;

export function createMcpServer(config: FOFAConfig): McpServer {
  const server = new McpServer({
    name: "fofa-mcp",
    version: "0.6.1",
  });

  // fofa_search
  server.tool(
    "fofa_search",
    '使用 FOFA 搜索引擎查询网络资产。支持 FOFA 查询语法，如 domain="example.com"、ip="1.1.1.1"、title="login" 等。',
    {
      query: z.string().describe('FOFA 查询语句'),
      fields: z.string().optional().describe(`返回字段，逗号分隔。默认: ${DEFAULT_FIELDS}`),
      page: z.number().int().min(1).optional().describe("页码，默认 1"),
      size: z.number().int().min(1).max(MAX_SIZE).optional().describe("每页数量，默认 100，最大 10000"),
      full: z.boolean().optional().describe("是否搜索全部数据，默认 false"),
    },
    async ({ query, fields, page, size, full }) => {
      try {
        const f = fields || DEFAULT_FIELDS;
        const result = await fofaSearch(config, query, f, page || 1, size || DEFAULT_SIZE, full || false);
        return { content: [{ type: "text" as const, text: formatResults(result, f) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `查询失败: ${(err as Error).message}` }], isError: true };
      }
    }
  );

  // 官方 API 才注册的工具
  if (isOfficialAPI(config.baseURL)) {
    server.tool(
      "fofa_user_info",
      "查询当前 FOFA 账户信息",
      async () => {
        try {
          const params = new URLSearchParams({ email: config.email, key: config.apiKey });
          const resp = await fetch(`${config.baseURL}/api/v1/info/my?${params}`);
          const data = await resp.json() as Record<string, unknown>;
          if ((data as { error?: boolean }).error) throw new Error(String((data as { errmsg?: string }).errmsg));
          const text = `邮箱: ${data.email}\nF币: ${data.fcoin}\nVIP等级: ${data.vip_level}\n是否VIP: ${data.isvip}`;
          return { content: [{ type: "text" as const, text }] };
        } catch (err) {
          return { content: [{ type: "text" as const, text: `查询失败: ${(err as Error).message}` }], isError: true };
        }
      }
    );

    server.tool(
      "fofa_stats",
      "对 FOFA 查询结果进行统计聚合分析",
      {
        query: z.string().describe("FOFA 查询语句"),
        fields: z.string().optional().describe("统计字段"),
      },
      async ({ query, fields }) => {
        try {
          const params = new URLSearchParams({ email: config.email, key: config.apiKey, qbase64: btoa(query) });
          if (fields) params.set("fields", fields);
          const resp = await fetch(`${config.baseURL}/api/v1/search/stats?${params}`);
          const data = await resp.json();
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        } catch (err) {
          return { content: [{ type: "text" as const, text: `查询失败: ${(err as Error).message}` }], isError: true };
        }
      }
    );

    server.tool(
      "fofa_host",
      "查询指定主机的详细信息",
      {
        host: z.string().describe("目标 IP 或域名"),
        detail: z.boolean().optional().describe("是否获取详细信息"),
      },
      async ({ host, detail }) => {
        try {
          const params = new URLSearchParams({ email: config.email, key: config.apiKey });
          if (detail) params.set("detail", "true");
          const resp = await fetch(`${config.baseURL}/api/v1/host/${encodeURIComponent(host)}?${params}`);
          const data = await resp.json();
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        } catch (err) {
          return { content: [{ type: "text" as const, text: `查询失败: ${(err as Error).message}` }], isError: true };
        }
      }
    );
  }

  return server;
}
