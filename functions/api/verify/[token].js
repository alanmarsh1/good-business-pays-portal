// GET /api/verify/:token
// Validates the one-time email token, creates a session cookie, and redirects
// the owner to step 4 of the claim flow.

export async function onRequestGet(context) {
  const { params, env } = context;
  const { token } = params;

  const now = new Date().toISOString();

  const row = await env.DB.prepare(
    `SELECT t.token, t.claim_id, t.expires_at, t.used_at,
            p.company_number, p.company_name
     FROM tokens t
     JOIN pending_claims p ON p.id = t.claim_id
     WHERE t.token = ?`
  ).bind(token).first();

  if (!row) {
    return errorPage('This link is not valid. It may have already been used or never existed.');
  }
  if (row.used_at) {
    return errorPage('This link has already been used. Return to the claim page to get a new one.');
  }
  if (row.expires_at < now) {
    return errorPage('This link has expired — it is only valid for 30 minutes. Return to the claim page to get a new one.');
  }

  await env.DB.prepare(`UPDATE tokens SET used_at = ? WHERE token = ?`).bind(now, token).run();
  await env.DB.prepare(`UPDATE pending_claims SET verified_at = ? WHERE id = ?`).bind(now, row.claim_id).run();

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO sessions (id, claim_id, expires_at) VALUES (?, ?, ?)`
  ).bind(sessionId, row.claim_id, expiresAt).run();

  const redirectUrl = `/claim/?n=${encodeURIComponent(row.company_number)}&verified=1`;
  const maxAge = 30 * 24 * 60 * 60;

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl,
      'Set-Cookie': `__Secure-gbp_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
    },
  });
}

function errorPage(message) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return new Response(
    `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8">
<title>Link not valid — Good Business Pays</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/static/design-system/fonts.css">
<link rel="stylesheet" href="/static/design-system/tokens.css">
<link rel="stylesheet" href="/static/design-system/components.css">
<link rel="stylesheet" href="/static/design-system/layout.css">
</head><body>
<div style="max-width:560px;margin:64px auto;padding:0 24px;font-family:var(--font-sans,Arial,sans-serif);">
<h1 style="font-size:28px;color:#013825;">Link not valid</h1>
<p style="font-size:16px;line-height:24px;">${esc(message)}</p>
<a href="/for-companies/" style="display:inline-block;margin-top:16px;font-weight:600;color:#013825;text-decoration:underline;">Go to the claim page</a>
</div></body></html>`,
    { status: 400, headers: { 'Content-Type': 'text/html;charset=UTF-8' } }
  );
}
