This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Authentication Setup

Customer authentication creates signed sessions automatically. If `SESSION_SECRET` and `NEXTAUTH_SECRET` are both unset, the app generates a cryptographically random process-local fallback so auth and admin routes do not crash. Configure a stable secret in production (either variable is accepted) so sessions remain valid across restarts and serverless instances; the process-local fallback is not shared between instances.

To configure or reset the bootstrap administrator, set the credentials in your local PowerShell session and run the seed utility. It stores a salted scrypt hash in `.env.local` and upserts the admin record in MongoDB; it does not store the plaintext password:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "<initial-password>"
node scripts/seed-admin.mjs
```

Admin login prefers the database admin record, so changing the password in Admin Settings replaces the bootstrap password. A configured database user must have `role: "admin"` and a scrypt password hash; customer accounts cannot access admin routes.

## Web Storefront Settings

Manage homepage banners and the top announcement bar at `/admin/settings/web`. Banner images are uploaded and validated as multipart form data; each banner has its own redirect link. The announcement text is saved as `marqueeText` in the store settings document and the top bar stays hidden when the value is empty.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Order Management Integrations

The admin order workspace supports lifecycle filters, bulk updates, item and financial edits, audit history, abandoned-cart capture, Code 128 print labels, customer blocking, courier dispatch, and courier webhook status updates. Copy `.env.example` to `.env.local` and configure only the integrations you use.

Courier dispatch is credential-gated and reads a provider-specific `*_ORDER_API_URL`. Steadfast sends `Api-Key` and `Secret-Key` headers; Pathao, RedX, and Carrybee use Bearer access tokens. The configured endpoint must accept the normalized recipient/COD payload and return a `consignment_id`, `tracking_code`, `tracking_id`, or `trackingId`. Provider-specific merchant/store IDs and payload variations should be handled by your provider gateway/adapter. Configure `COURIER_WEBHOOK_SECRET` and send it as a Bearer token or `x-webhook-secret` for status callbacks to `/api/webhooks/courier`.

Bulk SMS uses `SMS_API_URL` and `SMS_API_KEY` with a batch `{ recipients, message }` request. Fraud-check and IP-geolocation endpoints are optional; when unset, the admin panel reports that the provider is unavailable instead of displaying fabricated results. The GeoIP endpoint receives an `ip` query parameter and should return `city`, `region`, and `country` fields for the detail panel.

## Business Admin Workspaces

Courier Management at `/admin/tools/courier` stores provider credentials AES-GCM encrypted in MongoDB. Set `COURIER_CREDENTIALS_ENCRYPTION_KEY` in `.env.local` to a stable secret of at least 32 characters before saving dashboard credentials; for example, generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Back up this key securely and keep it stable, because a changed or lost key makes stored courier credentials unreadable. Existing `*_ORDER_API_URL` and environment credential values continue to take precedence over dashboard values. Configured delivery fee zones also feed the store checkout. Courier scan and invoice imports update matching orders and payment settlements; spreadsheet uploads accept CSV, XLS, or XLSX up to 10 MB.

Accounting at `/admin/tools/accounting` totals delivered and partially delivered order income and subtracts saved expenses for the selected period. Customers can send messages from `/contact`; the inbox is available at `/admin/tools/messages`. Landing pages are managed at `/admin/tools/landing-pages`; published pages render at `/pages/{slug}`, while drafts and demo pages are visible only in an authenticated admin preview.

## Production Deployment

Use Node.js 20.9 or later (Node.js 22 LTS recommended) and a production MongoDB deployment such as MongoDB Atlas. Do not commit `.env.local` or copy production secrets into source control.

### Required production environment variables

Set these in the hosting provider's environment-variable settings:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string for the production database/user. |
| `SESSION_SECRET` or `NEXTAUTH_SECRET` | Stable, private random value of at least 32 characters. Keep it unchanged across deploys and instances. `SESSION_SECRET` takes precedence if both are set. |
| `COURIER_CREDENTIALS_ENCRYPTION_KEY` | Stable secret of at least 32 characters used to encrypt saved courier credentials. Back it up securely. |

Add optional courier, SMS, fraud-check, and geolocation variables from `.env.example` only when those integrations are enabled. Do not set `ADMIN_PASSWORD` in the live app; it is only a one-time seed input.

Generate secrets locally without printing or committing them:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Run the command separately for `SESSION_SECRET` and `COURIER_CREDENTIALS_ENCRYPTION_KEY`. Configure `MONGODB_URI` with a least-privilege database user, enable TLS (Atlas connection strings do this by default), and allow network access from the selected host in the Atlas Network Access settings. Avoid `0.0.0.0/0` when the host provides fixed outbound IPs.

### Bootstrap the administrator

Create a local, untracked `.env.local` with the production `MONGODB_URI`, the same `SESSION_SECRET` (or `NEXTAUTH_SECRET`) configured on the host, and `ADMIN_EMAIL`/`ADMIN_PASSWORD` for the initial admin. Ensure the environment includes `COURIER_CREDENTIALS_ENCRYPTION_KEY` too. Then run once from the project root:

```powershell
node scripts/seed-admin.mjs
```

The script upserts the admin record and replaces the plaintext seed password in `.env.local` with its password hash. Remove `ADMIN_PASSWORD` from the hosting environment after the seed. Log in and change the bootstrap password if required by your operational policy. Keep the configured session and courier-encryption secrets stable.

### Vercel

1. Push the application to a private Git provider repository and import it into Vercel.
2. Select the project root and Next.js framework preset. Use Node.js 22.x.
3. Add the required environment variables above under **Project Settings → Environment Variables** for Production (and separately for Preview if used).
4. Deploy. The configured `build` script is `next build`; Vercel runs the Next.js server and API routes, so do not use static export.
5. Connect the custom domain and verify the deployment, admin login, MongoDB-backed pages, and API routes.

Uploaded images are stored as MongoDB image assets and served from `/api/uploads/{id}`; API functions do not create or write local upload directories. Each image is limited to 4 MB, and the admin product form uploads multiple images individually to stay within serverless request limits. This uses MongoDB storage and bandwidth, so consider object storage/CDN for a high-volume catalog. Existing `/uploads/...` links refer to legacy local files and those files must be re-uploaded if they were not included in the deployment.

### Render or Node.js-capable cPanel hosting

1. Create a Node.js web service/application with the repository as its source. Choose Node.js 22.x or newer than 20.9.
2. Install from the lockfile with `npm ci`, build with `npm run build`, and start with `npm run start`. Configure the host's start command as `npm start` (or `npm run start`) and bind through the port supplied by the platform; Next.js handles the platform `PORT`.
3. Add the same production environment variables through the host dashboard. Never rely on a developer machine's `.env.local` in the running service.
4. Verify that an uploaded image remains available after a service restart and redeploy; uploaded image bytes are stored in MongoDB.
5. For cPanel, confirm the account provides a supported Node.js application runtime (not static/PHP-only hosting), install dependencies in the application root, build, configure the startup command, and restart the Node application after deployment.
6. Run the admin seed once against the production database, then verify login, uploads, courier callbacks, and checkout from the live domain.

### CORS, cookies, and post-deploy checks

The storefront and `/api` routes are same-origin in this app, so a separate CORS policy is not needed; do not add wildcard CORS headers. Keep the site and API on the same origin so the signed admin/customer session cookies are sent normally. If a future architecture serves the API from another origin, allow only the exact storefront origin and configure credentialed requests and cookie settings together.

After deployment, test `/`, `/admin/login`, `/admin/settings/web`, public contact submission, and one authenticated admin API flow. Confirm `SESSION_SECRET` and the courier encryption key are present on every production instance. Check provider logs for MongoDB connectivity and review the hosting platform's function/runtime limits for large invoice imports.
