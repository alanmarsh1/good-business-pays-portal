# Cloudflare setup for Phase 3 (Claiming)

Run these once from your terminal (requires `wrangler` logged in).

## 1. Create the D1 database

```bash
npx wrangler d1 create gbp-portal
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:

```toml
database_id = "paste-id-here"
```

Apply the schema:

```bash
npx wrangler d1 execute gbp-portal --file=data/schema.sql --remote
```

## 2. Create the R2 bucket

```bash
npx wrangler r2 bucket create gbp-logos
```

The bucket name `gbp-logos` is already in `wrangler.toml`. Nothing else needed.

## 3. Set secrets in the Pages project

```bash
# Your Resend API key (from resend.com → API Keys)
npx wrangler pages secret put RESEND_API_KEY \
  --project-name good-business-pays-portal

# A strong random string for the admin queue — keep it somewhere safe
npx wrangler pages secret put ADMIN_SECRET \
  --project-name good-business-pays-portal
```

## 4. Add bindings in the Pages project dashboard

Go to **Cloudflare dashboard → Pages → good-business-pays-portal → Settings → Bindings** and add:

| Type | Variable name | Resource |
|------|--------------|---------|
| D1 database | `DB` | `gbp-portal` |
| R2 bucket | `LOGOS` | `gbp-logos` |

Bindings must be set for both **Production** and **Preview** environments.

## 5. Protect the admin area with Cloudflare Access

Go to **Zero Trust → Access → Applications → Add an application → Self-hosted**.

- **Application name:** GBP Admin
- **Session duration:** 24 hours
- **Application domain:** `portal.goodbusinesspays.com/admin/*`
- Add a second path: `portal.goodbusinesspays.com/api/admin/*`
- **Policy:** allow your email address (and anyone else who needs access)

This ensures only you can reach the admin queue page and API.

## 6. Resend sender domain

In your Resend dashboard, verify the domain `goodbusinesspays.com` as a sending domain and add the DNS records it shows. The `from` address is set to `noreply@goodbusinesspays.com` in `functions/api/claim.js`.

## 7. Test locally

```bash
# Start a local dev server with D1 and R2 bound
npx wrangler pages dev site --d1=DB --r2=LOGOS
```

You can test without Resend by temporarily logging the token to the console instead of sending the email, or by using Resend's test mode (set `RESEND_API_KEY` to a test key).

## 8. What OPEN-CONTENT.md tracks

See `docs/OPEN-CONTENT.md` for placeholder copy that still needs to be filled in.
