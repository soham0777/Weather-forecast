-- =====================================================================
-- CIMS — DEVELOPMENT / DEMO SEED DATA
-- ---------------------------------------------------------------------
--  !!  DEVELOPMENT ONLY — NEVER LOAD THIS FILE INTO PRODUCTION  !!
--
-- Run after schema.sql on an EMPTY database:
--   mysql -u <user> -p cims < database/seed.sql
-- Then copy the placeholder resume used by the seed rows:
--   mkdir -p <FILE_STORAGE_PATH>/seed
--   cp database/seed-files/sample-resume.pdf <FILE_STORAGE_PATH>/seed/
--
-- Sample credentials (DEVELOPMENT ONLY):
--   Admin    admin@cims.test                        Admin@123
--   Faculty  priya.sharma@cims.test                 Faculty@123
--            rahul.deshmukh@cims.test               Faculty@123
--            anita.kulkarni@cims.test               Faculty@123
--   Students <firstname>.<lastname>@students.cims.test   Student@123
--            e.g. aarav.patil@students.cims.test
--
-- All dates are relative to the day the script is run (CURDATE()), so the
-- sample internships, deadlines and interviews always make sense.
-- Companies and people are fictional. No login history is inserted: login
-- trends in the reports only show real logins.
-- =====================================================================

SET NAMES utf8mb4;
SET @now   = UTC_TIMESTAMP(6);
SET @today = CURDATE();

-- BCrypt hashes (cost 10) of the development passwords above.
SET @admin_pw   = '$2a$10$ZpNRiGKZyNdJGA30/WfZ4OW/26TCjacbTXVSBhsT3zZN4/nmdkgce'; -- Admin@123
SET @faculty_pw = '$2a$10$aS9E2TA02opzhmKCMGoVKuB/CRTMiXdotS2G.zdm34hfhwaz5Hwk6'; -- Faculty@123
SET @student_pw = '$2a$10$PGTHSnkPpcZLPzT7GWxtPOpbxrotax6zw7lkiCiObaMCfzu8zO4bG'; -- Student@123
SET @resume     = 'seed/sample-resume.pdf';

-- ---------------------------------------------------------------------
-- Users: 1 admin, 3 faculty, 10 students
-- ---------------------------------------------------------------------
INSERT INTO users (id, email, password_hash, role, is_active, is_verified, created_at, updated_at) VALUES
 (1,  'admin@cims.test',                     @admin_pw,   'ADMIN',   TRUE, TRUE,  @now - INTERVAL 200 DAY, @now - INTERVAL 200 DAY),
 (2,  'priya.sharma@cims.test',              @faculty_pw, 'FACULTY', TRUE, TRUE,  @now - INTERVAL 190 DAY, @now - INTERVAL 190 DAY),
 (3,  'rahul.deshmukh@cims.test',            @faculty_pw, 'FACULTY', TRUE, TRUE,  @now - INTERVAL 190 DAY, @now - INTERVAL 190 DAY),
 (4,  'anita.kulkarni@cims.test',            @faculty_pw, 'FACULTY', TRUE, TRUE,  @now - INTERVAL 185 DAY, @now - INTERVAL 185 DAY),
 (5,  'aarav.patil@students.cims.test',      @student_pw, 'STUDENT', TRUE, TRUE,  @now - INTERVAL 170 DAY, @now - INTERVAL 170 DAY),
 (6,  'sneha.joshi@students.cims.test',      @student_pw, 'STUDENT', TRUE, TRUE,  @now - INTERVAL 168 DAY, @now - INTERVAL 168 DAY),
 (7,  'rohan.kale@students.cims.test',       @student_pw, 'STUDENT', TRUE, TRUE,  @now - INTERVAL 165 DAY, @now - INTERVAL 165 DAY),
 (8,  'isha.more@students.cims.test',        @student_pw, 'STUDENT', TRUE, TRUE,  @now - INTERVAL 150 DAY, @now - INTERVAL 150 DAY),
 (9,  'vikram.shinde@students.cims.test',    @student_pw, 'STUDENT', TRUE, TRUE,  @now - INTERVAL 148 DAY, @now - INTERVAL 148 DAY),
 (10, 'pooja.gaikwad@students.cims.test',    @student_pw, 'STUDENT', TRUE, TRUE,  @now - INTERVAL 60 DAY,  @now - INTERVAL 60 DAY),
 (11, 'aditya.jadhav@students.cims.test',    @student_pw, 'STUDENT', TRUE, TRUE,  @now - INTERVAL 55 DAY,  @now - INTERVAL 55 DAY),
 (12, 'neha.pawar@students.cims.test',       @student_pw, 'STUDENT', TRUE, TRUE,  @now - INTERVAL 30 DAY,  @now - INTERVAL 30 DAY),
 (13, 'omkar.deshpande@students.cims.test',  @student_pw, 'STUDENT', TRUE, TRUE,  @now - INTERVAL 20 DAY,  @now - INTERVAL 20 DAY),
 (14, 'kavya.nair@students.cims.test',       @student_pw, 'STUDENT', TRUE, FALSE, @now - INTERVAL 3 DAY,   @now - INTERVAL 3 DAY);

INSERT INTO faculty (id, user_id, name, department, designation, phone, created_at, updated_at) VALUES
 (1, 2, 'Dr. Priya Sharma',    'Computer Engineering',   'Associate Professor', '9822001101', @now - INTERVAL 190 DAY, @now - INTERVAL 190 DAY),
 (2, 3, 'Prof. Rahul Deshmukh', 'Information Technology', 'Assistant Professor', '9822001102', @now - INTERVAL 190 DAY, @now - INTERVAL 190 DAY),
 (3, 4, 'Dr. Anita Kulkarni',  'Mechanical Engineering', 'Professor',           '9822001103', @now - INTERVAL 185 DAY, @now - INTERVAL 185 DAY);

INSERT INTO students (id, user_id, student_name, phone, department, gpa, resume_path, resume_original_name, resume_uploaded_at, created_at, updated_at) VALUES
 (1,  5,  'Aarav Patil',     '9876500001', 'Computer Engineering',                      8.72, @resume, 'sample-resume.pdf', @now - INTERVAL 160 DAY, @now - INTERVAL 170 DAY, @now - INTERVAL 160 DAY),
 (2,  6,  'Sneha Joshi',     '9876500002', 'Information Technology',                    9.10, @resume, 'sample-resume.pdf', @now - INTERVAL 160 DAY, @now - INTERVAL 168 DAY, @now - INTERVAL 160 DAY),
 (3,  7,  'Rohan Kale',      '9876500003', 'Computer Engineering',                      7.85, @resume, 'sample-resume.pdf', @now - INTERVAL 158 DAY, @now - INTERVAL 165 DAY, @now - INTERVAL 158 DAY),
 (4,  8,  'Isha More',       '9876500004', 'Artificial Intelligence and Data Science',  8.95, @resume, 'sample-resume.pdf', @now - INTERVAL 140 DAY, @now - INTERVAL 150 DAY, @now - INTERVAL 140 DAY),
 (5,  9,  'Vikram Shinde',   '9876500005', 'Information Technology',                    7.40, @resume, 'sample-resume.pdf', @now - INTERVAL 140 DAY, @now - INTERVAL 148 DAY, @now - INTERVAL 140 DAY),
 (6,  10, 'Pooja Gaikwad',   '9876500006', 'Mechanical Engineering',                    8.10, @resume, 'sample-resume.pdf', @now - INTERVAL 50 DAY,  @now - INTERVAL 60 DAY,  @now - INTERVAL 50 DAY),
 (7,  11, 'Aditya Jadhav',   '9876500007', 'Mechanical Engineering',                    7.20, @resume, 'sample-resume.pdf', @now - INTERVAL 45 DAY,  @now - INTERVAL 55 DAY,  @now - INTERVAL 45 DAY),
 (8,  12, 'Neha Pawar',      '9876500008', 'Electronics and Telecommunication',         8.55, @resume, 'sample-resume.pdf', @now - INTERVAL 25 DAY,  @now - INTERVAL 30 DAY,  @now - INTERVAL 25 DAY),
 (9,  13, 'Omkar Deshpande', '9876500009', 'Computer Engineering',                      6.90, @resume, 'sample-resume.pdf', @now - INTERVAL 15 DAY,  @now - INTERVAL 20 DAY,  @now - INTERVAL 15 DAY),
 (10, 14, 'Kavya Nair',      '9876500010', 'Civil Engineering',                         8.30, NULL,    NULL,                NULL,                    @now - INTERVAL 3 DAY,   @now - INTERVAL 3 DAY);

-- ---------------------------------------------------------------------
-- Companies (fictional). Registration numbers use the CIN / LLPIN format.
-- ---------------------------------------------------------------------
INSERT INTO companies (id, name, registration_number, location, contact_person, contact_email, contact_phone, status, created_at, updated_at) VALUES
 (1, 'TechNova Solutions Pvt Ltd',   'U72200MH2015PTC261234', 'Pune',      'Mr. Sandeep Rao', 'careers@technova.example',   '9890011001', 'ACTIVE', @now - INTERVAL 180 DAY, @now - INTERVAL 180 DAY),
 (2, 'GreenLeaf Analytics Pvt Ltd',  'U74999KA2018PTC112233', 'Bengaluru', 'Ms. Kavita Iyer', 'hr@greenleaf.example',       '9890011002', 'ACTIVE', @now - INTERVAL 180 DAY, @now - INTERVAL 180 DAY),
 (3, 'Bharat Infra Systems Ltd',     'L45200MH2001PLC130987', 'Mumbai',    'Mr. Nitin Kulkarni', 'training@bharatinfra.example', '9890011003', 'ACTIVE', @now - INTERVAL 175 DAY, @now - INTERVAL 175 DAY),
 (4, 'CloudPeak Technologies LLP',   'AAB-1234',              'Hyderabad', 'Ms. Farah Khan',  'talent@cloudpeak.example',   '9890011004', 'ACTIVE', @now - INTERVAL 90 DAY,  @now - INTERVAL 90 DAY),
 (5, 'Medisys Healthcare Pvt Ltd',   'U85100DL2012PTC234567', 'New Delhi', 'Dr. Arjun Mehta', 'interns@medisys.example',    '9890011005', 'ACTIVE', @now - INTERVAL 60 DAY,  @now - INTERVAL 60 DAY);

-- ---------------------------------------------------------------------
-- Internships (10) covering every status. duration_weeks = (end - start) / 7.
-- ---------------------------------------------------------------------
INSERT INTO internships (id, company_id, faculty_id, title, description, domain, duration_weeks, stipend, start_date, end_date, application_deadline, status, review_remarks, reviewed_by, reviewed_at, created_by, created_at, updated_at) VALUES
 (1, 1, 1, 'Web Development Intern',
  'Build and maintain responsive web pages for TechNova''s client portal using HTML, CSS, JavaScript and React. Interns work in an agile team with code reviews and weekly demos.',
  'Web Development', 12, 10000.00, @today - INTERVAL 120 DAY, @today - INTERVAL 36 DAY, @today - INTERVAL 130 DAY,
  'CLOSED', 'Approved for Computer and IT students.', 1, @now - INTERVAL 158 DAY, 2, @now - INTERVAL 160 DAY, @now - INTERVAL 129 DAY),
 (2, 2, 2, 'Data Analytics Intern',
  'Clean, analyse and visualise business data with Python, SQL and Power BI. Interns prepare weekly dashboards for GreenLeaf''s retail clients.',
  'Data Science', 12, 12000.00, @today - INTERVAL 100 DAY, @today - INTERVAL 16 DAY, @today - INTERVAL 110 DAY,
  'CLOSED', 'Approved.', 1, @now - INTERVAL 140 DAY, 3, @now - INTERVAL 142 DAY, @now - INTERVAL 109 DAY),
 (3, 3, 3, 'Embedded Systems Intern',
  'Assist the controls team in programming microcontrollers for infrastructure monitoring sensors. Exposure to C, RTOS basics and hardware testing.',
  'Embedded Systems', 12, 8000.00, @today - INTERVAL 20 DAY, @today + INTERVAL 64 DAY, @today - INTERVAL 30 DAY,
  'CLOSED', 'Approved.', 1, @now - INTERVAL 58 DAY, 4, @now - INTERVAL 60 DAY, @now - INTERVAL 29 DAY),
 (4, 1, 1, 'Full Stack Developer Intern',
  'Work on a Spring Boot + React product used by 50,000 users. Tasks include REST API development, UI components, unit testing and deployment pipelines.',
  'Web Development', 12, 15000.00, @today + INTERVAL 40 DAY, @today + INTERVAL 124 DAY, @today + INTERVAL 20 DAY,
  'OPEN', 'Approved.', 1, @now - INTERVAL 12 DAY, 2, @now - INTERVAL 14 DAY, @now - INTERVAL 12 DAY),
 (5, 4, 2, 'Cloud Engineering Intern',
  'Help automate cloud infrastructure with Terraform and CI/CD pipelines, monitor workloads and document runbooks. AWS fundamentals are an advantage.',
  'Cloud Computing', 16, 18000.00, @today + INTERVAL 45 DAY, @today + INTERVAL 157 DAY, @today + INTERVAL 25 DAY,
  'OPEN', 'Approved.', 1, @now - INTERVAL 10 DAY, 3, @now - INTERVAL 11 DAY, @now - INTERVAL 10 DAY),
 (6, 2, 1, 'Machine Learning Intern',
  'Train and evaluate machine learning models for demand forecasting. Interns work with Python, scikit-learn and experiment tracking tools under a senior data scientist.',
  'Artificial Intelligence', 24, 20000.00, @today + INTERVAL 50 DAY, @today + INTERVAL 218 DAY, @today + INTERVAL 30 DAY,
  'OPEN', 'Approved.', 1, @now - INTERVAL 8 DAY, 2, @now - INTERVAL 9 DAY, @now - INTERVAL 8 DAY),
 (7, 5, 2, 'Healthcare IT Intern',
  'Support the hospital information systems team: test patient-record modules, write SQL reports and assist users during the rollout of a new scheduling system.',
  'Healthcare IT', 8, 7000.00, @today + INTERVAL 35 DAY, @today + INTERVAL 91 DAY, @today + INTERVAL 15 DAY,
  'OPEN', 'Approved.', 1, @now - INTERVAL 9 DAY, 3, @now - INTERVAL 10 DAY, @now - INTERVAL 9 DAY),
 (8, 3, 3, 'Mechanical Design Intern',
  'Prepare 3D models and drawings in SolidWorks for bridge maintenance equipment and support design reviews with senior engineers.',
  'Mechanical Design', 12, 9000.00, @today + INTERVAL 60 DAY, @today + INTERVAL 144 DAY, @today + INTERVAL 40 DAY,
  'APPROVED', 'Approved. Open applications when the company confirms the number of seats.', 1, @now - INTERVAL 4 DAY, 4, @now - INTERVAL 6 DAY, @now - INTERVAL 4 DAY),
 (9, 4, 1, 'Mobile App Developer Intern',
  'Develop features for a Flutter-based field-service app, integrate REST APIs and fix bugs reported by testers.',
  'Mobile Development', 12, 14000.00, @today + INTERVAL 70 DAY, @today + INTERVAL 154 DAY, @today + INTERVAL 45 DAY,
  'PENDING', NULL, NULL, NULL, 2, @now - INTERVAL 2 DAY, @now - INTERVAL 2 DAY),
 (10, 5, 3, 'Digital Marketing Intern',
  'Plan social media campaigns and track engagement metrics for Medisys outpatient services.',
  'Marketing', 8, 5000.00, @today + INTERVAL 55 DAY, @today + INTERVAL 111 DAY, @today + INTERVAL 35 DAY,
  'REJECTED', 'Not aligned with the engineering course objectives. Please revise the description to include technical work.', 1, @now - INTERVAL 1 DAY, 4, @now - INTERVAL 3 DAY, @now - INTERVAL 1 DAY);

-- ---------------------------------------------------------------------
-- Applications (16) — every status is represented.
-- ---------------------------------------------------------------------
INSERT INTO applications (id, student_id, internship_id, resume_path, cover_letter, qualifications, status, reviewed_at, completed_at, applied_at, updated_at) VALUES
 (1,  1, 1, @resume, 'I have built several React projects during my coursework and would like to apply these skills in a professional web development team at TechNova.', 'React, JavaScript, HTML/CSS; mini-project: college event portal', 'ACCEPTED', @now - INTERVAL 138 DAY, @now - INTERVAL 34 DAY, @now - INTERVAL 140 DAY, @now - INTERVAL 34 DAY),
 (2,  2, 1, @resume, 'Web development is my main interest and I have completed an online full stack course. I am eager to contribute to real client projects.', 'JavaScript, Node.js basics', 'REJECTED', @now - INTERVAL 138 DAY, NULL, @now - INTERVAL 139 DAY, @now - INTERVAL 131 DAY),
 (3,  3, 1, @resume, 'I enjoy building user interfaces and have contributed to open-source front-end libraries. This internship matches my career goals in web engineering.', 'React, Git, REST APIs', 'ACCEPTED', @now - INTERVAL 136 DAY, @now - INTERVAL 34 DAY, @now - INTERVAL 137 DAY, @now - INTERVAL 34 DAY),
 (4,  4, 2, @resume, 'As an AI & Data Science student I have worked with Python, pandas and Power BI in two academic projects and want to gain industry analytics experience.', 'Python, SQL, Power BI, statistics', 'ACCEPTED', @now - INTERVAL 117 DAY, @now - INTERVAL 14 DAY, @now - INTERVAL 118 DAY, @now - INTERVAL 14 DAY),
 (5,  5, 2, @resume, 'I am interested in data analytics and have completed a certification in SQL. I would like to learn how analytics is applied in the retail industry.', 'SQL certification, Excel', 'WITHDRAWN', @now - INTERVAL 116 DAY, NULL, @now - INTERVAL 117 DAY, @now - INTERVAL 114 DAY),
 (6,  1, 2, @resume, 'Along with web development I am also interested in data analysis and would like to explore it through this internship opportunity.', 'Python basics', 'REJECTED', @now - INTERVAL 115 DAY, NULL, @now - INTERVAL 116 DAY, @now - INTERVAL 115 DAY),
 (7,  6, 3, @resume, 'I have built Arduino-based projects for my department and want to learn professional embedded development for infrastructure monitoring.', 'C programming, Arduino, sensors', 'ACCEPTED', @now - INTERVAL 39 DAY, NULL, @now - INTERVAL 40 DAY, @now - INTERVAL 32 DAY),
 (8,  7, 3, @resume, 'I am keen to understand embedded systems used in mechanical monitoring equipment and would bring strong hands-on lab experience.', 'Basic electronics lab work', 'REJECTED', @now - INTERVAL 37 DAY, NULL, @now - INTERVAL 38 DAY, @now - INTERVAL 37 DAY),
 (9,  2, 4, @resume, 'After my previous application I strengthened my full stack skills by building a Spring Boot and React project. I would love to join the TechNova product team.', 'Spring Boot, React, MySQL', 'SHORTLISTED', @now - INTERVAL 6 DAY, NULL, @now - INTERVAL 8 DAY, @now - INTERVAL 6 DAY),
 (10, 3, 4, 'seed/sample-resume.pdf', 'Having completed a web development internship at TechNova, I want to extend my experience to back-end development and deployment pipelines.', 'React, Spring Boot basics, previous TechNova internship', 'PENDING', NULL, NULL, @now - INTERVAL 5 DAY, @now - INTERVAL 5 DAY),
 (11, 8, 4, @resume, 'I am an E&TC student with a strong interest in software. I have built IoT dashboards with React and want to grow as a full stack developer.', 'React, Firebase, IoT dashboards', 'PENDING', @now - INTERVAL 1 DAY, NULL, @now - INTERVAL 3 DAY, @now - INTERVAL 1 DAY),
 (12, 4, 5, @resume, 'Cloud platforms power the analytics pipelines I have worked on. I want to learn infrastructure automation and hold an AWS Cloud Practitioner certificate.', 'AWS Cloud Practitioner, Linux, Python', 'SHORTLISTED', @now - INTERVAL 5 DAY, NULL, @now - INTERVAL 7 DAY, @now - INTERVAL 5 DAY),
 (13, 9, 5, @resume, 'I am learning Docker and Kubernetes on my own and would appreciate the chance to work on real cloud infrastructure with an experienced team.', 'Docker, Linux basics', 'PENDING', NULL, NULL, @now - INTERVAL 2 DAY, @now - INTERVAL 2 DAY),
 (14, 9, 6, @resume, 'Machine learning is the area I want to specialise in. I have completed Andrew Ng''s ML course and built a price prediction model as a mini project.', 'Python, scikit-learn, ML course certificate', 'PENDING', NULL, NULL, @now - INTERVAL 1 DAY, @now - INTERVAL 1 DAY),
 (15, 5, 7, @resume, 'Healthcare IT combines my interest in databases with meaningful impact. I have written SQL reports for our college library system as a volunteer.', 'SQL, MySQL, report writing', 'SHORTLISTED', @now - INTERVAL 4 DAY, NULL, @now - INTERVAL 6 DAY, @now - INTERVAL 4 DAY),
 (16, 7, 7, @resume, 'I would like to explore how IT systems support hospital operations and believe my testing and documentation skills would be useful to the team.', 'Testing, documentation, MS Office', 'PENDING', NULL, NULL, @now - INTERVAL 4 DAY, @now - INTERVAL 4 DAY);

-- ---------------------------------------------------------------------
-- Application status history (drives the student timeline)
-- ---------------------------------------------------------------------
INSERT INTO application_status_history (application_id, old_status, new_status, changed_by, changed_at, comment) VALUES
 (1,  NULL,          'PENDING',     5,  @now - INTERVAL 140 DAY, 'Application submitted'),
 (1,  'PENDING',     'SHORTLISTED', 2,  @now - INTERVAL 137 DAY, 'Strong web portfolio'),
 (1,  'SHORTLISTED', 'ACCEPTED',    2,  @now - INTERVAL 131 DAY, 'Selected after interview'),
 (2,  NULL,          'PENDING',     6,  @now - INTERVAL 139 DAY, 'Application submitted'),
 (2,  'PENDING',     'SHORTLISTED', 2,  @now - INTERVAL 137 DAY, NULL),
 (2,  'SHORTLISTED', 'REJECTED',    2,  @now - INTERVAL 131 DAY, 'Not selected after the interview'),
 (3,  NULL,          'PENDING',     7,  @now - INTERVAL 137 DAY, 'Application submitted'),
 (3,  'PENDING',     'SHORTLISTED', 2,  @now - INTERVAL 136 DAY, NULL),
 (3,  'SHORTLISTED', 'ACCEPTED',    2,  @now - INTERVAL 131 DAY, 'Selected after interview'),
 (4,  NULL,          'PENDING',     8,  @now - INTERVAL 118 DAY, 'Application submitted'),
 (4,  'PENDING',     'SHORTLISTED', 3,  @now - INTERVAL 116 DAY, NULL),
 (4,  'SHORTLISTED', 'ACCEPTED',    3,  @now - INTERVAL 111 DAY, 'Excellent interview'),
 (5,  NULL,          'PENDING',     9,  @now - INTERVAL 117 DAY, 'Application submitted'),
 (5,  'PENDING',     'SHORTLISTED', 3,  @now - INTERVAL 116 DAY, NULL),
 (5,  'SHORTLISTED', 'WITHDRAWN',   9,  @now - INTERVAL 114 DAY, 'Withdrawn by student'),
 (6,  NULL,          'PENDING',     5,  @now - INTERVAL 116 DAY, 'Application submitted'),
 (6,  'PENDING',     'REJECTED',    3,  @now - INTERVAL 115 DAY, 'Profile does not match the data analytics requirements'),
 (7,  NULL,          'PENDING',     10, @now - INTERVAL 40 DAY,  'Application submitted'),
 (7,  'PENDING',     'SHORTLISTED', 4,  @now - INTERVAL 38 DAY,  NULL),
 (7,  'SHORTLISTED', 'ACCEPTED',    4,  @now - INTERVAL 32 DAY,  'Selected after interview'),
 (8,  NULL,          'PENDING',     11, @now - INTERVAL 38 DAY,  'Application submitted'),
 (8,  'PENDING',     'REJECTED',    4,  @now - INTERVAL 37 DAY,  'Prerequisite embedded C experience missing'),
 (9,  NULL,          'PENDING',     6,  @now - INTERVAL 8 DAY,   'Application submitted'),
 (9,  'PENDING',     'SHORTLISTED', 2,  @now - INTERVAL 6 DAY,   'Shortlisted for technical interview'),
 (10, NULL,          'PENDING',     7,  @now - INTERVAL 5 DAY,   'Application submitted'),
 (11, NULL,          'PENDING',     12, @now - INTERVAL 3 DAY,   'Application submitted'),
 (12, NULL,          'PENDING',     8,  @now - INTERVAL 7 DAY,   'Application submitted'),
 (12, 'PENDING',     'SHORTLISTED', 3,  @now - INTERVAL 5 DAY,   'Shortlisted for interview'),
 (13, NULL,          'PENDING',     13, @now - INTERVAL 2 DAY,   'Application submitted'),
 (14, NULL,          'PENDING',     13, @now - INTERVAL 1 DAY,   'Application submitted'),
 (15, NULL,          'PENDING',     9,  @now - INTERVAL 6 DAY,   'Application submitted'),
 (15, 'PENDING',     'SHORTLISTED', 3,  @now - INTERVAL 4 DAY,   NULL),
 (16, NULL,          'PENDING',     11, @now - INTERVAL 4 DAY,   'Application submitted');

-- ---------------------------------------------------------------------
-- Interviews — each on/before the internship's application deadline
-- ---------------------------------------------------------------------
INSERT INTO interviews (id, application_id, interview_date, interview_time, interviewer_name, interviewer_details, status, result, comments, scheduled_by, completed_at, cancelled_at, created_at, updated_at) VALUES
 (1, 1,  @today - INTERVAL 135 DAY, '10:00:00', 'Mr. Sandeep Rao',    'Engineering Manager, TechNova — on-site, Pune office', 'COMPLETED', 'SELECTED',     'Good problem-solving and clear communication.', 2, @now - INTERVAL 135 DAY, NULL, @now - INTERVAL 137 DAY, @now - INTERVAL 135 DAY),
 (2, 2,  @today - INTERVAL 135 DAY, '11:30:00', 'Mr. Sandeep Rao',    'Engineering Manager, TechNova — on-site, Pune office', 'COMPLETED', 'NOT_SELECTED', 'Needs stronger JavaScript fundamentals.',        2, @now - INTERVAL 135 DAY, NULL, @now - INTERVAL 137 DAY, @now - INTERVAL 135 DAY),
 (3, 3,  @today - INTERVAL 134 DAY, '10:00:00', 'Mr. Sandeep Rao',    'Engineering Manager, TechNova — on-site, Pune office', 'COMPLETED', 'SELECTED',     'Strong React knowledge.',                        2, @now - INTERVAL 134 DAY, NULL, @now - INTERVAL 136 DAY, @now - INTERVAL 134 DAY),
 (4, 4,  @today - INTERVAL 113 DAY, '15:00:00', 'Ms. Kavita Iyer',    'Lead Data Scientist, GreenLeaf — video call',          'COMPLETED', 'SELECTED',     'Excellent analytical thinking.',                 3, @now - INTERVAL 113 DAY, NULL, @now - INTERVAL 116 DAY, @now - INTERVAL 113 DAY),
 (5, 5,  @today - INTERVAL 113 DAY, '16:00:00', 'Ms. Kavita Iyer',    'Lead Data Scientist, GreenLeaf — video call',          'CANCELLED', NULL,           'Cancelled automatically because the application was withdrawn.', 3, NULL, @now - INTERVAL 114 DAY, @now - INTERVAL 116 DAY, @now - INTERVAL 114 DAY),
 (6, 7,  @today - INTERVAL 34 DAY,  '11:00:00', 'Mr. Nitin Kulkarni', 'Senior Embedded Engineer, Bharat Infra — Mumbai office', 'COMPLETED', 'SELECTED',  'Good hands-on hardware skills.',                 4, @now - INTERVAL 34 DAY,  NULL, @now - INTERVAL 38 DAY,  @now - INTERVAL 34 DAY),
 (7, 9,  @today + INTERVAL 10 DAY,  '10:30:00', 'Mr. Sandeep Rao',    'TechNova, Pune office — please bring your college ID card', 'SCHEDULED', NULL,     NULL,                                             2, NULL, NULL, @now - INTERVAL 6 DAY,   @now - INTERVAL 6 DAY),
 (8, 12, @today + INTERVAL 12 DAY,  '14:00:00', 'Ms. Farah Khan',     'Cloud Architect, CloudPeak — online (link will be e-mailed)', 'SCHEDULED', NULL,  NULL,                                             3, NULL, NULL, @now - INTERVAL 5 DAY,   @now - INTERVAL 5 DAY);

-- ---------------------------------------------------------------------
-- Evaluations of accepted interns (ratings 1–5)
-- ---------------------------------------------------------------------
INSERT INTO evaluations (application_id, evaluator_id, technical_skills, soft_skills, punctuality, responsibility, teamwork, learning_ability, overall_rating, comments, is_archived, created_at, updated_at) VALUES
 (1, 2, 5, 4, 5, 4, 5, 4, 5, 'Delivered all assigned modules on time and helped teammates with React issues.', FALSE, @now - INTERVAL 33 DAY, @now - INTERVAL 33 DAY),
 (3, 2, 4, 4, 3, 4, 4, 5, 4, 'Quick learner; should improve punctuality for stand-up meetings.',              FALSE, @now - INTERVAL 33 DAY, @now - INTERVAL 33 DAY),
 (4, 3, 5, 5, 4, 5, 4, 5, 5, 'Outstanding dashboards; the client adopted two of her reports.',                FALSE, @now - INTERVAL 13 DAY, @now - INTERVAL 13 DAY),
 (7, 4, 4, 3, 4, 4, 4, 4, 4, 'Mid-internship evaluation: steady progress on sensor firmware tasks.',           FALSE, @now - INTERVAL 5 DAY,  @now - INTERVAL 5 DAY);

-- ---------------------------------------------------------------------
-- Company feedback about interns (recorded by the faculty coordinator)
-- ---------------------------------------------------------------------
INSERT INTO company_feedback (application_id, recorded_by, company_representative, technical_skills, soft_skills, punctuality, responsibility, teamwork, learning_ability, hire_likelihood, strengths, areas_for_improvement, comments, created_at, updated_at) VALUES
 (1, 2, 'Mr. Sandeep Rao', 5, 4, 5, 4, 5, 4, 5, 'Clean code, ownership of features, good collaboration.', 'Could ask for help earlier when blocked.', 'We would like to offer a full-time role after graduation.', @now - INTERVAL 32 DAY, @now - INTERVAL 32 DAY),
 (4, 3, 'Ms. Kavita Iyer', 5, 4, 4, 5, 4, 5, 4, 'Strong SQL and visualisation skills.', 'Presentation skills in client meetings.', 'A valuable member of the analytics team.', @now - INTERVAL 12 DAY, @now - INTERVAL 12 DAY);

-- ---------------------------------------------------------------------
-- Student feedback about completed internships
-- ---------------------------------------------------------------------
INSERT INTO student_feedback (application_id, company_culture, mentorship_quality, technical_learning, work_environment, overall_experience, comments, suggestions, created_at, updated_at) VALUES
 (1, 5, 4, 5, 4, 5, 'Friendly team and real client work from week one.', 'Provide a short onboarding document for new interns.', @now - INTERVAL 30 DAY, @now - INTERVAL 30 DAY),
 (3, 4, 4, 4, 3, 4, 'Learned a lot about React performance.', 'The office was crowded; more desks for interns would help.', @now - INTERVAL 29 DAY, @now - INTERVAL 29 DAY),
 (4, 4, 5, 5, 4, 5, 'Excellent mentorship from the data science lead.', 'Share datasets earlier so interns can prepare.', @now - INTERVAL 10 DAY, @now - INTERVAL 10 DAY);

-- ---------------------------------------------------------------------
-- Faculty quality-assurance feedback about internships
-- ---------------------------------------------------------------------
INSERT INTO faculty_feedback (internship_id, faculty_id, course_suitability, learning_outcomes, internship_quality, learning_outcomes_notes, suggestions, created_at, updated_at) VALUES
 (1, 1, 5, 4, 5, 'Students applied web technology and software engineering course outcomes in a live project.', 'Continue the partnership; request a mid-term progress call.', @now - INTERVAL 30 DAY, @now - INTERVAL 30 DAY),
 (2, 2, 4, 4, 4, 'Good coverage of database and statistics outcomes.', 'Ask the company to include a short project report template.', @now - INTERVAL 12 DAY, @now - INTERVAL 12 DAY);

-- ---------------------------------------------------------------------
-- System (platform) feedback
-- ---------------------------------------------------------------------
INSERT INTO system_feedback (submitted_by, feedback_type, title, description, status, admin_response, handled_by, created_at, updated_at) VALUES
 (6, 'BUG_REPORT', 'Resume preview does not open on my phone',
  'When I tap "View resume" on my Android phone the PDF downloads instead of opening in the browser.', 'OPEN', NULL, NULL, @now - INTERVAL 2 DAY, @now - INTERVAL 2 DAY),
 (3, 'FEATURE_SUGGESTION', 'Filter applications by department',
  'It would help faculty coordinators to filter applicants by department when an internship is open to several branches.', 'UNDER_REVIEW',
  'Thank you. We are reviewing this with the placement committee.', 1, @now - INTERVAL 6 DAY, @now - INTERVAL 5 DAY),
 (7, 'PLATFORM_IMPROVEMENT', 'Show how many days are left to apply',
  'Internship cards could show the number of days left before the application deadline.', 'RESOLVED',
  'Done — internship cards now show "Closes in N days".', 1, @now - INTERVAL 20 DAY, @now - INTERVAL 15 DAY);
