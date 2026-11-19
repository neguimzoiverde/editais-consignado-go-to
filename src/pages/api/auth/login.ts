import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db/database.js';
import { verifyPassword, createSession, checkRateLimit, recordLoginAttempt } from '../../../lib/auth/auth.js';

function getClientIp(request: Request, clientAddress?: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return clientAddress || '127.0.0.1';
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const ip = getClientIp(request, clientAddress);

  // 1. Rate limiting contra ataques de força bruta
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Muitas tentativas incorretas. Por segurança, aguarde alguns minutos antes de tentar novamente.',
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const email = (body.email || '').toString().trim().toLowerCase();
    const password = (body.password || '').toString();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Informe e-mail e senha para continuar.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Localiza o usuário no banco
    const db = getDb();
    const stmt = db.prepare('SELECT id, email, password_hash, role FROM users WHERE email = ?');
    const user = stmt.get(email) as any;

    if (!user) {
      recordLoginAttempt(ip, email, false);
      return new Response(
        JSON.stringify({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Validação de senha constante em tempo de execução
    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      recordLoginAttempt(ip, email, false);
      return new Response(
        JSON.stringify({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Sucesso: registra tentativa bem-sucedida e cria sessão
    recordLoginAttempt(ip, email, true);
    const sessionToken = createSession(user.id);

    // Determina se conexão é HTTPS (direta ou via reverse proxy)
    const isHttps = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';

    cookies.set('auth_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 dias em segundos
    });

    return new Response(
      JSON.stringify({
        success: true,
        redirect: '/',
        user: { email: user.email, role: user.role },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[AUTH LOGIN ERROR]', err);
    return new Response(
      JSON.stringify({ error: 'Ocorreu um erro interno ao processar a autenticação.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
