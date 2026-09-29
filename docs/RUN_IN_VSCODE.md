# Running CIMS in VS Code (step by step)

This guide assumes **Windows 10/11**. Mac/Linux differences are noted as *(Mac/Linux: …)*.
You will run three things: **MySQL** (database), the **backend** (Spring Boot, port 8080) and
the **frontend** (React, port 5173).

---

## Step 1 — Install the software (one time)

| Software | Where to get it | Notes |
|----------|-----------------|-------|
| **VS Code** | code.visualstudio.com | |
| **Java JDK 21** (or 17) | adoptium.net → *Temurin 21 LTS* (.msi) | In the installer, enable **"Set JAVA_HOME variable"** |
| **Node.js 22 LTS** | nodejs.org → *LTS* | Includes `npm` |
| **MySQL 8.0** | dev.mysql.com/downloads/installer → *MySQL Installer for Windows* | Choose **MySQL Server** and **MySQL Workbench**. Write down the **root password** you set |

You do **not** need to install Maven — the project includes the Maven Wrapper (`mvnw`).

After installing, **restart VS Code**, open a terminal (**Terminal → New Terminal**) and check:

```powershell
java -version     # should show 21 (or 17)
node -v           # should show v22.x
npm -v
```

## Step 2 — Open the project in VS Code

1. Unzip `cims-college-internship-management-system.zip` (or clone the GitHub repository).
2. In VS Code: **File → Open Folder…** → select the **`cims`** folder → *Yes, I trust the authors*.
3. VS Code shows *"Do you want to install the recommended extensions?"* → **Install**. They are:
   - **Extension Pack for Java** (runs/debugs the backend)
   - **Spring Boot Extension Pack**
   - **ESLint** and **Tailwind CSS IntelliSense** (frontend)
4. Wait until the status bar shows **Java: Ready** (the first time it downloads libraries; this can take a few minutes).

## Step 3 — Create the database (MySQL Workbench)

1. Open **MySQL Workbench** → click **Local instance MySQL80** → enter your root password.
2. In the query tab, run (lightning ⚡ button):
   ```sql
   CREATE DATABASE cims CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. In the left **Navigator → Schemas**, click the refresh icon, then **double-click `cims`** so it
   becomes **bold** (this makes it the active database).
4. **File → Open SQL Script…** → select `cims/database/schema.sql` → click ⚡ to run it.
5. **File → Open SQL Script…** → select `cims/database/seed.sql` → click ⚡ (sample data for testing).
6. Refresh **Schemas → cims → Tables** — you should see 15 tables.

> Command-line alternative (use **Command Prompt**, not PowerShell, because PowerShell does not support `<`):
> `mysql -u root -p cims < database\schema.sql` and then the same for `database\seed.sql`.

## Step 4 — Configure the backend

1. In the VS Code **Explorer**, open the `backend` folder, right-click **`.env.example`** → **Copy**,
   right-click `backend` → **Paste**, then rename the copy to exactly **`.env`**.
2. Generate a secret key. In the VS Code terminal (PowerShell) run:
   ```powershell
   $b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
   ```
   *(Mac/Linux: `openssl rand -base64 48`)* — copy the output.
3. Edit **`backend/.env`** and change these three lines (keep everything else as it is):
   ```properties
   DB_USERNAME=root
   DB_PASSWORD=your-mysql-root-password
   JWT_SECRET=paste-the-generated-key-here
   ```
4. Copy the sample resume used by the sample data. In the terminal (make sure you are in the `cims` folder):
   ```powershell
   New-Item -ItemType Directory -Force backend\uploads\seed
   Copy-Item database\seed-files\sample-resume.pdf backend\uploads\seed\
   ```
   *(Mac/Linux: `mkdir -p backend/uploads/seed && cp database/seed-files/sample-resume.pdf backend/uploads/seed/`)*

## Step 5 — Start the backend

**Option A — Run button (easiest):**
open **Run and Debug** (Ctrl+Shift+D) → choose **"CIMS Backend (Spring Boot)"** → press ▶.

**Option B — terminal:**
```powershell
cd backend
.\mvnw.cmd spring-boot:run
```
*(Mac/Linux: `./mvnw spring-boot:run`)*. The first run downloads Maven and all libraries (a few minutes).

It is ready when the log shows **`Started CimsApplication`**. Check it in the browser:
<http://localhost:8080/api/health> → `{"status":"UP", …}`. Keep this running.

## Step 6 — Start the frontend

Open a **second terminal** (click **+** in the terminal panel):

```powershell
cd frontend
npm install                          # first time only
Copy-Item .env.example .env.local    # first time only (Mac/Linux: cp .env.example .env.local)
npm run dev
```

Open **<http://localhost:5173>** in your browser.

## Step 7 — Log in (sample accounts — development only)

| Role | E-mail | Password |
|------|--------|----------|
| Admin | `admin@cims.test` | `Admin@123` |
| Faculty | `priya.sharma@cims.test` | `Faculty@123` |
| Student | `aarav.patil@students.cims.test` | `Student@123` |

You can also click **Create an account** to register a new student. Because e-mail sending is off
in development, the verification link is printed in the **backend terminal** — copy it into the browser.

## Every day after the first setup

1. Make sure MySQL is running (it starts automatically with Windows by default).
2. Backend: Run and Debug → ▶ (or `cd backend` → `.\mvnw.cmd spring-boot:run`).
3. Frontend: `cd frontend` → `npm run dev`.
4. Stop with **Ctrl+C** in each terminal (or the ■ stop button for the backend).

## Useful commands

| Task | Command |
|------|---------|
| Run backend tests | `cd backend` → `.\mvnw.cmd test` |
| Check frontend code | `cd frontend` → `npm run lint` |
| Production build of the frontend | `cd frontend` → `npm run build` |
| Reset the sample data | In Workbench: `DROP DATABASE cims;` then repeat Step 3 |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Backend stops with *"The JWT_SECRET environment variable must be set…"* | `backend/.env` is missing or `JWT_SECRET` is empty/short. Make sure the file is named exactly `.env` — Windows may hide a `.txt` ending (check in VS Code Explorer) |
| *Access denied for user 'root'@'localhost'* | Wrong `DB_PASSWORD` in `backend/.env` |
| *Unknown database 'cims'* or *Schema-validation: missing table* | Step 3 was not completed, or `schema.sql` ran without `cims` selected (bold). Run it again with `cims` selected |
| *Port 8080 was already in use* | Close the other program, or add `PORT=8081` to `backend/.env` **and** set `VITE_API_BASE_URL=http://localhost:8081/api` in `frontend/.env.local`, then restart both |
| Website says *"Cannot reach the server"* | The backend is not running, or `frontend/.env.local` has a wrong URL. After changing `.env.local`, stop and restart `npm run dev` |
| Browser console shows a **CORS** error | The website is not on `http://localhost:5173`. Add its address to `CORS_ALLOWED_ORIGINS` in `backend/.env` and restart the backend |
| `mvnw.cmd` / `mvnw` *is not recognized* | Be inside the `backend` folder and type `.\mvnw.cmd` (with `.\`) |
| *JAVA_HOME is not defined correctly* | Reinstall Temurin with **"Set JAVA_HOME"** enabled, then restart VS Code |
| *npm.ps1 cannot be loaded because running scripts is disabled* | Run once in PowerShell: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or switch the terminal to **Command Prompt** (dropdown next to **+**) |
| `npm` / `java` *is not recognized* | Restart VS Code (or the computer) after installing Node.js / Java |
| A seeded student's resume will not open | Do Step 4.4 (copy `sample-resume.pdf`) |
| Java errors are underlined red everywhere | Wait for **Java: Ready**, or run **Ctrl+Shift+P → Java: Clean Java Language Server Workspace** |
