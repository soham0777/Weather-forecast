# Deploying CIMS

```
Internet ──HTTPS──► React frontend (static hosting)
                         │  HTTPS (REST + JWT)
                         ▼
                   Spring Boot API (container) ──► persistent volume (resumes)
                         │  JDBC over TLS
                         ▼
                   Managed MySQL 8
```

The frontend and backend are deployed separately. Nothing is hard-coded: every URL, secret and
credential comes from environment variables. Two hosting combinations are described below; any
host that runs a Docker container, serves static files and offers MySQL 8 works the same way.

> **Status:** these files and instructions are ready, but the deployment itself must be done
> with the college's own hosting accounts. Record the final URLs in the README once deployed.

## 1. Before you start

- A GitHub repository containing this project.
- A strong JWT secret: `openssl rand -base64 48`.
- A strong password for the first administrator (8+ chars, upper, lower, digit, special).
- Optional: SMTP credentials (college mail server or a transactional mail service) so
  verification e-mails are delivered. Without SMTP, set `MAIL_ENABLED=false`; administrators can
  mark accounts verified from the Students / Faculty pages.

## 2. Option A (recommended): Railway (API + MySQL) and Vercel (frontend)

### 2.1 Database (Railway MySQL)
1. Create a Railway project → **New → Database → MySQL**.
2. Open the MySQL service → **Connect** and note host, port, user, password and database name.
3. Create the tables from your computer (MySQL Workbench or CLI):
   ```bash
   mysql -h <host> -P <port> -u <user> -p <database> < database/schema.sql
   ```
   Do **not** load `seed.sql` in production.

### 2.2 Backend (Railway service from GitHub)
1. **New → GitHub Repo** → select the repository. In **Settings**, set **Root Directory** to
   `backend` (Railway builds `backend/Dockerfile`).
2. **Volumes → New Volume**, mount path `/var/data/uploads` (resumes survive redeploys).
3. **Variables**:

   | Variable | Value |
   |----------|-------|
   | `DB_URL` | `jdbc:mysql://<host>:<port>/<database>?sslMode=REQUIRED&serverTimezone=UTC` (use Railway's private host if both services are in the same project) |
   | `DB_USERNAME` / `DB_PASSWORD` | From the MySQL service |
   | `JWT_SECRET` | Output of `openssl rand -base64 48` |
   | `CORS_ALLOWED_ORIGINS` | `https://<your-frontend-domain>` (no trailing slash; comma-separate several) |
   | `FRONTEND_URL` | `https://<your-frontend-domain>` |
   | `FILE_STORAGE_PATH` | `/var/data/uploads` |
   | `APP_TIMEZONE` | `Asia/Kolkata` (or your college's zone) |
   | `MAIL_ENABLED`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM` | SMTP settings, or `MAIL_ENABLED=false` |
   | `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | First deploy only — creates the first admin |

4. **Settings → Networking → Generate Domain**. Railway terminates HTTPS.
5. Check `https://<api-domain>/api/health` returns `{"status":"UP"}` and the log shows
   *"Created the initial administrator account"*. Then **delete the two `BOOTSTRAP_ADMIN_*` variables**.

### 2.3 Frontend (Vercel)
1. **Add New → Project** → import the repository, **Root Directory** `frontend`
   (framework preset: Vite; build `npm run build`; output `dist`).
2. Environment variable `VITE_API_BASE_URL = https://<api-domain>/api`.
3. Deploy. `frontend/vercel.json` rewrites all routes to `index.html` so deep links such as
   `/student/applications/12` work on refresh.
4. Put the Vercel domain into the backend's `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL` and redeploy the backend.

## 3. Option B: Render (API + frontend) with Aiven MySQL

1. Create a free **Aiven for MySQL** service; download nothing — just note the connection
   details. Load `database/schema.sql` into it as above. Use
   `DB_URL=jdbc:mysql://<host>:<port>/defaultdb?sslMode=REQUIRED&serverTimezone=UTC`.
2. In Render choose **New → Blueprint** and select the repository: `render.yaml` creates
   `cims-api` (Docker, health check `/api/health`, 1 GB disk at `/var/data/uploads`) and
   `cims-web` (static site with SPA rewrite). Fill in the variables marked `sync: false`.
   Persistent disks require a paid Render instance; without one, uploaded resumes are lost on
   every redeploy.
3. Netlify can host the frontend instead: base directory `frontend`, build `npm run build`,
   publish `frontend/dist`; `public/_redirects` already provides the SPA rewrite.

## 4. Production checklist

- [ ] `database/schema.sql` loaded into the managed MySQL database (no seed data)
- [ ] Backend variables set; `JWT_SECRET` is random and ≥ 32 characters
- [ ] `/api/health` returns UP over **https**
- [ ] First administrator created, `BOOTSTRAP_ADMIN_*` variables removed
- [ ] Frontend `VITE_API_BASE_URL` points to the HTTPS API (rebuild after changing it)
- [ ] `CORS_ALLOWED_ORIGINS` contains exactly the frontend origin(s)
- [ ] Persistent volume mounted at `FILE_STORAGE_PATH`; upload a resume, redeploy, and check it still downloads
- [ ] Verification e-mails arrive (or `MAIL_ENABLED=false` and admins verify accounts manually)
- [ ] Log in as each role and complete one full flow (post → approve → open → apply → shortlist → interview → accept)
- [ ] Record the production URLs in the README

## 5. Operations

- **Backups:** enable automatic backups on the managed MySQL service; back up the uploads volume.
- **Logs:** the application logs to stdout (visible in the hosting dashboard); stack traces never reach users.
- **Scaling:** the API is stateless (JWT) — additional instances need shared file storage for resumes.
- **Updating the schema:** apply SQL changes to the database first, then deploy the backend
  (Hibernate validates the schema on start-up and refuses to start on a mismatch).
