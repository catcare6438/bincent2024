import { getSql, json, err } from '../_utils/db.js';
import { fmtDate, fetchFullCat, logActivity } from '../_utils/cats.js';

function baseCat(c) {
  return {
    id: c.id, name: c.name, gender: c.gender, age: c.age, color: c.color,
    personalityTags: c.personality_tags || [], fosterDate: c.foster_date, rescueSource: c.rescue_source, status: c.status,
    health: { external: c.health_external, vaccine: c.health_vaccine, neuter: c.health_neuter, chip: c.health_chip, status: c.health_status, note: c.health_note, records: [] },
    adoption: { status: c.adoption_status, history: [] },
    aiContent: (c.ai_intro || c.ai_adoption_text) ? { intro: c.ai_intro, adoptionText: c.ai_adoption_text, generatedAt: c.ai_generated_at ? +new Date(c.ai_generated_at) : null } : null,
    photos: [], fosterLogs: [], linePosts: [], medications: [],
    createdAt: +new Date(c.created_at), updatedAt: +new Date(c.updated_at),
  };
}

export async function onRequestGet(context) {
  const sql = getSql(context.env);
  const cats = await sql`select * from cats order by updated_at desc`;
  if (!cats.length) return json([]);
  const ids = cats.map((c) => c.id);

  const [photos, records, logs, adoptions, posts, meds] = await Promise.all([
    sql`select * from cat_photos where cat_id = any(${ids}) order by is_main desc, created_at asc`,
    sql`select * from health_records where cat_id = any(${ids}) order by record_date desc, created_at desc`,
    sql`select * from foster_logs where cat_id = any(${ids}) order by log_date desc, created_at desc`,
    sql`select * from adoption_records where cat_id = any(${ids}) order by status_date desc, created_at desc`,
    sql`select * from line_posts where cat_id = any(${ids}) order by sent_at desc`,
    sql`select * from medications where cat_id = any(${ids}) order by started_at desc`,
  ]);

  const byId = {};
  cats.forEach((c) => { byId[c.id] = baseCat(c); });
  photos.forEach((p) => byId[p.cat_id] && byId[p.cat_id].photos.push({ id: p.id, data: p.data_url, isMain: p.is_main }));
  records.forEach((r) => byId[r.cat_id] && byId[r.cat_id].health.records.push({ id: r.id, date: fmtDate(r.record_date), type: r.type, volunteer: r.volunteer_name, note: r.note, diseases: r.diseases || [] }));
  logs.forEach((l) => byId[l.cat_id] && byId[l.cat_id].fosterLogs.push({ id: l.id, date: fmtDate(l.log_date), content: l.content, by: l.volunteer_name }));
  adoptions.forEach((a) => byId[a.cat_id] && byId[a.cat_id].adoption.history.push({ date: fmtDate(a.status_date), status: a.status, by: a.volunteer_name, note: a.note }));
  posts.forEach((p) => byId[p.cat_id] && byId[p.cat_id].linePosts.push({ id: p.id, content: p.content, by: p.volunteer_name, sentAt: +new Date(p.sent_at) }));
  meds.forEach((m) => byId[m.cat_id] && byId[m.cat_id].medications.push({ id: m.id, disease: m.disease, totalPacks: m.total_packs, frequency: m.frequency, perDay: m.per_day, remainingPacks: m.remaining_packs, by: m.volunteer_name, startedAt: +new Date(m.started_at) }));

  return json(cats.map((c) => byId[c.id]));
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const user = data.user;
  const body = await request.json().catch(() => ({}));
  if (!body.name || !body.name.trim()) return err('請填寫貓咪姓名', 400);

  const sql = getSql(env);
  const h = body.health || {};
  const status = body.status || '找家中';

  const rows = await sql`
    insert into cats (name, gender, age, color, personality_tags, foster_date, rescue_source, status,
      health_external, health_vaccine, health_neuter, health_chip, health_status, health_note,
      adoption_status, ai_intro, ai_adoption_text, ai_generated_at)
    values (${body.name.trim()}, ${body.gender || null}, ${body.age || null}, ${body.color || null},
      ${body.personalityTags || []}, ${body.fosterDate || null}, ${body.rescueSource || null}, ${status},
      ${h.external || null}, ${h.vaccine || null}, ${h.neuter || null}, ${h.chip || null}, ${h.status || null}, ${h.note || null},
      ${status}, ${body.aiContent ? body.aiContent.intro : null}, ${body.aiContent ? body.aiContent.adoptionText : null},
      ${body.aiContent ? new Date() : null})
    returning id
  `;
  const catId = rows[0].id;

  if (Array.isArray(body.photos) && body.photos.length) {
    for (const p of body.photos) {
      await sql`insert into cat_photos (cat_id, data_url, is_main) values (${catId}, ${p.data}, ${!!p.isMain})`;
    }
  }

  await sql`
    insert into adoption_records (cat_id, status_date, status, volunteer_name, note)
    values (${catId}, current_date, ${status}, ${user.name}, '建立貓咪檔案。')
  `;

  await logActivity(sql, { by: user.name, role: user.role, action: '新增貓咪', catId, catName: body.name.trim(), detail: `建立「${body.name.trim()}」的檔案` });

  const cat = await fetchFullCat(sql, catId);
  return json(cat, 201);
}
