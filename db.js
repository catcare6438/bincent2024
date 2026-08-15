import { neon } from '@neondatabase/serverless';

// 建立 Neon 的 SQL 標籤函式。DATABASE_URL 只存在 Cloudflare 的環境變數/Secrets 裡，
// 前端跟這支程式碼本身都看不到真正的連線字串。
export function getSql(env) {
  if (!env.DATABASE_URL) {
    throw new Error('尚未設定 DATABASE_URL，請到 Cloudflare Pages 的 Settings → Environment variables 設定');
  }
  return neon(env.DATABASE_URL);
}

export function json(obj, status = 200, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign(
      { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      extraHeaders || {}
    ),
  });
}

export function err(message, status = 400) {
  return json({ error: message }, status);
}
