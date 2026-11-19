import { defineMiddleware } from 'astro:middleware';
import { validateSession } from './lib/auth/auth.js';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect, locals } = context;
  const pathname = url.pathname;

  // 1. Verificação de rotas públicas
  const isPublicRoute =
    pathname === '/login' ||
    pathname === '/api/auth/login' ||
    pathname === '/api/health' ||
    pathname === '/robots.txt' ||
    pathname === '/favicon.svg' ||
    pathname.startsWith('/_astro/');

  // 2. Validação da sessão criptográfica
  const sessionToken = cookies.get('auth_session')?.value;
  const session = validateSession(sessionToken);

  if (session) {
    locals.user = session.user;

    // Se o usuário já está autenticado e tenta acessar a tela de login, redireciona para a home
    if (pathname === '/login') {
      return redirect('/');
    }
  } else {
    // Não autenticado
    if (!isPublicRoute) {
      if (pathname.startsWith('/api/')) {
        return new Response(
          JSON.stringify({
            error: 'Acesso não autorizado. Autenticação obrigatória.',
            authenticated: false,
          }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
            },
          }
        );
      }
      return redirect('/login');
    }
  }

  // 3. Execução da rota
  const response = await next();

  // 4. Cabeçalhos rigorosos de segurança e bloqueio total de indexação e IA Scrapers
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
});
