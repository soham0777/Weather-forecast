# CIMS REST API Reference

Base URL: `http://localhost:8080/api` (development) or `https://<your-backend-domain>/api` (production).

All requests and responses use JSON (except resume upload/download). Authenticated requests send
`Authorization: Bearer <token>`, obtained from `POST /api/auth/login` or `POST /api/auth/register`.
A ready-to-run Postman collection is in [`postman/`](../postman).

## Response format

Success:

```json
{ "success": true, "message": "Application submitted successfully.", "data": { ... }, "timestamp": "2026-09-29T06:20:11Z" }
```

Error (no stack traces are ever returned):

```json
{ "success": false, "message": "You have already applied for this internship.", "timestamp": "2026-09-29T06:21:40Z", "status": 409, "path": "/api/applications" }
```

Validation errors add a field map:

```json
{ "success": false, "message": "Please correct the highlighted fields.", "status": 422,
  "errors": { "password": "Password must be at least 8 characters and include upper-case, lower-case, number and special character." } }
```

| Status | Meaning in CIMS |
|--------|-----------------|
| 200 / 201 | Success / created |
| 400 | Malformed request (bad JSON, wrong type such as a decimal rating, non-PDF upload, invalid token link) |
| 401 | Missing, invalid or expired JWT; wrong login credentials |
| 403 | Authenticated but not allowed (wrong role, not the owner, deactivated account) |
| 404 | Record or endpoint does not exist |
| 409 | Conflicts with current state (duplicate e-mail / registration number / application, invalid status transition) |
| 413 | Uploaded file larger than 5 MB |
| 422 | Validation or business-rule failure (dates, ratings, 24-hour interview notice …) |
| 500 | Unexpected server error (details are logged, not returned) |

### Paginated lists

List endpoints accept `page` (0-based), `size` (default 10, max 100) and, where noted, `sort=field,asc|desc`,
and return:

```json
{ "content": [ ... ], "page": 0, "size": 10, "totalElements": 42, "totalPages": 5, "first": true, "last": false }
```

## Authentication — `/api/auth`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/auth/register` | Public | Student self-registration `{email, password, name, phone, department, gpa}` → token + user |
| POST | `/auth/login` | Public | `{email, password}` → `{token, tokenType, expiresAt, user}` |
| POST | `/auth/logout` | Any | Records the logout (the client discards the token) |
| GET | `/auth/me` | Any | Current user `{id, email, role, name, profileId, active, verified, lastLoginAt}` |
| POST | `/auth/verify-email` | Public | `{token}` from the e-mailed link |
| POST | `/auth/resend-verification` | Any | Sends a new verification link |
| PUT | `/auth/change-password` | Any | `{currentPassword, newPassword}` |

## Users (admin) — `/api/users`

| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/users/{userId}/status` | `{active: true/false}` — activate / deactivate any account |
| PATCH | `/users/{userId}/verify` | Mark e-mail as verified (e.g. when SMTP is not configured) |

## Students — `/api/students`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/students/me` | Student | Profile, resume info, application statistics, profile completion |
| PUT | `/students/me` | Student | `{name, phone, department, gpa}` |
| POST | `/students/me/resume` | Student | `multipart/form-data` field `file` — PDF only, max 5 MB |
| GET | `/students/me/resume` | Student | Download own resume (PDF) |
| GET | `/students` | Admin | `q`, `department`, `active`, `page`, `size`, `sort` (`name`, `department`, `gpa`, `createdAt`) |
| GET | `/students/{id}` | Admin; faculty (applicants to their internships); the student | Student record |
| GET | `/students/{id}/resume` | Admin; faculty (applicants) | Download profile resume |
| POST | `/students` | Admin | Create student `{email, password, name, phone, department, gpa}` |
| PUT | `/students/{id}` | Admin | Update student (password ignored) |
| DELETE | `/students/{id}` | Admin | **Deactivates** the account (`is_active = false`); nothing is deleted |

## Faculty — `/api/faculty`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET/PUT | `/faculty/me` | Faculty | Own profile `{name, department, designation, phone}` |
| GET | `/faculty` | Admin | Search: `q`, `department`, `active`, pagination |
| GET | `/faculty/options` | Admin | Active faculty for drop-downs |
| GET | `/faculty/{id}` | Admin / self | Faculty record |
| POST | `/faculty` | Admin | Create `{email, password, name, department, designation, phone}` |
| PUT | `/faculty/{id}` | Admin | Update |
| DELETE | `/faculty/{id}` | Admin | Deactivate |

## Companies — `/api/companies`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/companies` | Any (students: active only, no contact details) | `q`, `location`, `status`, pagination |
| GET | `/companies/options` | Admin, Faculty | Active companies for drop-downs |
| GET | `/companies/{id}` | Any | Company, its internships, rating averages, recent student feedback |
| POST | `/companies` | Admin | `{name, registrationNumber, location, contactPerson, contactEmail, contactPhone}` — registration number must be a CIN (`U72200MH2009PTC123456`) or LLPIN (`AAB-1234`) and unique |
| PUT | `/companies/{id}` | Admin | Update |
| DELETE | `/companies/{id}` | Admin | Deletes a company with no internships; otherwise **archives** it (blocked while it has pending/approved/open internships) |
| PATCH | `/companies/{id}/restore` | Admin | Re-activate an archived company |

## Internships — `/api/internships`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/internships` | Any | Search & filter: `q` (title, company, domain, location), `domain`, `companyId`, `location`, `minStipend`, `maxStipend`, `status`, `facultyId` (admin), `page`, `size`, `sort` (`deadline`, `stipend`, `startDate`, `createdAt`, `title`, `duration`). Students see APPROVED/OPEN only; faculty see their own |
| GET | `/internships/filters` | Any | Distinct domains, companies and locations for the filter drop-downs |
| GET | `/internships/{id}` | Any (visibility rules apply) | Details, incl. `acceptingApplications`, and for students `myApplicationId/Status` |
| POST | `/internships` | Faculty (→ PENDING), Admin (→ APPROVED, `facultyId` required) | `{title, description, domain, companyId, stipend, startDate, endDate, applicationDeadline, durationWeeks?}` |
| PUT | `/internships/{id}` | Owner faculty, Admin | Update; editing a REJECTED internship resubmits it (PENDING) |
| PATCH | `/internships/{id}/status` | See below | `{status, remarks}` |
| DELETE | `/internships/{id}` | Owner faculty, Admin | Deletes a PENDING/REJECTED posting without applications; otherwise **archives** it |

Status transitions: `PENDING → APPROVED` / `PENDING → REJECTED` (admin; rejection needs remarks),
`APPROVED|CLOSED → OPEN` (owner/admin; deadline must not have passed), `OPEN → CLOSED` (owner/admin).
OPEN internships are closed automatically after the application deadline (hourly job).

Date rules: start date in the future; end after start; duration 4 weeks – 6 months; deadline before
the start date. `durationWeeks` is derived from the dates; a supplied value must match.

## Applications — `/api/applications`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/applications` | Student (own), Faculty (their internships), Admin (all) | `status`, `internshipId`, `companyId`, `q`, pagination, `sort` (`appliedAt`, `updatedAt`, `status`) |
| GET | `/applications/{id}` | Applicant, owner faculty, admin | Details + timeline + interviews + evaluations + feedback + allowed `actions` |
| POST | `/applications` | Student | `{internshipId, coverLetter (50–3000), qualifications?}` — profile resume is required and copied as a snapshot; one application per internship (409 otherwise) |
| PUT | `/applications/{id}` | Applicant | Edit cover letter/qualifications while PENDING and before the deadline |
| PATCH | `/applications/{id}/status` | Owner faculty, Admin | `{status, comment}`: PENDING → SHORTLISTED/REJECTED, SHORTLISTED → ACCEPTED/REJECTED |
| POST | `/applications/{id}/complete` | Owner faculty, Admin | Mark an ACCEPTED internship as completed |
| DELETE | `/applications/{id}` | Applicant | **Withdraws** (status WITHDRAWN) a PENDING/SHORTLISTED application |
| GET | `/applications/{id}/resume` | Applicant, owner faculty, admin | Resume submitted with the application |

## Interviews — `/api/interviews`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/interviews` | Role-scoped | `scope=upcoming|past`, `status`, `applicationId`, `q`, pagination |
| GET | `/interviews/{id}` | Applicant, owner faculty, admin | Interview |
| POST | `/interviews` | Owner faculty, Admin | `{applicationId, interviewDate, interviewTime, interviewerName, interviewerDetails}` |
| PUT | `/interviews/{id}` | Owner faculty, Admin | Reschedule / edit (SCHEDULED only) |
| PATCH | `/interviews/{id}/result` | Owner faculty, Admin | `{result: SELECTED|NOT_SELECTED|ON_HOLD, comments}` → COMPLETED (only after the interview time) |
| DELETE | `/interviews/{id}?reason=` | Owner faculty, Admin | **Cancels** (status CANCELLED) |

Rules: application must be SHORTLISTED with no other scheduled interview; slot not in the past;
at least 24 hours' notice; not after the internship's application deadline.

## Evaluations — `/api/evaluations`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/evaluations` | Student (own), Faculty (their interns), Admin | `internshipId`, `includeArchived`, `q`, pagination |
| GET | `/evaluations/pending` | Faculty, Admin | Accepted interns (internship started) not yet evaluated by the caller |
| GET | `/evaluations/{id}` | Related users | Evaluation |
| POST | `/evaluations` | Owner faculty, Admin | `{applicationId, technicalSkills, softSkills, punctuality, responsibility, teamwork, learningAbility, overallRating, comments}` — every rating an integer 1–5 |
| PUT | `/evaluations/{id}` | Evaluator, Admin | Update |
| DELETE | `/evaluations/{id}` | Evaluator, Admin | **Archives** the evaluation |

## Feedback — `/api/feedback`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET / POST | `/feedback/student` | List: role-scoped. Create: the intern | `{applicationId, companyCulture, mentorshipQuality, technicalLearning, workEnvironment, overallExperience, comments, suggestions}` — after the accepted internship is completed/ended |
| PUT | `/feedback/student/{id}` | The intern | Update |
| GET / POST | `/feedback/company` | List: role-scoped. Create: owner faculty/admin | `{applicationId, companyRepresentative, technicalSkills, softSkills, punctuality, responsibility, teamwork, learningAbility, hireLikelihood, strengths, areasForImprovement, comments}` |
| PUT | `/feedback/company/{id}` | Owner faculty, Admin | Update |
| GET | `/feedback/faculty` | Faculty (own), Admin | Faculty quality feedback |
| POST / PUT | `/feedback/faculty[/{id}]` | Faculty (own internships) | `{internshipId, courseSuitability, learningOutcomes, internshipQuality, learningOutcomesNotes, suggestions}` |
| GET | `/feedback/system` | Admin (all), others (own) | `type`, `status`, `q`, pagination |
| POST | `/feedback/system` | Any | `{feedbackType: FEATURE_SUGGESTION|BUG_REPORT|PLATFORM_IMPROVEMENT, title, description}` |
| PUT | `/feedback/system/{id}` | Author, while OPEN | Edit |
| PATCH | `/feedback/system/{id}/status` | Admin | `{status: OPEN|UNDER_REVIEW|IN_PROGRESS|RESOLVED|CLOSED, adminResponse}` |

## Reports & dashboards

| Method | Path | Access | Contents |
|--------|------|--------|----------|
| GET | `/reports/admin` | Admin | Placement summary, application analytics, student performance, company statistics, system activity, compliance |
| GET | `/reports/faculty` | Faculty | Posted internships, application review, student evaluations, interview statistics |
| GET | `/reports/student` | Student | My applications, interview schedule, placement status, evaluations and company feedback |
| GET | `/dashboard/admin` · `/dashboard/faculty` · `/dashboard/student` | Matching role | Dashboard counters and short lists |
| GET | `/audit-logs` | Admin | Audit trail (`action`, pagination) |
| GET | `/health` | Public | Liveness check |

Rates whose denominator is zero are returned as `null` ("No data available").
