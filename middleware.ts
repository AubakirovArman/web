import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session';
import { requiredPermissionFor, hasPermission, LEGACY_ROLE_GATES } from '@/lib/auth/permissions';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Публичное: страница входа, auth-роуты, статические файлы (с расширением), _next.
  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    /\.[a-zA-Z0-9]+$/.test(pathname);
  if (isPublic) return NextResponse.next();

  const isApi = pathname.startsWith('/api');
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    if (isApi) return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Ролевые ограничения по ПРАВАМ (зашиты в сессии). Для старых сессий без прав — fallback на роли.
  const required = requiredPermissionFor(pathname);
  if (required) {
    const allowed = Array.isArray(session.perms)
      ? hasPermission(session.perms, required)
      : (() => {
          const gate = LEGACY_ROLE_GATES.find((item) => pathname.startsWith(item.prefix));
          return !gate || gate.roles.includes(session.role);
        })();
    if (!allowed) {
      if (isApi) return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // Проброс личности в нижестоящие API (вместо подделываемого x-user-id с клиента).
  const headers = new Headers(req.headers);
  headers.set('x-user-id', session.sub);
  // Заголовки HTTP только Latin-1 — кириллический id роли кодируем, чтобы не падать.
  headers.set('x-user-role', encodeURIComponent(session.role));
  if (Array.isArray(session.perms)) headers.set('x-user-perms', session.perms.join(','));
  return NextResponse.next({ request: { headers } });
}
