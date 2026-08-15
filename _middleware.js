import { verifyToken, getBearerToken } from '../_utils/auth.js';
import { err } from '../_utils/db.js';

// 這些路徑不需要登入就能存取（前台公開頁 + 登入本身）
const PUBLIC_PATTERNS = [/^\/api\/public\//, /^\/api\/auth\/login$/];

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  if (PUBLIC_PATTERNS.some((re) => re.test(url.pathname))) {
    return next();
  }

  const token = getBearerToken(request);
  if (!token) return err('請先登入', 401);

  const user = await verifyToken(token, env.AUTH_SECRET);
  if (!user) return err('登入已過期，請重新登入', 401);

  context.data.user = user; // { sub, name, role, exp }
  return next();
}
