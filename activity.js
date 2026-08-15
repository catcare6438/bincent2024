import { getSql, json, err } from '../_utils/db.js';
import { requireAdmin } from '../_utils/auth.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!requireAdmin(user)) return err('僅管理員可以查看異動紀錄', 403);

  const sql = getSql(context.env);
  const rows = await sql`
    select id, at, by_name, role, action, cat_id, cat_name, detail
    from activity_log order by at desc limit 300
  `;
  return json(rows.map((r) => ({
    id: r.id, at: +new Date(r.at), by: r.by_name, role: r.role, action: r.action,
    catId: r.cat_id, catName: r.cat_name, detail: r.detail,
  })));
}
