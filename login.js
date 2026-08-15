import { getSql, json, err } from '../../_utils/db.js';
import { signToken, verifyPassword } from '../../_utils/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const { role, volunteerId, password } = body;

  if (!password) return err('請輸入密碼', 400);

  if (role === 'admin') {
    if (!env.ADMIN_PASSWORD) return err('伺服器尚未設定管理員密碼', 500);
    if (password !== env.ADMIN_PASSWORD) return err('管理員密碼錯誤', 401);
    const token = await signToken({ sub: 'admin', name: '管理員', role: '管理員' }, env.AUTH_SECRET);
    return json({ token, user: { name: '管理員', role: '管理員' } });
  }

  if (!volunteerId) return err('請選擇志工帳號', 400);
  const sql = getSql(env);
  const rows = await sql`
    select id, name, password_hash, salt, active from volunteers where id = ${volunteerId}
  `;
  const v = rows[0];
  if (!v || v.active === false) return err('帳號不存在或已停用', 401);

  const ok = await verifyPassword(password, v.password_hash, v.salt);
  if (!ok) return err('密碼錯誤', 401);

  const token = await signToken({ sub: v.id, name: v.name, role: '志工' }, env.AUTH_SECRET);
  return json({ token, user: { name: v.name, role: '志工' } });
}
