export interface FOFAConfig {
  apiKey: string;
  email: string;
  baseURL: string;
}

export interface FOFASearchResult {
  error: boolean;
  errmsg: string;
  mode: string;
  page: number;
  query: string;
  results: string[][];
  size: number;
}

const DEFAULT_FIELDS = "ip,port,protocol,host,domain,title,server";
const DEFAULT_SIZE = 100;
const MAX_SIZE = 10000;

export function isOfficialAPI(baseURL: string): boolean {
  return ["https://fofa.info", "https://fofapro.com"].includes(baseURL);
}

export async function fofaSearch(
  config: FOFAConfig,
  query: string,
  fields = DEFAULT_FIELDS,
  page = 1,
  size = DEFAULT_SIZE,
  full = false
): Promise<FOFASearchResult> {
  if (!config.apiKey) throw new Error("API Key 未设置");

  const params = new URLSearchParams();
  params.set("email", config.email);
  params.set("key", config.apiKey);
  params.set("qbase64", btoa(query));
  params.set("fields", fields);
  params.set("page", String(page));
  params.set("size", String(Math.min(size, MAX_SIZE)));
  if (full) params.set("full", "true");

  const resp = await fetch(`${config.baseURL}/api/v1/search/all?${params}`);
  const text = await resp.text();

  let data: FOFASearchResult;
  try {
    data = JSON.parse(text) as FOFASearchResult;
  } catch {
    throw new Error(`FOFA API 返回异常 (HTTP ${resp.status}): ${text.substring(0, 200)}`);
  }

  if (data.error) throw new Error(`FOFA API 错误: ${data.errmsg}`);
  return data;
}

export function formatResults(result: FOFASearchResult, fields: string): string {
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
