#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, extname } from "node:path";

const DEFAULT_BASE_URL = "https://fofa.info";
const DEFAULT_FIELDS = "ip,port,protocol,host,domain,title,server";
const DEFAULT_SIZE = 100;
const MAX_SIZE = 10000;

const FOFA_API_KEY = process.env.FOFA_API_KEY || "";
const FOFA_EMAIL = process.env.FOFA_EMAIL || "fofa@fofa.info";
const FOFA_BASE_URL = (process.env.FOFA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

const isOfficial = [DEFAULT_BASE_URL, "https://fofa.info", "https://fofapro.com"].includes(FOFA_BASE_URL);

async function fofaRequest(path, params) {
  if (!FOFA_API_KEY) throw new Error("FOFA_API_KEY 环境变量未设置");

  params.set("email", FOFA_EMAIL);
  params.set("key", FOFA_API_KEY);

  const url = `${FOFA_BASE_URL}${path}?${params.toString()}`;
  const resp = await fetch(url);
  const data = await resp.json();

  if (data.error) throw new Error(`FOFA API 错误: ${data.errmsg}`);
  return data;
}

async function fofaSearch(query, fields, page, size, full) {
  const params = new URLSearchParams();
  params.set("qbase64", Buffer.from(query).toString("base64"));
  params.set("fields", fields);
  params.set("page", String(page));
  params.set("size", String(size));
  if (full) params.set("full", "true");

  return fofaRequest("/api/v1/search/all", params);
}

function formatResults(result, fields) {
  const fieldNames = fields.split(",").map((f) => f.trim());
  let out = `查询: ${result.query}\n模式: ${result.mode} | 页码: ${result.page} | 结果数: ${result.results.length}\n\n`;

  for (let i = 0; i < result.results.length; i++) {
    const row = result.results[i];
    out += `--- 结果 #${i + 1} ---\n`;
    for (let j = 0; j < row.length && j < fieldNames.length; j++) {
      out += `  ${fieldNames[j]}: ${row[j]}\n`;
    }
  }
  return out;
}

const server = new McpServer({
  name: "fofa-mcp",
  version: "0.4.0",
});

// Tool: fofa_search
server.tool(
  "fofa_search",
  "使用 FOFA 搜索引擎查询网络资产。支持 FOFA 查询语法，如 domain=\"example.com\"、ip=\"1.1.1.1\"、title=\"login\" 等。",
  {
    query: z.string().describe('FOFA 查询语句，例如: domain="example.com", app="Apache", title="后台"'),
    fields: z.string().optional().describe("返回字段，逗号分隔。可选: ip,port,protocol,host,domain,title,server,country,city,as_organization,banner,cert,os,icp,product 等。默认: ip,port,protocol,host,domain,title,server"),
    page: z.number().int().min(1).optional().describe("页码，默认 1"),
    size: z.number().int().min(1).max(MAX_SIZE).optional().describe("每页数量，默认 100，最大 10000"),
    full: z.boolean().optional().describe("是否搜索全部数据，默认 false（仅搜索最近一年）"),
  },
  async ({ query, fields, page, size, full }) => {
    try {
      const f = fields || DEFAULT_FIELDS;
      const p = page || 1;
      const s = Math.min(size || DEFAULT_SIZE, MAX_SIZE);
      const result = await fofaSearch(query, f, p, s, full || false);
      return { content: [{ type: "text", text: formatResults(result, f) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `查询失败: ${err.message}` }], isError: true };
    }
  }
);

// Tool: fofa_export
server.tool(
  "fofa_export",
  "将 FOFA 搜索结果导出到本地文件（CSV/JSON），不会将数据加入上下文，适用于大量数据导出。需要指定输出文件的绝对路径。",
  {
    query: z.string().describe("FOFA 查询语句"),
    output_file: z.string().describe("输出文件的绝对路径，支持 .csv 和 .json 格式，根据后缀自动判断格式"),
    fields: z.string().optional().describe("返回字段，逗号分隔。默认: ip,port,protocol,host,domain,title,server"),
    page: z.number().int().min(1).optional().describe("页码，默认 1"),
    size: z.number().int().min(1).max(MAX_SIZE).optional().describe("每页数量，默认 100，最大 10000"),
    full: z.boolean().optional().describe("是否搜索全部数据，默认 false"),
  },
  async ({ query, output_file, fields, page, size, full }) => {
    try {
      const f = fields || DEFAULT_FIELDS;
      const p = page || 1;
      const s = Math.min(size || DEFAULT_SIZE, MAX_SIZE);
      const result = await fofaSearch(query, f, p, s, full || false);

      mkdirSync(dirname(output_file), { recursive: true });

      const fieldNames = f.split(",").map((x) => x.trim());
      const ext = extname(output_file).toLowerCase();

      if (ext === ".json") {
        const records = result.results.map((row) => {
          const obj = {};
          for (let j = 0; j < row.length && j < fieldNames.length; j++) {
            obj[fieldNames[j]] = row[j];
          }
          return obj;
        });
        writeFileSync(output_file, JSON.stringify(records, null, 2), "utf-8");
      } else {
        const csvFile = ext === ".csv" ? output_file : output_file + ".csv";
        const escapeCsv = (v) => {
          if (v.includes(",") || v.includes('"') || v.includes("\n")) {
            return '"' + v.replace(/"/g, '""') + '"';
          }
          return v;
        };
        let csv = "\uFEFF" + fieldNames.join(",") + "\n";
        for (const row of result.results) {
          csv += row.map(escapeCsv).join(",") + "\n";
        }
        writeFileSync(csvFile, csv, "utf-8");
      }

      const summary = `导出完成\n文件: ${output_file}\n查询: ${result.query}\n总量: ${result.size}\n导出: ${result.results.length} 条\n字段: ${f}`;
      return { content: [{ type: "text", text: summary }] };
    } catch (err) {
      return { content: [{ type: "text", text: `导出失败: ${err.message}` }], isError: true };
    }
  }
);

// 以下工具仅在使用官方 FOFA API 时注册
if (isOfficial) {
  // Tool: fofa_user_info
  server.tool(
    "fofa_user_info",
    "查询当前 FOFA 账户信息，包括邮箱、F币余额、VIP等级等。",
    async () => {
      try {
        const result = await fofaRequest("/api/v1/info/my", new URLSearchParams());
        const text = `邮箱: ${result.email}\nF币: ${result.fcoin}\nVIP等级: ${result.vip_level}\n是否VIP: ${result.isvip}`;
        return { content: [{ type: "text", text }] };
      } catch (err) {
        return { content: [{ type: "text", text: `查询失败: ${err.message}` }], isError: true };
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
        const params = new URLSearchParams();
        params.set("qbase64", Buffer.from(query).toString("base64"));
        if (fields) params.set("fields", fields);
        const result = await fofaRequest("/api/v1/search/stats", params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `查询失败: ${err.message}` }], isError: true };
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
        const params = new URLSearchParams();
        if (detail) params.set("detail", "true");
        const result = await fofaRequest(`/api/v1/host/${encodeURIComponent(host)}`, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `查询失败: ${err.message}` }], isError: true };
      }
    }
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
