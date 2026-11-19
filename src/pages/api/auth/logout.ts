import type { APIRoute } from 'astro';
import { deleteSession } from '../../../lib/auth/auth.js';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const token = cookies.get('auth_session')?.value;
  if (token) {
    deleteSession(token);
  }
  cookies.delete('auth_session', { path: '/' });

  return new Response(
    JSON.stringify({ success: true, redirect: '/login' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const token = cookies.get('auth_session')?.value;
  if (token) {
    deleteSession(token);
  }
  cookies.delete('auth_session', { path: '/' });

  return redirect('/login');
};
