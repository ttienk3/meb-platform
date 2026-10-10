#!/usr/bin/env node
/**
 * MEB ENTERPRISE MCP SERVER
 * Model Context Protocol Server dành riêng cho dự án MEB Multi-Branch Platform
 * Cung cấp công cụ trực tiếp cho:
 * 1. PostgreSQL Supabase Database (Query, Inspect, Metrics)
 * 2. PocketBase SQLite Database (Query, Inspect Collections)
 * 3. MEB Services Health & Verification Engine
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { Pool } = require('pg');
const { DatabaseSync } = require('node:sqlite');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('🔥 [MEB MCP Error]: Thiếu biến môi trường DATABASE_URL trong .env! Vui lòng cấu hình tệp .env.');
  process.exit(1);
}
const PB_DB_PATH = path.join(__dirname, '../pb_engine/pb_data/data.db');
const PROJECT_ROOT = path.join(__dirname, '..');

// PostgreSQL Pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('🔥 [MCP PG Pool Error]:', err.message);
});

// Helper: HTTP check
function checkHttpPort(port, path = '/') {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}${path}`, { timeout: 1500 }, (res) => {
      resolve({ online: true, statusCode: res.statusCode });
    });
    req.on('error', (err) => resolve({ online: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ online: false, error: 'TIMEOUT' }); });
  });
}

const server = new Server(
  {
    name: 'meb-enterprise-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Danh sách các công cụ được hỗ trợ
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'pg_query',
        description: 'Thực thi câu lệnh SQL SELECT/INSERT/UPDATE trên Supabase PostgreSQL của hệ thống MEB. Hỗ trợ truyền tham số parameters an toàn.',
        inputSchema: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'Câu lệnh SQL cần thực thi' },
            params: { type: 'array', description: 'Mảng tham số (nếu có, ví dụ [1, "CN-Q1"])' }
          },
          required: ['sql']
        }
      },
      {
        name: 'pg_list_tables',
        description: 'Liệt kê toàn bộ danh sách các bảng trong PostgreSQL kèm schema và số lượng dòng ước tính.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'pg_describe_table',
        description: 'Xem chi tiết cấu trúc cột, kiểu dữ liệu, khóa chính, khóa ngoại của một bảng trong PostgreSQL.',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: { type: 'string', description: 'Tên bảng cần xem (ví dụ: branches, orders, custom_schema_tables)' }
          },
          required: ['table_name']
        }
      },
      {
        name: 'pg_branch_metrics',
        description: 'Truy xuất chỉ số hoạt động realtime toàn chuỗi (doanh thu hôm nay, két tiền ca bán, nợ khách hàng, số chi nhánh).',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'sqlite_query',
        description: 'Thực thi câu lệnh SQL SELECT trên CSDL SQLite của PocketBase Core Engine (pb_engine/pb_data/data.db).',
        inputSchema: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'Câu lệnh SQL SELECT' }
          },
          required: ['sql']
        }
      },
      {
        name: 'sqlite_list_tables',
        description: 'Liệt kê danh sách tất cả các bảng và collection trong SQLite PocketBase.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'meb_service_health',
        description: 'Kiểm tra trạng thái sẵn sàng của 4 hạ tầng MEB: Express Gateway (4000), Vite Client (5173), PocketBase (8090), PostgreSQL.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'meb_run_verification',
        description: 'Kích hoạt chạy bộ kiểm định hệ thống tự động và trả về báo cáo tóm tắt pass/fail.',
        inputSchema: {
          type: 'object',
          properties: {
            step: { type: 'string', description: 'Tùy chọn: chỉ chạy một bước cụ thể (ví dụ: "9.0") hoặc để trống để chạy tất cả' }
          }
        }
      },
      {
        name: 'meb_list_dynamic_tables',
        description: 'Truy vấn danh mục các bảng dữ liệu No-Code tự sinh (`custom_schema_tables`) kèm số trường và số bản ghi.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'repo_git_status',
        description: 'Kiểm tra trạng thái Git repository (nhánh hiện tại, staged, modified, untracked files).',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'repo_git_diff',
        description: 'Xem Git diff (thay đổi chưa commit hoặc đã stage), có giới hạn dòng để chống tràn context.',
        inputSchema: {
          type: 'object',
          properties: {
            staged: { type: 'boolean', description: 'Xem diff đã staged hay chưa (mặc định false)' },
            path: { type: 'string', description: 'Đường dẫn file cụ thể cần xem diff (tùy chọn)' },
            max_lines: { type: 'number', description: 'Số dòng tối đa (mặc định 100)' }
          }
        }
      },
      {
        name: 'repo_git_log',
        description: 'Xem lịch sử các commit gần đây trong Git repository.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Số commit cần lấy (mặc định 5)' }
          }
        }
      },
      {
        name: 'repo_search_code',
        description: 'Tìm kiếm chuỗi hoặc regex siêu tốc trong toàn bộ mã nguồn repo bằng ripgrep.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Chuỗi hoặc regex cần tìm' },
            subpath: { type: 'string', description: 'Thư mục con cần tìm (ví dụ: server, client, scripts)' }
          },
          required: ['query']
        }
      },
      {
        name: 'repo_run_test',
        description: 'Chạy một kịch bản test cụ thể trong thư mục scripts/ và trả về kết quả cấu trúc JSON.',
        inputSchema: {
          type: 'object',
          properties: {
            script_name: { type: 'string', description: 'Tên file script trong thư mục scripts (ví dụ: test_step6_2_4_pos_checkout_e2e.js)' }
          },
          required: ['script_name']
        }
      }
    ]
  };
});

// Xử lý thực thi công cụ
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'pg_query': {
        const { sql, params = [] } = args || {};
        const startTime = Date.now();
        const res = await pool.query(sql, params);
        const duration = Date.now() - startTime;
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              rowCount: res.rowCount,
              rows: res.rows,
              durationMs: duration
            }, null, 2)
          }]
        };
      }

      case 'pg_list_tables': {
        const query = `
          SELECT 
            table_name,
            table_type
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          ORDER BY table_name ASC;
        `;
        const res = await pool.query(query);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ count: res.rowCount, tables: res.rows }, null, 2)
          }]
        };
      }

      case 'pg_describe_table': {
        const { table_name } = args || {};
        const query = `
          SELECT 
            column_name, 
            data_type, 
            is_nullable, 
            column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position ASC;
        `;
        const res = await pool.query(query, [table_name]);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ table: table_name, columns: res.rows }, null, 2)
          }]
        };
      }

      case 'pg_branch_metrics': {
        const res = await pool.query(`
          SELECT 
            (SELECT COUNT(*) FROM branches WHERE is_active = true) as active_branches,
            (SELECT COUNT(*) FROM shifts WHERE status = 'OPEN') as open_shifts,
            (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE created_at >= CURRENT_DATE) as today_revenue,
            (SELECT COALESCE(SUM(current_debt), 0) FROM partners WHERE current_debt > 0) as total_debt;
        `);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(res.rows[0], null, 2)
          }]
        };
      }

      case 'sqlite_query': {
        const { sql } = args || {};
        if (!fs.existsSync(PB_DB_PATH)) {
          throw new Error(`File SQLite không tồn tại tại: ${PB_DB_PATH}`);
        }
        const db = new DatabaseSync(PB_DB_PATH, { readOnly: true });
        try {
          const stmt = db.prepare(sql);
          const rows = stmt.all();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ count: rows.length, rows }, null, 2)
            }]
          };
        } finally {
          db.close();
        }
      }

      case 'sqlite_list_tables': {
        if (!fs.existsSync(PB_DB_PATH)) {
          throw new Error(`File SQLite không tồn tại tại: ${PB_DB_PATH}`);
        }
        const db = new DatabaseSync(PB_DB_PATH, { readOnly: true });
        try {
          const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;");
          const rows = stmt.all();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ count: rows.length, tables: rows.map(r => r.name) }, null, 2)
            }]
          };
        } finally {
          db.close();
        }
      }

      case 'meb_service_health': {
        const [apiHealth, viteHealth, pbHealth] = await Promise.all([
          checkHttpPort(4000, '/api/runtime/config'),
          checkHttpPort(5173, '/'),
          checkHttpPort(8090, '/api/health')
        ]);

        let pgHealthy = false;
        let pgLatency = 0;
        try {
          const t0 = Date.now();
          await pool.query('SELECT 1');
          pgLatency = Date.now() - t0;
          pgHealthy = true;
        } catch {
          pgHealthy = false;
        }

        const health = {
          timestamp: new Date().toISOString(),
          services: {
            apiGateway: { port: 4000, ...apiHealth },
            clientDev: { port: 5173, ...viteHealth },
            pocketbase: { port: 8090, ...pbHealth },
            postgresql: { online: pgHealthy, latencyMs: pgLatency }
          },
          allHealthy: apiHealth.online && viteHealth.online && pgHealthy
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(health, null, 2)
          }]
        };
      }

      case 'meb_run_verification': {
        const { step } = args || {};
        let cmd = 'node scripts/run_all_step6_tests.js';
        if (step === '9.0') {
          cmd = 'node scripts/test_step9_hq_nocode_dynamic_platform.js';
        }
        const out = execSync(cmd, { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
        return {
          content: [{
            type: 'text',
            text: out
          }]
        };
      }

      case 'meb_list_dynamic_tables': {
        const res = await pool.query(`
          SELECT 
            t.id, t.code, t.name, t.category, t.is_active,
            (SELECT COUNT(*) FROM custom_schema_fields f WHERE f.table_id = t.id) as fields_count,
            (SELECT COUNT(*) FROM custom_schema_actions a WHERE a.table_id = t.id) as actions_count,
            (SELECT COUNT(*) FROM custom_entity_records r WHERE r.table_id = t.id) as records_count
          FROM custom_schema_tables t
          ORDER BY t.created_at ASC;
        `);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ count: res.rowCount, tables: res.rows }, null, 2)
          }]
        };
      }

      case 'repo_git_status': {
        const output = execSync('git status -s -b', { cwd: PROJECT_ROOT, encoding: 'utf8' });
        return {
          content: [{
            type: 'text',
            text: output || 'Clean working tree'
          }]
        };
      }

      case 'repo_git_diff': {
        const { staged = false, path: filePath, max_lines = 100 } = args || {};
        let cmd = `git diff ${staged ? '--staged' : ''}`;
        if (filePath) cmd += ` -- "${filePath}"`;
        const diffOutput = execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf8' });
        const lines = diffOutput.split('\n');
        const truncated = lines.length > max_lines;
        const resultText = lines.slice(0, max_lines).join('\n') + (truncated ? `\n... [Đã cắt ngắn còn ${max_lines}/${lines.length} dòng để bảo vệ context]` : '');
        return {
          content: [{
            type: 'text',
            text: resultText || 'Không có thay đổi nào (diff trống)'
          }]
        };
      }

      case 'repo_git_log': {
        const { limit = 5 } = args || {};
        const output = execSync(`git log -n ${Math.min(limit, 20)} --oneline`, { cwd: PROJECT_ROOT, encoding: 'utf8' });
        return {
          content: [{
            type: 'text',
            text: output || 'Chưa có commit'
          }]
        };
      }

      case 'repo_search_code': {
        const { query, subpath = '.' } = args || {};
        const safeQuery = query.replace(/"/g, '\\"');
        const searchPath = path.join(PROJECT_ROOT, subpath);
        try {
          const output = execSync(`rg -n -i --max-count 30 "${safeQuery}" "${searchPath}"`, { encoding: 'utf8' });
          return {
            content: [{
              type: 'text',
              text: output || 'Không tìm thấy kết quả'
            }]
          };
        } catch {
          return {
            content: [{
              type: 'text',
              text: 'Không tìm thấy kết quả phù hợp'
            }]
          };
        }
      }

      case 'repo_run_test': {
        const { script_name } = args || {};
        const scriptPath = path.join(PROJECT_ROOT, 'scripts', script_name);
        if (!fs.existsSync(scriptPath)) {
          throw new Error(`Script không tồn tại: scripts/${script_name}`);
        }
        const startTime = Date.now();
        try {
          const output = execSync(`node "${scriptPath}"`, { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 30000 });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                script: script_name,
                durationMs: Date.now() - startTime,
                output: output.slice(-2000)
              }, null, 2)
            }]
          };
        } catch (e) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                script: script_name,
                error: e.message,
                output: (e.stdout || e.stderr || '').slice(-2000)
              }, null, 2)
            }]
          };
        }
      }

      default:
        throw new Error(`Công cụ không xác định: ${name}`);
    }
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `🔥 LỖI THỰC THI MCP [${name}]: ${error.message}`
      }]
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 [MEB Enterprise MCP Server] Đã khởi động thành công trên stdio');
}

main().catch((err) => {
  console.error('🔥 [MEB Enterprise MCP Server Fatal]:', err);
  process.exit(1);
});
