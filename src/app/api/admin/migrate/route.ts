import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { requireAdmin } from '@/lib/adminAuth';
import { MIGRATIONS } from '@/lib/migrations';

/**
 * 管理员数据库迁移：一键执行 supabase/migrations 里的 SQL。
 *
 * - 身份：请求头 Authorization: Bearer <access_token>，服务端验签后要求
 *   user.email === ADMIN_EMAIL（站长邮箱），其他人 403。
 * - 执行：直连 Postgres（环境变量 SUPABASE_DB_URL），按 version 顺序跑
 *   MIGRATIONS 里尚未执行的条目，每条包在事务里，成功记入
 *   public.schema_migrations。
 * - 安全：只执行仓库自带的 SQL，不接受任何外部输入的 SQL。
 *
 * GET  -> 返回每条迁移的执行状态（需管理员）
 * POST -> 执行所有待跑迁移，返回逐条结果（需管理员）
 */

const DB_URL = process.env.SUPABASE_DB_URL;

async function db(): Promise<Client> {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  return client;
}

async function appliedVersions(client: Client): Promise<Set<string>> {
  await client.query(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  const { rows } = await client.query('select version from public.schema_migrations;');
  return new Set(rows.map((r: { version: string }) => r.version));
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: '需要站长登录' }, { status: 403 });
  }
  if (!DB_URL) {
    return NextResponse.json({
      configured: false,
      hint: '服务端未配置 SUPABASE_DB_URL：去 Supabase Dashboard → Project Settings → Database → Connect，对话框里选 Transaction pooler（serverless 适用）、Type 选 URI，拷贝连接串并把 [YOUR-PASSWORD] 换成你的数据库密码，加到 Vercel 环境变量后重新部署。',
      migrations: MIGRATIONS.map((m) => ({ version: m.version, name: m.name, applied: null })),
    });
  }
  let client: Client;
  try {
    client = await db();
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: `数据库连接失败：${e instanceof Error ? e.message : String(e)}。请检查 Vercel 的 SUPABASE_DB_URL：密码对吗？拷贝的是 Transaction pooler 的 URI 吗？`,
      },
      { status: 500 }
    );
  }
  try {
    const done = await appliedVersions(client);
    return NextResponse.json({
      configured: true,
      migrations: MIGRATIONS.map((m) => ({
        version: m.version,
        name: m.name,
        applied: done.has(m.version),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `读取迁移状态失败：${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  } finally {
    await client.end().catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: '需要站长登录' }, { status: 403 });
  }
  if (!DB_URL) {
    return NextResponse.json({ error: '服务端未配置 SUPABASE_DB_URL' }, { status: 500 });
  }
  let client: Client;
  try {
    client = await db();
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: `数据库连接失败：${e instanceof Error ? e.message : String(e)}。请检查 Vercel 的 SUPABASE_DB_URL：密码对吗？拷贝的是 Transaction pooler 的 URI 吗？`,
      },
      { status: 500 }
    );
  }
  const results: Array<{ version: string; name: string; status: string; error?: string }> = [];
  try {
    const done = await appliedVersions(client);
    for (const m of MIGRATIONS) {
      if (done.has(m.version)) {
        results.push({ version: m.version, name: m.name, status: 'skipped' });
        continue;
      }
      try {
        await client.query('BEGIN');
        await client.query(m.sql);
        // 版本号为仓库硬编码（字母/数字/下划线），直接拼串以兼容事务连接池
        const v = m.version.replace(/'/g, "''");
        await client.query(`insert into public.schema_migrations (version) values ('${v}');`);
        await client.query('COMMIT');
        results.push({ version: m.version, name: m.name, status: 'applied' });
      } catch (e) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* 忽略回滚失败 */
        }
        results.push({
          version: m.version,
          name: m.name,
          status: 'failed',
          error: e instanceof Error ? e.message : String(e),
        });
        break; // 出错即停，后面的不跑
      }
    }
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: `执行失败：${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  } finally {
    await client.end().catch(() => {});
  }
}
