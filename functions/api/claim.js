// POST /api/claim
// Body: { number, name, full_name, job_title, email, area, linkedin_url, briefing_opt_in }
// Creates a pending claim and sends a verification email via Resend.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request body' }, 400); }

  const { number, name, full_name, job_title, email, area, linkedin_url, briefing_opt_in } = body;

  if (!number || !name || !full_name || !job_title || !email || !area) {
    return json({ error: 'Missing required fields' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email address' }, 400);
  }
  if (full_name.length > 120 || job_title.length > 120 || email.length > 254) {
    return json({ error: 'Field too long' }, 400);
  }

  const VALID_AREAS = [
    'Finance and accounts payable',
    'Procurement',
    'Supplier relationships',
    'Sustainability and ESG',
    'Other',
  ];
  if (!VALID_AREAS.includes(area)) {
    return json({ error: 'Invalid area' }, 400);
  }

  const CONSENT_WORDING =
    "We'll send you the monthly Good Business Pays briefing about new filings and Fast Payer news. Unsubscribe at any time.";

  // Check for an existing unverified claim from same email (avoid spam)
  const existing = await env.DB.prepare(
    `SELECT id FROM pending_claims WHERE email = ? AND company_number = ? AND verified_at IS NULL AND created_at > datetime('now','-1 hour')`
  ).bind(email, number).first();
  if (existing) {
    // Silently succeed (don't reveal whether a claim exists)
    return json({ ok: true });
  }

  const result = await env.DB.prepare(
    `INSERT INTO pending_claims (company_number, company_name, full_name, job_title, email, area, linkedin_url, briefing_opt_in, consent_wording)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(number, name, full_name, job_title, email, area, linkedin_url || null, briefing_opt_in ? 1 : 0, CONSENT_WORDING).run();

  const claimId = result.meta.last_row_id;

  // Create a one-time token (30-minute expiry)
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO tokens (token, claim_id, expires_at) VALUES (?, ?, ?)`
  ).bind(token, claimId, expiresAt).run();

  const origin = new URL(request.url).origin;
  const verifyUrl = `${origin}/api/verify/${token}`;

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Good Business Pays <noreply@goodbusinesspays.com>',
      to: [email],
      subject: `Confirm your claim for ${name}`,
      html: verifyHtml(full_name.split(' ')[0], name, verifyUrl),
    }),
  });

  if (!emailRes.ok) {
    console.error('Resend error:', await emailRes.text());
    // Roll back the claim so the user can retry
    await env.DB.prepare(`DELETE FROM tokens WHERE token = ?`).bind(token).run();
    await env.DB.prepare(`DELETE FROM pending_claims WHERE id = ?`).bind(claimId).run();
    return json({ error: 'Failed to send verification email. Please try again.' }, 500);
  }

  return json({ ok: true });
}

function verifyHtml(firstName, company, verifyUrl) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#013825;max-width:560px;margin:0 auto;padding:32px 16px;">
<img src="https://portal.goodbusinesspays.com/static/design-system/logos/gbp-mark-green.png" alt="Good Business Pays" width="48" height="48">
<h1 style="font-size:24px;margin:24px 0 8px;">Confirm your claim for ${esc(company)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:24px;">Hello ${esc(firstName)}, click the button below to confirm your email and continue claiming the profile for ${esc(company)}. This link expires in 30 minutes.</p>
<a href="${esc(verifyUrl)}" style="display:inline-block;padding:14px 28px;background:#013825;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;border-radius:999px;">Confirm and continue</a>
<p style="margin:24px 0 0;font-size:14px;color:#4b6258;">If you did not request this, ignore this email. The link expires automatically.</p>
<p style="margin:8px 0 0;font-size:13px;color:#4b6258;">Good Business Pays CIC &middot; <a href="https://portal.goodbusinesspays.com/privacy" style="color:#013825;">Privacy policy</a></p>
</body></html>`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
