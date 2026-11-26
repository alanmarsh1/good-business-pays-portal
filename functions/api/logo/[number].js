// POST /api/logo/:number — uploads a PNG or SVG logo to R2 (max 500 KB)

const MAX_BYTES = 500 * 1024;
const ALLOWED  = ['image/png', 'image/svg+xml'];

export async function onRequestPost(context) {
  const { params, env, request } = context;
  const { number } = params;

  const session = await getSession(request, env);
  if (!session || session.company_number !== number) {
    return json({ error: 'Not authorised' }, 403);
  }

  const ct = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  if (!ALLOWED.includes(ct)) {
    return json({ error: 'Only PNG and SVG files are accepted' }, 400);
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return json({ error: 'File must be 500 KB or smaller' }, 400);
  }

  const ext = ct.includes('svg') ? 'svg' : 'png';
  const key = `logos/${number}.${ext}`;

  await env.LOGOS.put(key, bytes, { httpMetadata: { contentType: ct } });

  await env.DB.prepare(
    `INSERT INTO profiles (company_number, logo_r2_key, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(company_number) DO UPDATE SET logo_r2_key=excluded.logo_r2_key, updated_at=excluded.updated_at`
  ).bind(number, key).run();

  return json({ ok: true, key });
}

async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(/__Secure-gbp_session=([^;]+)/);
  if (!match) return null;
  const now = new Date().toISOString();
  return env.DB.prepare(
    `SELECT s.id, p.company_number FROM sessions s
     JOIN pending_claims p ON p.id = s.claim_id
     WHERE s.id = ? AND s.expires_at > ?`
  ).bind(match[1], now).first();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
