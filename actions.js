import { getSql, json, err } from '../../../_utils/db.js';
import { fetchFullCat, logActivity } from '../../../_utils/cats.js';

const CARE_STATUSES = ['找家中', '治療中', '已預約', '已找到家', '暫不開放認養'];

function medPerDay(freq) { return freq === '早晚一次' ? 2 : 1; }

async function upsertMedications(sql, catId, diseases, byName) {
  for (const d of diseases) {
    if (!d.needsMed) continue;
    const n = parseInt(d.totalPacks, 10);
    if (!n || n <= 0) continue;
    const perDay = medPerDay(d.frequency);
    const existing = await sql`select id from medications where cat_id = ${catId} and disease = ${d.name} limit 1`;
    if (existing.length) {
      await sql`
        update medications set total_packs = ${n}, frequency = ${d.frequency}, per_day = ${perDay},
          remaining_packs = ${n}, volunteer_name = ${byName}, started_at = now()
        where id = ${existing[0].id}
      `;
    } else {
      await sql`
        insert into medications (cat_id, disease, total_packs, frequency, per_day, remaining_packs, volunteer_name)
        values (${catId}, ${d.name}, ${n}, ${d.frequency}, ${perDay}, ${n}, ${byName})
      `;
    }
  }
}

export async function onRequestPost(context) {
  const { request, env, data, params } = context;
  const user = data.user;
  const catId = params.id;
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const payload = body.payload || {};
  const sql = getSql(env);

  const catRows = await sql`select id, name from cats where id = ${catId}`;
  if (!catRows.length) return err('找不到這筆貓咪資料', 404);
  const catName = catRows[0].name;

  switch (action) {
    case 'health-record': {
      const diseases = Array.isArray(payload.diseases) ? payload.diseases : [];
      await sql`
        insert into health_records (cat_id, record_date, type, volunteer_name, note, diseases)
        values (${catId}, ${payload.date || null}, ${payload.type}, ${user.name}, ${payload.note || null}, ${JSON.stringify(diseases)})
      `;
      await upsertMedications(sql, catId, diseases, user.name);
      await sql`update cats set updated_at = now() where id = ${catId}`;
      const diseaseNote = diseases.length ? `；相關疾病：${diseases.map((d) => d.name).join('、')}` : '';
      await logActivity(sql, { by: user.name, role: user.role, action: '新增健康紀錄', catId, catName, detail: `${payload.type}：${payload.note || '（無備註）'}${diseaseNote}` });
      break;
    }
    case 'foster-log': {
      await sql`
        insert into foster_logs (cat_id, log_date, content, volunteer_name)
        values (${catId}, ${payload.date || null}, ${payload.content}, ${user.name})
      `;
      await sql`update cats set updated_at = now() where id = ${catId}`;
      await logActivity(sql, { by: user.name, role: user.role, action: '新增中途紀錄', catId, catName, detail: String(payload.content || '').slice(0, 40) });
      break;
    }
    case 'adoption-status': {
      const status = payload.status;
      await sql`
        insert into adoption_records (cat_id, status_date, status, volunteer_name, note)
        values (${catId}, current_date, ${status}, ${user.name}, ${payload.note || null})
      `;
      if (CARE_STATUSES.includes(status)) {
        await sql`update cats set adoption_status = ${status}, status = ${status}, updated_at = now() where id = ${catId}`;
      } else {
        await sql`update cats set adoption_status = ${status}, updated_at = now() where id = ${catId}`;
      }
      await logActivity(sql, { by: user.name, role: user.role, action: '變更認養狀態', catId, catName, detail: `→ ${status}${payload.note ? '，備註：' + payload.note : ''}` });
      break;
    }
    case 'add-photo': {
      const photos = Array.isArray(payload.photos) ? payload.photos : [];
      const hasNewMain = photos.some((p) => p.isMain);
      if (hasNewMain) await sql`update cat_photos set is_main = false where cat_id = ${catId}`;
      for (const p of photos) {
        await sql`insert into cat_photos (cat_id, data_url, is_main) values (${catId}, ${p.data}, ${!!p.isMain})`;
      }
      await sql`update cats set updated_at = now() where id = ${catId}`;
      await logActivity(sql, { by: user.name, role: user.role, action: '新增照片', catId, catName, detail: `新增 ${photos.length} 張照片` });
      break;
    }
    case 'set-main-photo': {
      await sql`update cat_photos set is_main = false where cat_id = ${catId}`;
      await sql`update cat_photos set is_main = true where id = ${payload.photoId} and cat_id = ${catId}`;
      await sql`update cats set updated_at = now() where id = ${catId}`;
      break;
    }
    case 'line-post': {
      await sql`
        insert into line_posts (cat_id, content, volunteer_name)
        values (${catId}, ${payload.content}, ${user.name})
      `;
      await sql`update cats set updated_at = now() where id = ${catId}`;
      await logActivity(sql, { by: user.name, role: user.role, action: '發送 LINE 貼文', catId, catName, detail: '已發送' });
      break;
    }
    case 'consume-medication': {
      const rows = await sql`select id, remaining_packs, disease from medications where id = ${payload.medicationId} and cat_id = ${catId}`;
      if (rows.length && rows[0].remaining_packs > 0) {
        const remaining = rows[0].remaining_packs - 1;
        await sql`update medications set remaining_packs = ${remaining} where id = ${payload.medicationId}`;
        await logActivity(sql, { by: user.name, role: user.role, action: '記錄用藥', catId, catName, detail: `${rows[0].disease}：服用一包，剩餘 ${remaining} 包` });
      }
      break;
    }
    case 'save-ai': {
      await sql`
        update cats set ai_intro = ${payload.intro || null}, ai_adoption_text = ${payload.adoptionText || null}, ai_generated_at = now(), updated_at = now()
        where id = ${catId}
      `;
      await sql`
        insert into ai_generated_contents (cat_id, intro, adoption_text)
        values (${catId}, ${payload.intro || null}, ${payload.adoptionText || null})
      `;
      break;
    }
    default:
      return err('未知的操作類型', 400);
  }

  const cat = await fetchFullCat(sql, catId);
  return json(cat);
}
