// POST /api/beacon/:number — increments the daily visit counter.
// Counts only claimed+approved company pages. No IP or user data stored.

export async function onRequestPost(context) {
  const { params, env } = context;
  const { number } = params;

  const claimed = await env.DB.prepare(
    `SELECT company_number FROM profiles WHERE company_number = ? AND approved_at IS NOT NULL`
  ).bind(number).first();

  if (!claimed) return new Response(null, { status: 204 });

  const today = new Date().toISOString().slice(0, 10);

  await env.DB.prepare(
    `INSERT INTO visits (company_number, visit_date, count) VALUES (?, ?, 1)
     ON CONFLICT(company_number, visit_date) DO UPDATE SET count = count + 1`
  ).bind(number, today).run();

  return new Response(null, { status: 204 });
}
