// GET  /api/admin/claims — list verified pending claims and recent decisions
// POST /api/admin/claims — approve or reject a claim
//
// Protected by ADMIN_SECRET bearer token.
// In production, also protect /admin/* and /api/admin/* via Cloudflare Access.

export async function onRequestGet(context) {
  const { env, request } = context;
  if (!isAdmin(request, env)) return json({ error: 'Forbidden' }, 403);

  const { results: pending } = await env.DB.prepare(
    `SELECT id, company_number, company_name, full_name, job_title, email, area, created_at, verified_at
     FROM pending_claims
     WHERE approved_at IS NULL AND rejected_at IS NULL AND verified_at IS NOT NULL
     ORDER BY verified_at ASC`
  ).all();

  const { results: recent } = await env.DB.prepare(
    `SELECT id, company_number, company_name, email, approved_at, rejected_at, rejection_note
     FROM pending_claims
     WHERE approved_at IS NOT NULL OR rejected_at IS NOT NULL
     ORDER BY COALESCE(approved_at, rejected_at) DESC
     LIMIT 20`
  ).all();

  return json({ pending: pending ?? [], recent: recent ?? [] });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!isAdmin(request, env)) return json({ error: 'Forbidden' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const { claim_id, action, note } = body;
  if (!claim_id || !['approve', 'reject'].includes(action)) {
    return json({ error: 'claim_id and action (approve|reject) are required' }, 400);
  }

  const now = new Date().toISOString();

  if (action === 'approve') {
    const claim = await env.DB.prepare(
      `SELECT company_number FROM pending_claims WHERE id = ?`
    ).bind(claim_id).first();
    if (!claim) return json({ error: 'Claim not found' }, 404);

    await env.DB.prepare(`UPDATE pending_claims SET approved_at = ? WHERE id = ?`).bind(now, claim_id).run();

    // Approve the pending profile (first approval only)
    await env.DB.prepare(
      `UPDATE profiles SET approved_at = ? WHERE company_number = ? AND approved_at IS NULL`
    ).bind(now, claim.company_number).run();

    // Approve any pending period comments
    await env.DB.prepare(
      `UPDATE period_comments SET approved_at = ? WHERE company_number = ? AND approved_at IS NULL`
    ).bind(now, claim.company_number).run();

    await env.DB.prepare(
      `INSERT INTO admin_log (action, company_number, claim_id, note, performed_at)
       VALUES ('approve_claim', ?, ?, ?, ?)`
    ).bind(claim.company_number, claim_id, note || null, now).run();

  } else {
    await env.DB.prepare(
      `UPDATE pending_claims SET rejected_at = ?, rejection_note = ? WHERE id = ?`
    ).bind(now, note || null, claim_id).run();

    await env.DB.prepare(
      `INSERT INTO admin_log (action, claim_id, note, performed_at) VALUES ('reject_claim', ?, ?, ?)`
    ).bind(claim_id, note || null, now).run();
  }

  return json({ ok: true });
}

function isAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  return env.ADMIN_SECRET && auth === `Bearer ${env.ADMIN_SECRET}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
