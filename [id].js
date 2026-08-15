import { getSql, json, err } from '../../../_utils/db.js';

export async function onRequestGet(context) {
  const sql = getSql(context.env);
  const id = context.params.id;

  const rows = await sql`
    select id, name, gender, age, color, personality_tags, status, health_status, ai_intro, ai_adoption_text
    from cats where id = ${id}
  `;
  const c = rows[0];
  if (!c) return err('找不到這筆貓咪資料', 404);

  const photos = await sql`
    select data_url, is_main from cat_photos where cat_id = ${id} order by is_main desc, created_at asc
  `;

  return json({
    id: c.id,
    name: c.name,
    gender: c.gender,
    age: c.age,
    color: c.color,
    personalityTags: c.personality_tags || [],
    status: c.status,
    healthStatus: c.health_status,
    adoptionText: c.ai_adoption_text,
    photos: photos.map((p) => p.data_url),
  });
}
