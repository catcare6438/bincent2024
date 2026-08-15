import { getSql, json, err } from '../../_utils/db.js';
import { hashPassword, requireAdmin } from '../../_utils/auth.js';
import { logActivity } from '../../_utils/cats.js';

export async function onRequestPatch(context) {
  const { request, env, data, params } = context;
  const user = data.user;
  if (!requireAdmin(user)) return err('僅管理員可以管理志工帳號', 403);

  const body = await request.json().catch(() => ({}));
  const sql = getSql(env);

  const rows = await sql`select id, name, active from volunteers where id = ${params.id}`;
  const v = rows[0];
  if (!v) return err('找不到這位志工', 404);

  if (body.action === 'reset-password') {
    if (!body.password) return err('請輸入新密碼', 400);
    const { hash, salt } = await hashPassword(body.password);
    await sql`update volunteers set password_hash = ${hash}, salt = ${salt} where id = ${params.id}`;
    await logActivity(sql, { by: user.name, role: user.role, action: '重設志工密碼', detail: `重設「${v.name}」的密碼` });
    return json({ ok: true });
  }

  if (body.action === 'toggle-active') {
    const nextActive = !(v.active !== false);
    await sql`update volunteers set active = ${nextActive} where id = ${params.id}`;
    await logActivity(sql, { by: user.name, role: user.role, action: nextActive ? '啟用志工帳號' : '停用志工帳號', detail: v.name });
    return json({ ok: true, active: nextActive });
  }

  return err('未知的操作類型', 400);
}
