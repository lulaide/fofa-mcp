package main

import (
	"context"
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const (
	defaultBaseURL = "https://fofa.info"
	defaultFields  = "ip,port,protocol,host,domain,title,server"
	defaultSize    = 100
	maxSize        = 10000
)

type FOFAClient struct {
	BaseURL    string
	APIKey     string
	Email      string
	HTTPClient *http.Client
}

type FOFASearchResponse struct {
	Error   bool       `json:"error"`
	ErrMsg  string     `json:"errmsg"`
	Mode    string     `json:"mode"`
	Page    int        `json:"page"`
	Query   string     `json:"query"`
	Results [][]string `json:"results"`
	Size    int        `json:"size"`
}

type FOFAUserResponse struct {
	Error   bool   `json:"error"`
	ErrMsg  string `json:"errmsg"`
	Email   string `json:"email"`
	FCoin   int    `json:"fcoin"`
	VIPLevel int  `json:"vip_level"`
	IsVIP   bool   `json:"isvip"`
	Avatar  string `json:"avatar"`
}

type FOFAStatsResponse struct {
	Error   bool              `json:"error"`
	ErrMsg  string            `json:"errmsg"`
	Distinct map[string][]struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	} `json:"distinct"`
	Aggs map[string][]struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	} `json:"aggs"`
}

func NewFOFAClient() *FOFAClient {
	baseURL := os.Getenv("FOFA_BASE_URL")
	if baseURL == "" {
		baseURL = defaultBaseURL
	}
	baseURL = strings.TrimRight(baseURL, "/")

	email := os.Getenv("FOFA_EMAIL")
	if email == "" {
		email = "fofa@fofa.info"
	}

	return &FOFAClient{
		BaseURL:    baseURL,
		APIKey:     os.Getenv("FOFA_API_KEY"),
		Email:      email,
		HTTPClient: &http.Client{},
	}
}

func (c *FOFAClient) Search(ctx context.Context, query string, fields string, page, size int, full bool) (*FOFASearchResponse, error) {
	if c.APIKey == "" {
		return nil, fmt.Errorf("FOFA_API_KEY 环境变量未设置")
	}

	qbase64 := base64.StdEncoding.EncodeToString([]byte(query))

	params := url.Values{}
	params.Set("email", c.Email)
	params.Set("key", c.APIKey)
	params.Set("qbase64", qbase64)
	params.Set("fields", fields)
	params.Set("page", strconv.Itoa(page))
	params.Set("size", strconv.Itoa(size))
	if full {
		params.Set("full", "true")
	}

	reqURL := fmt.Sprintf("%s/api/v1/search/all?%s", c.BaseURL, params.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 FOFA API 失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var result FOFASearchResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if result.Error {
		return nil, fmt.Errorf("FOFA API 错误: %s", result.ErrMsg)
	}

	return &result, nil
}

func (c *FOFAClient) UserInfo(ctx context.Context) (*FOFAUserResponse, error) {
	if c.APIKey == "" {
		return nil, fmt.Errorf("FOFA_API_KEY 环境变量未设置")
	}

	params := url.Values{}
	params.Set("email", c.Email)
	params.Set("key", c.APIKey)

	reqURL := fmt.Sprintf("%s/api/v1/info/my?%s", c.BaseURL, params.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 FOFA API 失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var result FOFAUserResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if result.Error {
		return nil, fmt.Errorf("FOFA API 错误: %s", result.ErrMsg)
	}

	return &result, nil
}

func (c *FOFAClient) Stats(ctx context.Context, query string, fields string) (*FOFAStatsResponse, error) {
	if c.APIKey == "" {
		return nil, fmt.Errorf("FOFA_API_KEY 环境变量未设置")
	}

	qbase64 := base64.StdEncoding.EncodeToString([]byte(query))

	params := url.Values{}
	params.Set("email", c.Email)
	params.Set("key", c.APIKey)
	params.Set("qbase64", qbase64)
	if fields != "" {
		params.Set("fields", fields)
	}

	reqURL := fmt.Sprintf("%s/api/v1/search/stats?%s", c.BaseURL, params.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 FOFA API 失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var result FOFAStatsResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if result.Error {
		return nil, fmt.Errorf("FOFA API 错误: %s", result.ErrMsg)
	}

	return &result, nil
}

func (c *FOFAClient) HostDetail(ctx context.Context, host string, detail bool) (json.RawMessage, error) {
	if c.APIKey == "" {
		return nil, fmt.Errorf("FOFA_API_KEY 环境变量未设置")
	}

	params := url.Values{}
	params.Set("email", c.Email)
	params.Set("key", c.APIKey)
	if detail {
		params.Set("detail", "true")
	}

	reqURL := fmt.Sprintf("%s/api/v1/host/%s?%s", c.BaseURL, url.PathEscape(host), params.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 FOFA API 失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var check struct {
		Error  bool   `json:"error"`
		ErrMsg string `json:"errmsg"`
	}
	if err := json.Unmarshal(body, &check); err == nil && check.Error {
		return nil, fmt.Errorf("FOFA API 错误: %s", check.ErrMsg)
	}

	return body, nil
}

func isOfficialFOFA(baseURL string) bool {
	return baseURL == defaultBaseURL || baseURL == "https://fofa.info" || baseURL == "https://fofapro.com"
}

func main() {
	client := NewFOFAClient()
	official := isOfficialFOFA(client.BaseURL)

	server := mcp.NewServer(
		&mcp.Implementation{
			Name:    "fofa-mcp",
			Version: version(),
		},
		nil,
	)

	// Tool: fofa_search
	server.AddTool(
		&mcp.Tool{
			Name:        "fofa_search",
			Description: "使用 FOFA 搜索引擎查询网络资产。支持 FOFA 查询语法，如 domain=\"example.com\"、ip=\"1.1.1.1\"、title=\"login\" 等。",
			InputSchema: json.RawMessage(`{
				"type": "object",
				"properties": {
					"query": {
						"type": "string",
						"description": "FOFA 查询语句，例如: domain=\"example.com\", app=\"Apache\", title=\"后台\""
					},
					"fields": {
						"type": "string",
						"description": "返回字段，逗号分隔。可选: ip,port,protocol,host,domain,title,server,country,city,as_organization,banner,cert,os,icp,product 等。默认: ip,port,protocol,host,domain,title,server"
					},
					"page": {
						"type": "integer",
						"description": "页码，默认 1",
						"minimum": 1
					},
					"size": {
						"type": "integer",
						"description": "每页数量，默认 100，最大 10000",
						"minimum": 1,
						"maximum": 10000
					},
					"full": {
						"type": "boolean",
						"description": "是否搜索全部数据，默认 false（仅搜索最近一年）"
					}
				},
				"required": ["query"]
			}`),
		},
		func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			var args struct {
				Query  string `json:"query"`
				Fields string `json:"fields"`
				Page   int    `json:"page"`
				Size   int    `json:"size"`
				Full   bool   `json:"full"`
			}
			if err := json.Unmarshal(req.Params.Arguments, &args); err != nil {
				return nil, fmt.Errorf("参数解析失败: %w", err)
			}

			if args.Fields == "" {
				args.Fields = defaultFields
			}
			if args.Page <= 0 {
				args.Page = 1
			}
			if args.Size <= 0 {
				args.Size = defaultSize
			}
			if args.Size > maxSize {
				args.Size = maxSize
			}

			result, err := client.Search(ctx, args.Query, args.Fields, args.Page, args.Size, args.Full)
			if err != nil {
				return &mcp.CallToolResult{
					Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("查询失败: %v", err)}},
					IsError: true,
				}, nil
			}

			fieldNames := strings.Split(args.Fields, ",")
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("查询: %s\n模式: %s | 页码: %d | 结果数: %d\n\n", result.Query, result.Mode, result.Page, len(result.Results)))

			for i, row := range result.Results {
				sb.WriteString(fmt.Sprintf("--- 结果 #%d ---\n", i+1))
				for j, val := range row {
					if j < len(fieldNames) {
						sb.WriteString(fmt.Sprintf("  %s: %s\n", strings.TrimSpace(fieldNames[j]), val))
					}
				}
			}

			return &mcp.CallToolResult{
				Content: []mcp.Content{&mcp.TextContent{Text: sb.String()}},
			}, nil
		},
	)

	// Tool: fofa_export
	server.AddTool(
		&mcp.Tool{
			Name:        "fofa_export",
			Description: "将 FOFA 搜索结果导出到本地文件（CSV/JSON），不会将数据加入上下文，适用于大量数据导出。需要指定输出文件的绝对路径。",
			InputSchema: json.RawMessage(`{
				"type": "object",
				"properties": {
					"query": {
						"type": "string",
						"description": "FOFA 查询语句"
					},
					"output_file": {
						"type": "string",
						"description": "输出文件的绝对路径，支持 .csv 和 .json 格式，根据后缀自动判断格式"
					},
					"fields": {
						"type": "string",
						"description": "返回字段，逗号分隔。默认: ip,port,protocol,host,domain,title,server"
					},
					"page": {
						"type": "integer",
						"description": "页码，默认 1",
						"minimum": 1
					},
					"size": {
						"type": "integer",
						"description": "每页数量，默认 100，最大 10000",
						"minimum": 1,
						"maximum": 10000
					},
					"full": {
						"type": "boolean",
						"description": "是否搜索全部数据，默认 false"
					}
				},
				"required": ["query", "output_file"]
			}`),
		},
		func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			var args struct {
				Query      string `json:"query"`
				OutputFile string `json:"output_file"`
				Fields     string `json:"fields"`
				Page       int    `json:"page"`
				Size       int    `json:"size"`
				Full       bool   `json:"full"`
			}
			if err := json.Unmarshal(req.Params.Arguments, &args); err != nil {
				return nil, fmt.Errorf("参数解析失败: %w", err)
			}

			if args.Fields == "" {
				args.Fields = defaultFields
			}
			if args.Page <= 0 {
				args.Page = 1
			}
			if args.Size <= 0 {
				args.Size = defaultSize
			}
			if args.Size > maxSize {
				args.Size = maxSize
			}

			result, err := client.Search(ctx, args.Query, args.Fields, args.Page, args.Size, args.Full)
			if err != nil {
				return &mcp.CallToolResult{
					Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("查询失败: %v", err)}},
					IsError: true,
				}, nil
			}

			// 确保输出目录存在
			dir := filepath.Dir(args.OutputFile)
			if err := os.MkdirAll(dir, 0755); err != nil {
				return &mcp.CallToolResult{
					Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("创建目录失败: %v", err)}},
					IsError: true,
				}, nil
			}

			fieldNames := strings.Split(args.Fields, ",")
			for i := range fieldNames {
				fieldNames[i] = strings.TrimSpace(fieldNames[i])
			}

			ext := strings.ToLower(filepath.Ext(args.OutputFile))

			switch ext {
			case ".json":
				// JSON 格式：每行一个对象
				f, err := os.Create(args.OutputFile)
				if err != nil {
					return &mcp.CallToolResult{
						Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("创建文件失败: %v", err)}},
						IsError: true,
					}, nil
				}
				defer f.Close()

				var records []map[string]string
				for _, row := range result.Results {
					record := make(map[string]string)
					for j, val := range row {
						if j < len(fieldNames) {
							record[fieldNames[j]] = val
						}
					}
					records = append(records, record)
				}
				enc := json.NewEncoder(f)
				enc.SetIndent("", "  ")
				if err := enc.Encode(records); err != nil {
					return &mcp.CallToolResult{
						Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("写入 JSON 失败: %v", err)}},
						IsError: true,
					}, nil
				}

			default:
				// CSV 格式（默认）
				if ext != ".csv" {
					args.OutputFile += ".csv"
				}
				f, err := os.Create(args.OutputFile)
				if err != nil {
					return &mcp.CallToolResult{
						Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("创建文件失败: %v", err)}},
						IsError: true,
					}, nil
				}
				defer f.Close()

				// 写入 UTF-8 BOM 以兼容 Excel
				f.Write([]byte{0xEF, 0xBB, 0xBF})

				w := csv.NewWriter(f)
				w.Write(fieldNames)
				for _, row := range result.Results {
					w.Write(row)
				}
				w.Flush()
				if err := w.Error(); err != nil {
					return &mcp.CallToolResult{
						Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("写入 CSV 失败: %v", err)}},
						IsError: true,
					}, nil
				}
			}

			summary := fmt.Sprintf("导出完成\n文件: %s\n查询: %s\n总量: %d\n导出: %d 条\n字段: %s",
				args.OutputFile, result.Query, result.Size, len(result.Results), args.Fields)

			return &mcp.CallToolResult{
				Content: []mcp.Content{&mcp.TextContent{Text: summary}},
			}, nil
		},
	)

	// 以下工具仅在使用官方 FOFA API 时注册（中转 API 通常不支持）
	if official {
		// Tool: fofa_user_info
		server.AddTool(
			&mcp.Tool{
				Name:        "fofa_user_info",
				Description: "查询当前 FOFA 账户信息，包括邮箱、F币余额、VIP等级等。",
				InputSchema: json.RawMessage(`{"type": "object", "properties": {}}`),
			},
			func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				result, err := client.UserInfo(ctx)
				if err != nil {
					return &mcp.CallToolResult{
						Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("查询失败: %v", err)}},
						IsError: true,
					}, nil
				}

				text := fmt.Sprintf("邮箱: %s\nF币: %d\nVIP等级: %d\n是否VIP: %v",
					result.Email, result.FCoin, result.VIPLevel, result.IsVIP)

				return &mcp.CallToolResult{
					Content: []mcp.Content{&mcp.TextContent{Text: text}},
				}, nil
			},
		)

		// Tool: fofa_stats
		server.AddTool(
			&mcp.Tool{
				Name:        "fofa_stats",
				Description: "对 FOFA 查询结果进行统计聚合分析，获取字段分布情况。",
				InputSchema: json.RawMessage(`{
					"type": "object",
					"properties": {
						"query": {
							"type": "string",
							"description": "FOFA 查询语句"
						},
						"fields": {
							"type": "string",
							"description": "统计字段，逗号分隔。可选: country,province,city,as_organization,port,protocol,title,domain,os 等"
						}
					},
					"required": ["query"]
				}`),
			},
			func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				var args struct {
					Query  string `json:"query"`
					Fields string `json:"fields"`
				}
				if err := json.Unmarshal(req.Params.Arguments, &args); err != nil {
					return nil, fmt.Errorf("参数解析失败: %w", err)
				}

				result, err := client.Stats(ctx, args.Query, args.Fields)
				if err != nil {
					return &mcp.CallToolResult{
						Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("查询失败: %v", err)}},
						IsError: true,
					}, nil
				}

				data, _ := json.MarshalIndent(result, "", "  ")
				return &mcp.CallToolResult{
					Content: []mcp.Content{&mcp.TextContent{Text: string(data)}},
				}, nil
			},
		)

		// Tool: fofa_host
		server.AddTool(
			&mcp.Tool{
				Name:        "fofa_host",
				Description: "查询指定主机（IP/域名）的详细信息，包括开放端口、服务、组件等。",
				InputSchema: json.RawMessage(`{
					"type": "object",
					"properties": {
						"host": {
							"type": "string",
							"description": "目标主机 IP 或域名"
						},
						"detail": {
							"type": "boolean",
							"description": "是否获取详细信息，默认 false"
						}
					},
					"required": ["host"]
				}`),
			},
			func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				var args struct {
					Host   string `json:"host"`
					Detail bool   `json:"detail"`
				}
				if err := json.Unmarshal(req.Params.Arguments, &args); err != nil {
					return nil, fmt.Errorf("参数解析失败: %w", err)
				}

				result, err := client.HostDetail(ctx, args.Host, args.Detail)
				if err != nil {
					return &mcp.CallToolResult{
						Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("查询失败: %v", err)}},
						IsError: true,
					}, nil
				}

				var pretty json.RawMessage
				if err := json.Unmarshal(result, &pretty); err == nil {
					formatted, _ := json.MarshalIndent(pretty, "", "  ")
					return &mcp.CallToolResult{
						Content: []mcp.Content{&mcp.TextContent{Text: string(formatted)}},
					}, nil
				}

				return &mcp.CallToolResult{
					Content: []mcp.Content{&mcp.TextContent{Text: string(result)}},
				}, nil
			},
		)
	}

	if err := server.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
		log.Fatal(err)
	}
}

var Version = "dev"

func version() string {
	return Version
}
