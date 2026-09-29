-- =====================================================================
-- College Internship Management System (CIMS) — MySQL 8.0+ schema
-- ---------------------------------------------------------------------
-- Run this script against an EXISTING, EMPTY database, for example:
--
--   mysql -u <user> -p -e "CREATE DATABASE cims CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
--   mysql -u <user> -p cims < database/schema.sql
--
-- Conventions
--   * All timestamps (created_at, updated_at, ...) are stored in UTC.
--   * Business dates/times entered by users (deadlines, interview slots)
--     are stored as DATE / TIME in the college time zone (APP_TIMEZONE).
--   * Controlled values (roles, statuses, ...) are VARCHAR columns guarded
--     by CHECK constraints, mirrored by Java enums in the backend.
--   * Rows are archived / deactivated rather than physically deleted when
--     other records depend on them; foreign keys use ON DELETE RESTRICT.
--   * The utf8mb4_unicode_ci collation makes UNIQUE(email) case-insensitive.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. users — login accounts for every role
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(100) NOT NULL,
    role            VARCHAR(20)  NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN      NOT NULL DEFAULT FALSE,
    last_login_at   DATETIME(6)  NULL,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT chk_users_role CHECK (role IN ('ADMIN', 'FACULTY', 'STUDENT')),
    INDEX idx_users_role_active (role, is_active),
    INDEX idx_users_created_at (created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. email_verification_tokens — one-time e-mail verification links
--    (only a SHA-256 hash of the token is stored)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    user_id     BIGINT      NOT NULL,
    token_hash  CHAR(64)    NOT NULL,
    expires_at  DATETIME(6) NOT NULL,
    used_at     DATETIME(6) NULL,
    created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_email_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_email_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    INDEX idx_email_tokens_user (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. students — student profile (1:1 with users)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id                   BIGINT       NOT NULL AUTO_INCREMENT,
    user_id              BIGINT       NOT NULL,
    student_name         VARCHAR(100) NOT NULL,
    phone                VARCHAR(16)  NOT NULL,
    department           VARCHAR(100) NOT NULL,
    gpa                  DECIMAL(4,2) NOT NULL,
    resume_path          VARCHAR(255) NULL,
    resume_original_name VARCHAR(255) NULL,
    resume_uploaded_at   DATETIME(6)  NULL,
    created_at           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_students_user UNIQUE (user_id),
    CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_students_gpa CHECK (gpa >= 0 AND gpa <= 10),
    INDEX idx_students_department (department),
    INDEX idx_students_name (student_name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. faculty — faculty profile (1:1 with users)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS faculty (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    user_id      BIGINT       NOT NULL,
    name         VARCHAR(100) NOT NULL,
    department   VARCHAR(100) NOT NULL,
    designation  VARCHAR(100) NOT NULL,
    phone        VARCHAR(16)  NOT NULL,
    created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_faculty_user UNIQUE (user_id),
    CONSTRAINT fk_faculty_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    INDEX idx_faculty_department (department)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. companies — managed by administrators (no company login)
--    registration_number follows the Indian CIN (21 chars) or LLPIN
--    (AAA-1234) format; see RegistrationNumberValidator in the backend.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id                   BIGINT       NOT NULL AUTO_INCREMENT,
    name                 VARCHAR(150) NOT NULL,
    registration_number  VARCHAR(25)  NOT NULL,
    location             VARCHAR(150) NOT NULL,
    contact_person       VARCHAR(100) NOT NULL,
    contact_email        VARCHAR(255) NOT NULL,
    contact_phone        VARCHAR(16)  NOT NULL,
    status               VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_companies_registration_number UNIQUE (registration_number),
    CONSTRAINT chk_companies_status CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    INDEX idx_companies_name (name),
    INDEX idx_companies_location (location),
    INDEX idx_companies_status (status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. internships — posted by faculty, approved by admin
--    duration_weeks is always derived from start/end dates by the backend.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internships (
    id                    BIGINT        NOT NULL AUTO_INCREMENT,
    company_id            BIGINT        NOT NULL,
    faculty_id            BIGINT        NOT NULL,
    title                 VARCHAR(150)  NOT NULL,
    description           TEXT          NOT NULL,
    domain                VARCHAR(100)  NOT NULL,
    duration_weeks        INT           NOT NULL,
    stipend               DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    start_date            DATE          NOT NULL,
    end_date              DATE          NOT NULL,
    application_deadline  DATE          NOT NULL,
    status                VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    review_remarks        VARCHAR(500)  NULL,
    reviewed_by           BIGINT        NULL,
    reviewed_at           DATETIME(6)   NULL,
    created_by            BIGINT        NOT NULL,
    created_at            DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at            DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_internships_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT,
    CONSTRAINT fk_internships_faculty FOREIGN KEY (faculty_id) REFERENCES faculty (id) ON DELETE RESTRICT,
    CONSTRAINT fk_internships_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_internships_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_internships_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'OPEN', 'CLOSED', 'ARCHIVED')),
    CONSTRAINT chk_internships_stipend CHECK (stipend >= 0),
    CONSTRAINT chk_internships_duration CHECK (duration_weeks BETWEEN 4 AND 26),
    CONSTRAINT chk_internships_dates CHECK (start_date < end_date),
    CONSTRAINT chk_internships_deadline CHECK (application_deadline <= start_date),
    INDEX idx_internships_status (status),
    INDEX idx_internships_domain (domain),
    INDEX idx_internships_deadline (application_deadline),
    INDEX idx_internships_company (company_id),
    INDEX idx_internships_faculty (faculty_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7. applications — one per (student, internship)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    student_id      BIGINT       NOT NULL,
    internship_id   BIGINT       NOT NULL,
    resume_path     VARCHAR(255) NOT NULL,
    cover_letter    TEXT         NOT NULL,
    qualifications  TEXT         NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    reviewed_at     DATETIME(6)  NULL,
    completed_at    DATETIME(6)  NULL,
    applied_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_applications_student_internship UNIQUE (student_id, internship_id),
    CONSTRAINT fk_applications_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT,
    CONSTRAINT fk_applications_internship FOREIGN KEY (internship_id) REFERENCES internships (id) ON DELETE RESTRICT,
    CONSTRAINT chk_applications_status CHECK (status IN ('PENDING', 'SHORTLISTED', 'REJECTED', 'ACCEPTED', 'WITHDRAWN')),
    CONSTRAINT chk_applications_completed CHECK (completed_at IS NULL OR status = 'ACCEPTED'),
    INDEX idx_applications_status (status),
    INDEX idx_applications_internship (internship_id),
    INDEX idx_applications_applied_at (applied_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 8. application_status_history — real status-change events (timeline)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_status_history (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    application_id  BIGINT       NOT NULL,
    old_status      VARCHAR(20)  NULL,
    new_status      VARCHAR(20)  NOT NULL,
    changed_by      BIGINT       NULL,
    changed_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    comment         VARCHAR(500) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_status_history_application FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE RESTRICT,
    CONSTRAINT fk_status_history_changed_by FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_status_history_old CHECK (old_status IS NULL OR old_status IN ('PENDING', 'SHORTLISTED', 'REJECTED', 'ACCEPTED', 'WITHDRAWN')),
    CONSTRAINT chk_status_history_new CHECK (new_status IN ('PENDING', 'SHORTLISTED', 'REJECTED', 'ACCEPTED', 'WITHDRAWN')),
    INDEX idx_status_history_application (application_id, changed_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 9. interviews — interview rounds for shortlisted applications
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interviews (
    id                   BIGINT        NOT NULL AUTO_INCREMENT,
    application_id       BIGINT        NOT NULL,
    interview_date       DATE          NOT NULL,
    interview_time       TIME          NOT NULL,
    interviewer_name     VARCHAR(100)  NOT NULL,
    interviewer_details  VARCHAR(500)  NULL,
    status               VARCHAR(20)   NOT NULL DEFAULT 'SCHEDULED',
    result               VARCHAR(20)   NULL,
    comments             VARCHAR(1000) NULL,
    scheduled_by         BIGINT        NOT NULL,
    completed_at         DATETIME(6)   NULL,
    cancelled_at         DATETIME(6)   NULL,
    created_at           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_interviews_application FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE RESTRICT,
    CONSTRAINT fk_interviews_scheduled_by FOREIGN KEY (scheduled_by) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_interviews_status CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT chk_interviews_result CHECK (result IS NULL OR result IN ('SELECTED', 'NOT_SELECTED', 'ON_HOLD')),
    CONSTRAINT chk_interviews_completed_result CHECK (status <> 'COMPLETED' OR result IS NOT NULL),
    INDEX idx_interviews_application (application_id),
    INDEX idx_interviews_status_date (status, interview_date)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 10. evaluations — faculty/admin evaluation of an accepted intern
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluations (
    id                BIGINT        NOT NULL AUTO_INCREMENT,
    application_id    BIGINT        NOT NULL,
    evaluator_id      BIGINT        NOT NULL,
    technical_skills  TINYINT       NOT NULL,
    soft_skills       TINYINT       NOT NULL,
    punctuality       TINYINT       NOT NULL,
    responsibility    TINYINT       NOT NULL,
    teamwork          TINYINT       NOT NULL,
    learning_ability  TINYINT       NOT NULL,
    overall_rating    TINYINT       NOT NULL,
    comments          VARCHAR(2000) NULL,
    is_archived       BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at        DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at        DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_evaluations_application_evaluator UNIQUE (application_id, evaluator_id),
    CONSTRAINT fk_evaluations_application FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE RESTRICT,
    CONSTRAINT fk_evaluations_evaluator FOREIGN KEY (evaluator_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_evaluations_ratings CHECK (
        technical_skills BETWEEN 1 AND 5 AND soft_skills BETWEEN 1 AND 5 AND
        punctuality BETWEEN 1 AND 5 AND responsibility BETWEEN 1 AND 5 AND
        teamwork BETWEEN 1 AND 5 AND learning_ability BETWEEN 1 AND 5 AND
        overall_rating BETWEEN 1 AND 5)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 11. student_feedback — student's post-internship feedback (per application)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_feedback (
    id                   BIGINT        NOT NULL AUTO_INCREMENT,
    application_id       BIGINT        NOT NULL,
    company_culture      TINYINT       NOT NULL,
    mentorship_quality   TINYINT       NOT NULL,
    technical_learning   TINYINT       NOT NULL,
    work_environment     TINYINT       NOT NULL,
    overall_experience   TINYINT       NOT NULL,
    comments             VARCHAR(2000) NULL,
    suggestions          VARCHAR(2000) NULL,
    created_at           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_student_feedback_application UNIQUE (application_id),
    CONSTRAINT fk_student_feedback_application FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE RESTRICT,
    CONSTRAINT chk_student_feedback_ratings CHECK (
        company_culture BETWEEN 1 AND 5 AND mentorship_quality BETWEEN 1 AND 5 AND
        technical_learning BETWEEN 1 AND 5 AND work_environment BETWEEN 1 AND 5 AND
        overall_experience BETWEEN 1 AND 5)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 12. company_feedback — company's rating of an intern, recorded in the
--     system by the internship's faculty coordinator or an admin
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_feedback (
    id                      BIGINT        NOT NULL AUTO_INCREMENT,
    application_id          BIGINT        NOT NULL,
    recorded_by             BIGINT        NOT NULL,
    company_representative  VARCHAR(100)  NULL,
    technical_skills        TINYINT       NOT NULL,
    soft_skills             TINYINT       NOT NULL,
    punctuality             TINYINT       NOT NULL,
    responsibility          TINYINT       NOT NULL,
    teamwork                TINYINT       NOT NULL,
    learning_ability        TINYINT       NOT NULL,
    hire_likelihood         TINYINT       NOT NULL,
    strengths               VARCHAR(1000) NULL,
    areas_for_improvement   VARCHAR(1000) NULL,
    comments                VARCHAR(2000) NULL,
    created_at              DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at              DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_company_feedback_application UNIQUE (application_id),
    CONSTRAINT fk_company_feedback_application FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE RESTRICT,
    CONSTRAINT fk_company_feedback_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_company_feedback_ratings CHECK (
        technical_skills BETWEEN 1 AND 5 AND soft_skills BETWEEN 1 AND 5 AND
        punctuality BETWEEN 1 AND 5 AND responsibility BETWEEN 1 AND 5 AND
        teamwork BETWEEN 1 AND 5 AND learning_ability BETWEEN 1 AND 5 AND
        hire_likelihood BETWEEN 1 AND 5)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 13. faculty_feedback — faculty quality assessment of an internship
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS faculty_feedback (
    id                       BIGINT        NOT NULL AUTO_INCREMENT,
    internship_id            BIGINT        NOT NULL,
    faculty_id               BIGINT        NOT NULL,
    course_suitability       TINYINT       NOT NULL,
    learning_outcomes        TINYINT       NOT NULL,
    internship_quality       TINYINT       NOT NULL,
    learning_outcomes_notes  VARCHAR(2000) NULL,
    suggestions              VARCHAR(2000) NULL,
    created_at               DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at               DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_faculty_feedback_internship_faculty UNIQUE (internship_id, faculty_id),
    CONSTRAINT fk_faculty_feedback_internship FOREIGN KEY (internship_id) REFERENCES internships (id) ON DELETE RESTRICT,
    CONSTRAINT fk_faculty_feedback_faculty FOREIGN KEY (faculty_id) REFERENCES faculty (id) ON DELETE RESTRICT,
    CONSTRAINT chk_faculty_feedback_ratings CHECK (
        course_suitability BETWEEN 1 AND 5 AND learning_outcomes BETWEEN 1 AND 5 AND
        internship_quality BETWEEN 1 AND 5)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 14. system_feedback — suggestions / bug reports from any user
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_feedback (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    submitted_by    BIGINT        NOT NULL,
    feedback_type   VARCHAR(30)   NOT NULL,
    title           VARCHAR(150)  NOT NULL,
    description     TEXT          NOT NULL,
    status          VARCHAR(20)   NOT NULL DEFAULT 'OPEN',
    admin_response  VARCHAR(2000) NULL,
    handled_by      BIGINT        NULL,
    created_at      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_system_feedback_submitted_by FOREIGN KEY (submitted_by) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_system_feedback_handled_by FOREIGN KEY (handled_by) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_system_feedback_type CHECK (feedback_type IN ('FEATURE_SUGGESTION', 'BUG_REPORT', 'PLATFORM_IMPROVEMENT')),
    CONSTRAINT chk_system_feedback_status CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    INDEX idx_system_feedback_status (status),
    INDEX idx_system_feedback_submitted_by (submitted_by)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 15. audit_logs — who did what and when (admin actions, logins,
--     denied access, rejected uploads, duplicate submissions)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGINT        NOT NULL AUTO_INCREMENT,
    user_id      BIGINT        NULL,
    action       VARCHAR(50)   NOT NULL,
    entity_type  VARCHAR(50)   NULL,
    entity_id    BIGINT        NULL,
    details      VARCHAR(1000) NULL,
    created_at   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    INDEX idx_audit_logs_action_created (action, created_at),
    INDEX idx_audit_logs_created (created_at),
    INDEX idx_audit_logs_user (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
