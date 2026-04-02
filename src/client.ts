const DEFAULT_BASE_URL = "https://fofa.info";

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

export function loadConfig(): FOFAConfig {
  return {
    apiKey: process.env.FOFA_API_KEY || "",
    email: process.env.FOFA_EMAIL || "fofa@fofa.info",
    baseURL: (process.env.FOFA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
  };
}

export function isOfficialAPI(baseURL: string): boolean {
  return [DEFAULT_BASE_URL, "https://fofa.info", "https://fofapro.com"].includes(baseURL);
}

async function request<T>(config: FOFAConfig, path: string, params: URLSearchParams): Promise<T> {
  if (!config.apiKey) throw new Error("FOFA_API_KEY 环境变量未设置");

  params.set("email", config.email);
  params.set("key", config.apiKey);

  const url = `${config.baseURL}${path}?${params.toString()}`;
  const resp = await fetch(url);
  const data = (await resp.json()) as { error: boolean; errmsg: string };

  if (data.error) throw new Error(`FOFA API 错误: ${data.errmsg}`);
  return data as T;
}

export async function search(
  config: FOFAConfig,
  query: string,
  fields: string,
  page: number,
  size: number,
  full: boolean
): Promise<FOFASearchResult> {
  const params = new URLSearchParams();
  params.set("qbase64", Buffer.from(query).toString("base64"));
  params.set("fields", fields);
  params.set("page", String(page));
  params.set("size", String(size));
  if (full) params.set("full", "true");

  return request<FOFASearchResult>(config, "/api/v1/search/all", params);
}

export async function userInfo(config: FOFAConfig): Promise<Record<string, unknown>> {
  return request(config, "/api/v1/info/my", new URLSearchParams());
}

export async function stats(config: FOFAConfig, query: string, fields?: string): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  params.set("qbase64", Buffer.from(query).toString("base64"));
  if (fields) params.set("fields", fields);
  return request(config, "/api/v1/search/stats", params);
}

export async function hostDetail(config: FOFAConfig, host: string, detail: boolean): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  if (detail) params.set("detail", "true");
  return request(config, `/api/v1/host/${encodeURIComponent(host)}`, params);
}
