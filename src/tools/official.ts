import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type FOFAConfig, userInfo, stats, hostDetail } from "../client.js";

export function registerOfficialTools(server: McpServer, config: FOFAConfig): void {
  // Tool: fofa_user_info
  server.tool(
    "fofa_user_info",
    "查询当前 FOFA 账户信息，包括邮箱、F币余额、VIP等级等。",
    async () => {
      try {
        const result = await userInfo(config);
        const text = `邮箱: ${result.email}\nF币: ${result.fcoin}\nVIP等级: ${result.vip_level}\n是否VIP: ${result.isvip}`;
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `查询失败: ${(err as Error).message}` }], isError: true };
      }
    }
  );

  // Tool: fofa_stats
  server.tool(
    "fofa_stats",
    "对 FOFA 查询结果进行统计聚合分析，获取字段分布情况。",
    {
      query: z.string().describe("FOFA 查询语句"),
      fields: z.string().optional().describe("统计字段，逗号分隔。可选: country,province,city,as_organization,port,protocol,title,domain,os 等"),
    },
    async ({ query, fields }) => {
      try {
        const result = await stats(config, query, fields);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `查询失败: ${(err as Error).message}` }], isError: true };
      }
    }
  );

  // Tool: fofa_host
  server.tool(
    "fofa_host",
    "查询指定主机（IP/域名）的详细信息，包括开放端口、服务、组件等。",
    {
      host: z.string().describe("目标主机 IP 或域名"),
      detail: z.boolean().optional().describe("是否获取详细信息，默认 false"),
    },
    async ({ host, detail }) => {
      try {
        const result = await hostDetail(config, host, detail || false);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `查询失败: ${(err as Error).message}` }], isError: true };
      }
    }
  );
}
