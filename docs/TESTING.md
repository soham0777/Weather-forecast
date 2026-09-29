# Testing CIMS

Three layers of testing are provided:

1. **Automated backend tests** (JUnit 5 + Spring MockMvc) — 76 tests that boot the full
   application against an in-memory H2 database in MySQL mode. No MySQL server is needed.
2. **Postman collection** (`postman/`) — exercises every module against a running backend with
   the development seed data, including negative and security cases.
3. **Manual / browser walkthrough** — the end-to-end role flows listed at the end of this file.

## Running the automated tests

```bash
cd backend
mvn test            # or: mvn verify
```

Reports are written to `backend/target/surefire-reports/`. The same tests run on every push via
GitHub Actions (`.github/workflows/ci.yml`), together with a job that loads `schema.sql` and
`seed.sql` into a real MySQL 8 container and a frontend lint + production build.

Test sources: `backend/src/test/java/com/cims/`

| Class | Focus |
|-------|-------|
| `integration/AuthIntegrationTest` | Registration, login, password/e-mail rules, duplicates, JWT, roles, e-mail verification, change password |
| `integration/StudentIntegrationTest` | Profile CRUD, resume upload/download, file validation, admin student management |
| `integration/CompanyIntegrationTest` | Company CRUD, registration number format and uniqueness, archive/restore |
| `integration/InternshipIntegrationTest` | Create, approval workflow, date rules, ownership, search/filter/pagination, delete vs. archive |
| `integration/ApplicationIntegrationTest` | Apply, resume requirement, duplicates, transitions, timeline, edit, withdraw, scoping |
| `integration/InterviewIntegrationTest` | Schedule, reschedule, cancel, 24-hour rule, past dates, deadline rule, validity |
| `integration/EvaluationIntegrationTest` | Ratings 1, 5, 0, 6, −1, 3.5, missing; duplicates; archive |
| `integration/FeedbackIntegrationTest` | Student, company, faculty and system feedback rules |
| `integration/ReportIntegrationTest` | Reports and dashboards reflect database state; role restrictions |
| `integration/SecurityIntegrationTest` | SQL-injection payloads, invalid IDs, cross-faculty / cross-student access, no stack traces |
| `unit/ValidationRulesTest` | Password, registration-number patterns; internship duration and interview slot rules with a fixed clock |

## Requirement → test mapping

### Authentication
| Case | Expected | Test |
|------|----------|------|
| Registration | 201, token, role STUDENT, unverified | `registerCreatesUnverifiedStudentAndReturnsToken` |
| Login | 200 with token | `loginSucceedsAndRejectsWrongPassword` |
| Invalid password (policy) | 422 `errors.password` | `registerRejectsWeakPassword` |
| Wrong password at login | 401 "Invalid e-mail or password." | `loginSucceedsAndRejectsWrongPassword` |
| Invalid e-mail | 422 `errors.email` | `registerRejectsInvalidEmail` |
| Duplicate e-mail (any case / spaces) | 409 | `registerRejectsDuplicateEmailCaseInsensitively` |
| Role access | 403 for other roles' endpoints | `roleBasedAccessIsEnforced` |
| Deactivated account | login 403; existing token 401 | `deactivatedAccountCannotLoginOrUseExistingToken` |

### Student
| Case | Expected | Test |
|------|----------|------|
| Profile update | 200, values saved | `studentViewsAndUpdatesOwnProfile` |
| Invalid profile values | 422 per field | `profileUpdateValidatesInput` |
| Resume upload (PDF) | 200, then downloadable | `validPdfResumeUploadAndDownload` |
| Invalid resume (.docx, wrong MIME, renamed binary) | 400 | `nonPdfResumeIsRejected` |
| Oversized resume (> 5 MB) | 413 | `oversizedResumeIsRejected` |
| Application | 201 PENDING + timeline "Applied" | `applyPreventsDuplicatesAndBuildsTimeline` |
| Duplicate application | 409 "You have already applied for this internship." | `applyPreventsDuplicatesAndBuildsTimeline` |
| Resume missing | 422 `errors.resume` | `resumeIsMandatory` |
| Withdrawal | WITHDRAWN, record kept | `studentCanEditAndWithdrawPendingApplication` |

### Internship
| Case | Expected | Test |
|------|----------|------|
| Create (faculty) | 201 PENDING, duration derived | `facultyCreatesPendingInternshipAndAdminApprovesAndOpensIt` |
| Update / resubmit after rejection | PENDING again | `rejectedInternshipReturnsToPendingWhenEdited` |
| Delete / archive | Pending w/o applications deleted; with history archived; active applications block | `deleteRespectsDependencies` |
| Approval | Admin only; rejection needs remarks | `facultyCreatesPendingInternshipAndAdminApprovesAndOpensIt` |
| Search & filtering, pagination | Correct totals/pages; pending hidden from students | `searchFilterAndPagination` |
| Date validation (past start, end < start, < 4 weeks, > 6 months, deadline after start, duration mismatch, boundaries) | 422 / 201 at boundaries | `dateRulesAreEnforced`, `internshipDurationBoundaries` |

### Interview
| Case | Expected | Test |
|------|----------|------|
| Schedule, reschedule | 201 / 200 | `scheduleRescheduleAndCancel` |
| Cancellation | CANCELLED, reason stored | `scheduleRescheduleAndCancel` |
| 24-hour rule | 422 below 24 h | `twentyFourHourNoticeRule`, `interviewSlotRules` |
| Deadline rule | 422 after the application deadline, 201 on it | `cannotScheduleAfterApplicationDeadline` |
| Past date | 422 | `cannotScheduleInThePast` |
| Valid application | 404 unknown, 409 not shortlisted, 403 other faculty / student | `interviewMustBelongToAValidShortlistedApplication` |

### Evaluation
| Rating | Expected | Test |
|--------|----------|------|
| 1 | 201 | `ratingOfOneIsAccepted` |
| 5 | 201 | `ratingOfFiveIsAccepted` |
| 0 | 422 | `ratingOfZeroIsRejected` |
| 6 | 422 | `ratingOfSixIsRejected` |
| −1, missing | 422 | `negativeDecimalAndMissingRatingsAreRejected` |
| 3.5 (decimal) | 400 | `negativeDecimalAndMissingRatingsAreRejected` |

### Security
| Case | Expected | Test |
|------|----------|------|
| Unauthorised API access | 401 JSON | `protectedEndpointsRequireValidToken` |
| Student → admin endpoint | 403 | `roleBasedAccessIsEnforced` |
| Faculty → another faculty's data | 403 / empty list | `facultyCannotAccessAnotherFacultysApplications` |
| Invalid JWT / forged signature | 401 | `protectedEndpointsRequireValidToken` |
| Expired JWT | 401 "Your session has expired…" | `expiredTokenIsRejected` |
| Invalid file upload | 400 / 413 | `nonPdfResumeIsRejected`, `oversizedResumeIsRejected` |
| SQL injection attempts | Treated as text, 0 results, tables intact | `sqlInjectionAttemptsAreTreatedAsPlainText` |
| Duplicate submission | 409 | `applyPreventsDuplicatesAndBuildsTimeline`, `duplicateUpdateArchiveAndStudentVisibility` |
| Invalid IDs | 400 (type) / 404 (unknown) | `invalidAndUnknownIdsReturnClearErrors` |
| Error responses | No stack traces / class names | `errorResponsesDoNotLeakInternals` |

## Postman

1. Start MySQL with `schema.sql` + `seed.sql` and run the backend (see README).
2. Import `postman/CIMS.postman_collection.json` and `postman/CIMS.local.postman_environment.json`.
3. Run the collection in order (Collection Runner). The **Auth** folder logs in as admin,
   faculty and student and stores the tokens; later requests reuse them. Each request has
   tests for the expected status code.

The collection creates records (an internship, applications, …), so reload `seed.sql` on a fresh
database before re-running it from the start.

From the command line (run from the repository root so the resume upload finds its file):

```bash
npx newman run postman/CIMS.postman_collection.json \
  -e postman/CIMS.local.postman_environment.json --working-dir .
```

During development the collection was run this way against the seeded MySQL database:
84 requests, 110 assertions, 0 failures.

## Manual end-to-end walkthrough (browser)

| Role | Steps |
|------|-------|
| Student | Register → land on Profile → upload resume (try a .docx and a > 5 MB file first) → Internships → search/filter → open an OPEN internship → Apply → application page shows "Applied" in the timeline → try to apply again (button changes to "View my application") → Interviews → Feedback → Reports |
| Faculty | Log in → Post internship (try end date before start date, see instant error) → submit for approval → Applications → open an application (timeline shows "Under review") → Shortlist → Schedule interview (a slot < 24 h away is rejected) → after the interview: Record result → Accept → Evaluations → Reports |
| Admin | Log in → Approvals → approve / reject with remarks → Students/Faculty/Companies (create, edit, deactivate, archive with confirmation) → Applications / Interviews / Evaluations monitoring → Feedback (update status) → Reports → Audit log |

These flows were exercised in a headless Chromium browser against the Spring Boot API and a
seeded MySQL 8 database during development (desktop 1366 px and mobile 390 px widths).
