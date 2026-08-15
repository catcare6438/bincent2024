import { verifyToken, getBearerToken } from './functions/_utils/auth.js';

import * as loginRoute from './functions/api/auth/login.js';
import * as publicCatsRoute from './functions/api/public/cats.js';
import * as publicCatRoute from './functions/api/public/cats/[id].js';
import * as publicVolunteersRoute from './functions/api/public/volunteers.js';
import * as catsRoute from './functions/api/cats.js';
import * as catRoute from './functions/api/cats/[id].js';
import * as catActionsRoute from './functions/api/cats/[id]/actions.js';
import * as volunteersRoute from './functions/api/volunteers.js';
import * as volunteerRoute from './functions/api/volunteers/[id].js';
import * as activityRoute from './functions/api/activity.js';

// 這些路徑不需要登入就能存取（前台公開頁 + 登入本身）
const PUBLIC_PATTERNS = [/^\/api\/public\//, /^\/api\/auth\/login$/];

function jsonErr(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// 簡單的路由比對：支援 /api/cats/:id 這種帶參數的路徑
function matchRoute(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

// 路由表：每一列對應原本 Pages Functions 那一份程式碼裡的同一支處理函式，內容完全沒有改變
const routes = [
  { method: 'POST', pattern: '/api/auth/login', handler: loginRoute.onRequestPost },
  { method: 'GET', pattern: '/api/public/cats', handler: publicCatsRoute.onRequestGet },
  { method: 'GET', pattern: '/api/public/cats/:id', handler: publicCatRoute.onRequestGet },
  { method: 'GET', pattern: '/api/public/volunteers', handler: publicVolunteersRoute.onRequestGet },
  { method: 'GET', pattern: '/api/cats', handler: catsRoute.onRequestGet },
  { method: 'POST', pattern: '/api/cats', handler: catsRoute.onRequestPost },
  { method: 'GET', pattern: '/api/cats/:id', handler: catRoute.onRequestGet },
  { method: 'PATCH', pattern: '/api/cats/:id', handler: catRoute.onRequestPatch },
  { method: 'POST', pattern: '/api/cats/:id/actions', handler: catActionsRoute.onRequestPost },
  { method: 'GET', pattern: '/api/volunteers', handler: volunteersRoute.onRequestGet },
  { method: 'POST', pattern: '/api/volunteers', handler: volunteersRoute.onRequestPost },
  { method: 'PATCH', pattern: '/api/volunteers/:id', handler: volunteerRoute.onRequestPatch },
  { method: 'GET', pattern: '/api/activity', handler: activityRoute.onRequestGet },
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 不是 /api/ 開頭的請求，交給靜態網站（public/ 資料夾）處理
    if (!pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    for (const route of routes) {
      if (route.method !== request.method) continue;
      const params = matchRoute(route.pattern, pathname);
      if (!params) continue;

      const context = { request, env, params, data: {} };

      const isPublic = PUBLIC_PATTERNS.some((re) => re.test(pathname));
      if (!isPublic) {
        const token = getBearerToken(request);
        if (!token) return jsonErr('請先登入', 401);
        const user = await verifyToken(token, env.AUTH_SECRET);
        if (!user) return jsonErr('登入已過期，請重新登入', 401);
        context.data.user = user;
      }

      try {
        return await route.handler(context);
      } catch (e) {
        return jsonErr((e && e.message) || '伺服器發生錯誤，請稍後再試', 500);
      }
    }

    return jsonErr('找不到這個 API 路徑', 404);
  },
};
