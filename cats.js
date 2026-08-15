export function fmtDate(d) {
  if (!d) return '';
  const s = typeof d === 'string' ? d : new Date(d).toISOString().slice(0, 10);
  return s.slice(0, 10).replace(/-/g, '/');
}

export async function fetchFullCat(sql, id) {
  const rows = await sql`select * from cats where id = ${id}`;
  const c = rows[0];
  if (!c) return null;
  const [photos, records, logs, adoptions, posts, meds] = await Promise.all([
    sql`select * from cat_photos where cat_id = ${id} order by is_main desc, created_at asc`,
    sql`select * from health_records where cat_id = ${id} order by record_date desc, created_at desc`,
    sql`select * from foster_logs where cat_id = ${id} order by log_date desc, created_at desc`,
    sql`select * from adoption_records where cat_id = ${id} order by status_date desc, created_at desc`,
    sql`select * from line_posts where cat_id = ${id} order by sent_at desc`,
    sql`select * from medications where cat_id = ${id} order by started_at desc`,
  ]);
  return {
    id: c.id, name: c.name, gender: c.gender, age: c.age, color: c.color,
    personalityTags: c.personality_tags || [], fosterDate: c.foster_date, rescueSource: c.rescue_source, status: c.status,
    health: {
      external: c.health_external, vaccine: c.health_vaccine, neuter: c.health_neuter, chip: c.health_chip,
      status: c.health_status, note: c.health_note,
      records: records.map(r => ({ id: r.id, date: fmtDate(r.record_date), type: r.type, volunteer: r.volunteer_name, note: r.note, diseases: r.diseases || [] })),
    },
    adoption: {
      status: c.adoption_status,
      history: adoptions.map(a => ({ date: fmtDate(a.status_date), status: a.status, by: a.volunteer_name, note: a.note })),
    },
    aiContent: (c.ai_intro || c.ai_adoption_text) ? { intro: c.ai_intro, adoptionText: c.ai_adoption_text, generatedAt: c.ai_generated_at ? +new Date(c.ai_generated_at) : null } : null,
    photos: photos.map(p => ({ id: p.id, data: p.data_url, isMain: p.is_main })),
    fosterLogs: logs.map(l => ({ id: l.id, date: fmtDate(l.log_date), content: l.content, by: l.volunteer_name })),
    linePosts: posts.map(p => ({ id: p.id, content: p.content, by: p.volunteer_name, sentAt: +new Date(p.sent_at) })),
    medications: meds.map(m => ({ id: m.id, disease: m.disease, totalPacks: m.total_packs, frequency: m.frequency, perDay: m.per_day, remainingPacks: m.remaining_packs, by: m.volunteer_name, startedAt: +new Date(m.started_at) })),
    createdAt: +new Date(c.created_at), updatedAt: +new Date(c.updated_at),
  };
}

export async function logActivity(sql, { by, role, action, catId, catName, detail }) {
  await sql`
    insert into activity_log (by_name, role, action, cat_id, cat_name, detail)
    values (${by}, ${role || null}, ${action}, ${catId || null}, ${catName || null}, ${detail || null})
  `;
}
