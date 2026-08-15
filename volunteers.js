import { getSql, json, err } from '../_utils/db.js';
import { hashPassword, requireAdmin } from '../_utils/auth.js';
import { logActivity } from '../_utils/cats.js';

export async function onRequestGet(context) {
  const sql = getSql(context.env);
  const rows = await sql`select id, name, active, created_at from volunteers order by created_at asc`;
  return json(rows.map((v) => ({ id: v.id, name: v.name, active: v.active })));
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const user = data.user;
  if (!requireAdmin(user)) return err('僅管理員可以新增志工帳號', 403);

  const body = await request.json().catch(() => ({}));
  const name = (body.name || '').trim();
  const password = body.password || '';
  if (!name) return err('請輸入姓名', 400);
  if (!password) return err('請設定密碼', 400);

  const sql = getSql(env);
  const { hash, salt } = await hashPassword(password);
  const rows = await sql`
    insert into volunteers (name, password_hash, salt, active)
    values (${name}, ${hash}, ${salt}, true)
    returning id, name, active
  `;
  await logActivity(sql, { by: user.name, role: user.role, action: '新增志工帳號', detail: `新增志工「${name}」` });
  return json(rows[0], 201);
}
