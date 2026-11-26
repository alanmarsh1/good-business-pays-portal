// POST /api/sign-out — deletes the session and clears the cookie

export async function onRequestPost(context) {
  const { request, env } = context;

  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(/__Secure-gbp_session=([^;]+)/);
  if (match) {
    await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(match[1]).run();
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': '__Secure-gbp_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  });
}
