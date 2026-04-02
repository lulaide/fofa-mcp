import { z } from "zod";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, extname } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type FOFAConfig, search } from "../client.js";

const DEFAULT_FIELDS = "ip,port,protocol,host,domain,title,server";
const DEFAULT_SIZE = 100;
const MAX_SIZE = 10000;

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function registerExportTool(server: McpServer, config: FOFAConfig): void {
  server.tool(
    "fofa_export",
    "将 FOFA 搜索结果导出到本地文件（CSV/JSON），不会将数据加入上下文，适用于大量数据导出。需要指定输出文件的绝对路径。",
    {
      query: z.string().describe("FOFA 查询语句"),
      output_file: z.string().describe("输出文件的绝对路径，支持 .csv 和 .json 格式"),
      fields: z.string().optional().describe(`返回字段，逗号分隔。默认: ${DEFAULT_FIELDS}`),
      page: z.number().int().min(1).optional().describe("页码，默认 1"),
      size: z.number().int().min(1).max(MAX_SIZE).optional().describe("每页数量，默认 100，最大 10000"),
      full: z.boolean().optional().describe("是否搜索全部数据，默认 false"),
    },
    async ({ query, output_file, fields, page, size, full }) => {
      try {
        const f = fields || DEFAULT_FIELDS;
        const p = page || 1;
        const s = Math.min(size || DEFAULT_SIZE, MAX_SIZE);
        const result = await search(config, query, f, p, s, full || false);

        mkdirSync(dirname(output_file), { recursive: true });
        const fieldNames = f.split(",").map((x) => x.trim());
        const ext = extname(output_file).toLowerCase();

        if (ext === ".json") {
          const records = result.results.map((row) => {
            const obj: Record<string, string> = {};
            for (let j = 0; j < row.length && j < fieldNames.length; j++) {
              obj[fieldNames[j]] = row[j];
            }
            return obj;
          });
          writeFileSync(output_file, JSON.stringify(records, null, 2), "utf-8");
        } else {
          const outPath = ext === ".csv" ? output_file : output_file + ".csv";
          let csv = "\uFEFF" + fieldNames.join(",") + "\n";
          for (const row of result.results) {
            csv += row.map(escapeCsv).join(",") + "\n";
          }
          writeFileSync(outPath, csv, "utf-8");
        }

        const summary = `导出完成\n文件: ${output_file}\n查询: ${result.query}\n总量: ${result.size}\n导出: ${result.results.length} 条\n字段: ${f}`;
        return { content: [{ type: "text" as const, text: summary }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `导出失败: ${(err as Error).message}` }], isError: true };
      }
    }
  );
}
