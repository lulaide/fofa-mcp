import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type FOFAConfig, search } from "../client.js";

const DEFAULT_FIELDS = "ip,port,protocol,host,domain,title,server";
const DEFAULT_SIZE = 100;
const MAX_SIZE = 10000;

function formatResults(result: { query: string; mode: string; page: number; size: number; results: string[][] }, fields: string): string {
  const fieldNames = fields.split(",").map((f) => f.trim());
  let out = `查询: ${result.query}\n模式: ${result.mode} | 总数: ${result.size} | 页码: ${result.page} | 本页: ${result.results.length}\n\n`;

  for (let i = 0; i < result.results.length; i++) {
    const row = result.results[i];
    out += `--- 结果 #${i + 1} ---\n`;
    for (let j = 0; j < row.length && j < fieldNames.length; j++) {
      out += `  ${fieldNames[j]}: ${row[j]}\n`;
    }
  }
  return out;
}

export function registerSearchTool(server: McpServer, config: FOFAConfig): void {
  server.tool(
    "fofa_search",
    '使用 FOFA 搜索引擎查询网络资产。支持 FOFA 查询语法，如 domain="example.com"、ip="1.1.1.1"、title="login" 等。',
    {
      query: z.string().describe('FOFA 查询语句，例如: domain="example.com", app="Apache", title="后台"'),
      fields: z.string().optional().describe(`返回字段，逗号分隔。默认: ${DEFAULT_FIELDS}`),
      page: z.number().int().min(1).optional().describe("页码，默认 1"),
      size: z.number().int().min(1).max(MAX_SIZE).optional().describe("每页数量，默认 100，最大 10000"),
      full: z.boolean().optional().describe("是否搜索全部数据，默认 false（仅搜索最近一年）"),
    },
    async ({ query, fields, page, size, full }) => {
      try {
        const f = fields || DEFAULT_FIELDS;
        const p = page || 1;
        const s = Math.min(size || DEFAULT_SIZE, MAX_SIZE);
        const result = await search(config, query, f, p, s, full || false);
        return { content: [{ type: "text" as const, text: formatResults(result, f) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `查询失败: ${(err as Error).message}` }], isError: true };
      }
    }
  );
}
