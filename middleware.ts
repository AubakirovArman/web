import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

// Кто куда: какие роли допускаются к префиксу пути.
const ROLE_GATES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/api/admin', roles: ['admin'] },
  { prefix: '/api/seed', roles: ['admin'] },
  { prefix: '/expert', roles: ['expert', 'admin'] },
  { prefix: '/reference', roles: ['expert', 'admin'] },
  { prefix: '/api/reference', roles: ['expert', 'admin'] },
  { prefix: '/wizard', roles: ['applicant', 'admin', 'expert'] },
];

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

  // Ролевые ограничения
  const gate = ROLE_GATES.find((item) => pathname.startsWith(item.prefix));
  if (gate && !gate.roles.includes(session.role)) {
    if (isApi) return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Проброс личности в нижестоящие API (вместо подделываемого x-user-id с клиента).
  const headers = new Headers(req.headers);
  headers.set('x-user-id', session.sub);
  headers.set('x-user-role', session.role);
  return NextResponse.next({ request: { headers } });
}
