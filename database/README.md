# CIMS Database

MySQL 8.0+ scripts for the College Internship Management System.

| File | Purpose |
|------|---------|
| `schema.sql` | Creates all 15 tables with primary keys, foreign keys, `UNIQUE`, `NOT NULL` and `CHECK` constraints, indexes and UTC timestamps. Safe to re-run (`CREATE TABLE IF NOT EXISTS`). |
| `seed.sql` | **Development / demo data only.** 1 admin, 3 faculty, 10 students, 5 companies, 10 internships, 16 applications, interviews, evaluations and all feedback types. Dates are relative to `CURDATE()`. |
| `seed-files/sample-resume.pdf` | Placeholder PDF referenced by the seed rows (`seed/sample-resume.pdf`). |

## Local setup

```bash
# 1. Create the database and an application user (MySQL Workbench works too)
mysql -u root -p <<'SQL'
CREATE DATABASE cims CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cims_app'@'localhost' IDENTIFIED BY 'choose-a-strong-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON cims.* TO 'cims_app'@'localhost';
SQL

# 2. Create the tables
mysql -u root -p cims < database/schema.sql

# 3. (Development only) load sample data and the placeholder resume
mysql -u root -p cims < database/seed.sql
mkdir -p backend/uploads/seed
cp database/seed-files/sample-resume.pdf backend/uploads/seed/
```

The application user needs only `SELECT, INSERT, UPDATE, DELETE`; the backend never changes
the schema (`spring.jpa.hibernate.ddl-auto=validate` checks that the entities match it).

### Resetting a development database

```bash
mysql -u root -p -e "DROP DATABASE cims; CREATE DATABASE cims CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p cims < database/schema.sql
mysql -u root -p cims < database/seed.sql
```

## Sample credentials (DEVELOPMENT ONLY)

| Role | E-mail | Password |
|------|--------|----------|
| Admin | `admin@cims.test` | `Admin@123` |
| Faculty | `priya.sharma@cims.test`, `rahul.deshmukh@cims.test`, `anita.kulkarni@cims.test` | `Faculty@123` |
| Student | `aarav.patil@students.cims.test` (and 9 more, see `seed.sql`) | `Student@123` |

Never load `seed.sql` into production. For production, create the first administrator with
the `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` environment variables (see
`docs/DEPLOYMENT.md`).

## Tables

| Table | Description | Key constraints |
|-------|-------------|-----------------|
| `users` | Login accounts (all roles) | `UNIQUE(email)`, role ∈ ADMIN/FACULTY/STUDENT, `is_active`, `is_verified` |
| `email_verification_tokens` | SHA-256 hashes of one-time verification tokens | `UNIQUE(token_hash)`, FK → users |
| `students` | Student profile (1:1 users) | `UNIQUE(user_id)`, `gpa` 0–10 |
| `faculty` | Faculty profile (1:1 users) | `UNIQUE(user_id)` |
| `companies` | Partner companies | `UNIQUE(registration_number)`, status ∈ ACTIVE/ARCHIVED |
| `internships` | Postings | FK → companies, faculty; status ∈ PENDING/APPROVED/REJECTED/OPEN/CLOSED/ARCHIVED; `start_date < end_date`; `application_deadline <= start_date`; `duration_weeks` 4–26; `stipend >= 0` |
| `applications` | Student applications | `UNIQUE(student_id, internship_id)`; status ∈ PENDING/SHORTLISTED/REJECTED/ACCEPTED/WITHDRAWN |
| `application_status_history` | Every status change (timeline) | FK → applications, users |
| `interviews` | Interview rounds | status ∈ SCHEDULED/COMPLETED/CANCELLED; result ∈ SELECTED/NOT_SELECTED/ON_HOLD; completed ⇒ result |
| `evaluations` | Faculty/admin evaluation of interns | ratings `BETWEEN 1 AND 5`; `UNIQUE(application_id, evaluator_id)` |
| `student_feedback` | Intern → company feedback | ratings 1–5; `UNIQUE(application_id)` |
| `company_feedback` | Company → intern feedback (recorded by staff) | ratings 1–5; `UNIQUE(application_id)` |
| `faculty_feedback` | Faculty quality assessment of an internship | ratings 1–5; `UNIQUE(internship_id, faculty_id)` |
| `system_feedback` | Suggestions / bug reports | type and status CHECKs |
| `audit_logs` | Who did what and when | FK → users (nullable for anonymous events) |

All foreign keys use `ON DELETE RESTRICT`: records are archived or deactivated instead of
being deleted when other rows depend on them.

## Time zones

- `created_at`, `updated_at`, `applied_at` and other timestamps are stored in **UTC**.
- Dates and times entered by people (deadlines, interview slots) are stored as `DATE`/`TIME`
  in the college time zone (`APP_TIMEZONE`, default `Asia/Kolkata`).
