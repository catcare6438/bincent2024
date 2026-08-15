import { getSql, json, err } from '../../_utils/db.js';
import { fetchFullCat, logActivity } from '../../_utils/cats.js';

export async function onRequestGet(context) {
  const sql = getSql(context.env);
  const cat = await fetchFullCat(sql, context.params.id);
  if (!cat) return err('找不到這筆貓咪資料', 404);
  return json(cat);
}

export async function onRequestPatch(context) {
  const { request, env, data, params } = context;
  const user = data.user;
  const body = await request.json().catch(() => ({}));
  const sql = getSql(env);
  const h = body.health || {};

  const exists = await sql`select id from cats where id = ${params.id}`;
  if (!exists.length) return err('找不到這筆貓咪資料', 404);

  await sql`
    update cats set
      name = ${body.name}, gender = ${body.gender || null}, age = ${body.age || null}, color = ${body.color || null},
      personality_tags = ${body.personalityTags || []}, foster_date = ${body.fosterDate || null}, rescue_source = ${body.rescueSource || null},
      status = ${body.status}, health_external = ${h.external || null}, health_vaccine = ${h.vaccine || null},
      health_neuter = ${h.neuter || null}, health_chip = ${h.chip || null}, health_status = ${h.status || null}, health_note = ${h.note || null},
      updated_at = now()
    where id = ${params.id}
  `;

  await logActivity(sql, { by: user.name, role: user.role, action: '編輯貓咪資料', catId: params.id, catName: body.name || null, detail: '更新基本／健康資料' });

  const cat = await fetchFullCat(sql, params.id);
  return json(cat);
}
