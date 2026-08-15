import { getSql, json } from '../../_utils/db.js';

export async function onRequestGet(context) {
  const sql = getSql(context.env);
  const rows = await sql`select id, name from volunteers where active = true order by name`;
  return json(rows);
}
