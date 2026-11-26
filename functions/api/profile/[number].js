// GET  /api/profile/:number — returns approved profile + comments (+ owner data if signed in)
// POST /api/profile/:number — saves profile / comments (requires owner session)

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const { number } = params;

  const profile = await env.DB.prepare(
    `SELECT website, logo_r2_key, intro, getting_paid_rules, getting_paid_portal, getting_paid_email
     FROM profiles WHERE company_number = ? AND approved_at IS NOT NULL`
  ).bind(number).first();

  const { results: commentRows } = await env.DB.prepare(
    `SELECT report_id, comment FROM period_comments
     WHERE company_number = ? AND approved_at IS NOT NULL`
  ).bind(number).all();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const visitsRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(count), 0) AS total FROM visits
     WHERE company_number = ? AND visit_date >= ?`
  ).bind(number, since).first();

  const session = await getSession(request, env);
  const isOwner = !!(session && session.company_number === number);

  let pendingProfile = null;
  if (isOwner) {
    pendingProfile = await env.DB.prepare(
      `SELECT website, logo_r2_key, intro, getting_paid_rules, getting_paid_portal, getting_paid_email, approved_at
       FROM profiles WHERE company_number = ?`
    ).bind(number).first();
  }

  return json({
    claimed: !!profile,
    profile: profile || null,
    comments: commentRows || [],
    isOwner,
    visits: visitsRow?.total ?? 0,
    pendingProfile: isOwner ? pendingProfile : null,
  });
}

export async function onRequestPost(context) {
  const { params, env, request } = context;
  const { number } = params;

  const session = await getSession(request, env);
  if (!session || session.company_number !== number) {
    return json({ error: 'Not authorised' }, 403);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid body' }, 400); }

  const { website, intro, getting_paid_rules, getting_paid_portal, getting_paid_email, comments } = body;

  if (intro && intro.length > 600) {
    return json({ error: 'Introduction must be 600 characters or fewer' }, 400);
  }

  // Check whether the profile already has an approval (first-time vs. subsequent edit)
  const existing = await env.DB.prepare(
    `SELECT approved_at FROM profiles WHERE company_number = ?`
  ).bind(number).first();

  if (existing?.approved_at) {
    // Subsequent edit — goes live immediately, logged for review
    await env.DB.prepare(
      `UPDATE profiles SET website=?, intro=?, getting_paid_rules=?, getting_paid_portal=?, getting_paid_email=?, updated_at=datetime('now')
       WHERE company_number=?`
    ).bind(website || null, intro || null, getting_paid_rules || null, getting_paid_portal || null, getting_paid_email || null, number).run();

    await env.DB.prepare(
      `INSERT INTO admin_log (action, company_number, claim_id, note, performed_at)
       VALUES ('profile_edit', ?, ?, 'Self-service edit', datetime('now'))`
    ).bind(number, session.claim_id).run();
  } else {
    // First save (pending approval)
    await env.DB.prepare(
      `INSERT INTO profiles (company_number, website, intro, getting_paid_rules, getting_paid_portal, getting_paid_email)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(company_number) DO UPDATE SET
         website=excluded.website, intro=excluded.intro,
         getting_paid_rules=excluded.getting_paid_rules,
         getting_paid_portal=excluded.getting_paid_portal,
         getting_paid_email=excluded.getting_paid_email,
         updated_at=datetime('now')`
    ).bind(number, website || null, intro || null, getting_paid_rules || null, getting_paid_portal || null, getting_paid_email || null).run();
  }

  // Save period comments
  if (comments && typeof comments === 'object') {
    for (const [reportId, comment] of Object.entries(comments)) {
      if (!comment) continue;
      if (comment.length > 400) {
        return json({ error: `Comment for period ${reportId} must be 400 characters or fewer` }, 400);
      }
      const commentApprovedAt = existing?.approved_at ? new Date().toISOString() : null;
      await env.DB.prepare(
        `INSERT INTO period_comments (company_number, report_id, comment, approved_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(company_number, report_id) DO UPDATE SET
           comment=excluded.comment, approved_at=excluded.approved_at, updated_at=excluded.updated_at`
      ).bind(number, reportId, comment, commentApprovedAt).run();
    }
  }

  return json({ ok: true });
}

async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/__Secure-gbp_session=([^;]+)/);
  if (!match) return null;
  const sessionId = match[1];
  const now = new Date().toISOString();
  return env.DB.prepare(
    `SELECT s.id, p.company_number, p.id AS claim_id
     FROM sessions s
     JOIN pending_claims p ON p.id = s.claim_id
     WHERE s.id = ? AND s.expires_at > ?`
  ).bind(sessionId, now).first();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
