import { getSql, json } from '../../_utils/db.js';

function mapPublicCat(row) {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    age: row.age,
    color: row.color,
    personalityTags: row.personality_tags || [],
    status: row.status,
    healthStatus: row.health_status,
    mainPhoto: row.main_photo,
  };
}

export async function onRequestGet(context) {
  const sql = getSql(context.env);
  const rows = await sql`
    select c.id, c.name, c.gender, c.age, c.color, c.personality_tags, c.status, c.health_status,
      (select p.data_url from cat_photos p where p.cat_id = c.id order by p.is_main desc, p.created_at asc limit 1) as main_photo
    from cats c
    order by c.updated_at desc
  `;
  return json(rows.map(mapPublicCat));
}
