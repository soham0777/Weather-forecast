package com.cims.support;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.cims.entity.Application;
import com.cims.entity.ApplicationStatusHistory;
import com.cims.entity.Company;
import com.cims.entity.Faculty;
import com.cims.entity.Internship;
import com.cims.entity.Student;
import com.cims.entity.User;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.entity.enums.CompanyStatus;
import com.cims.entity.enums.InternshipStatus;
import com.cims.entity.enums.Role;
import com.cims.repository.ApplicationRepository;
import com.cims.repository.ApplicationStatusHistoryRepository;
import com.cims.repository.CompanyRepository;
import com.cims.repository.FacultyRepository;
import com.cims.repository.InternshipRepository;
import com.cims.repository.StudentRepository;
import com.cims.repository.UserRepository;
import com.cims.security.JwtService;
import com.cims.service.FileStorageService;

/**
 * Creates isolated test fixtures directly through the repositories. Every call uses unique
 * e-mails / registration numbers, so tests do not interfere with each other.
 */
@Component
public class TestData {

    public static final String PASSWORD = "Test@1234";
    public static final byte[] PDF = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n".getBytes();

    private final UserRepository users;
    private final StudentRepository students;
    private final FacultyRepository faculty;
    private final CompanyRepository companies;
    private final InternshipRepository internships;
    private final ApplicationRepository applications;
    private final ApplicationStatusHistoryRepository history;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final FileStorageService storage;
    private final Clock clock;

    public TestData(UserRepository users, StudentRepository students, FacultyRepository faculty,
                    CompanyRepository companies, InternshipRepository internships, ApplicationRepository applications,
                    ApplicationStatusHistoryRepository history, PasswordEncoder passwordEncoder, JwtService jwtService,
                    FileStorageService storage, Clock clock) {
        this.users = users;
        this.students = students;
        this.faculty = faculty;
        this.companies = companies;
        this.internships = internships;
        this.applications = applications;
        this.history = history;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.storage = storage;
        this.clock = clock;
    }

    public record Account(User user, Long profileId, String token) {
    }

    public LocalDate today() {
        return LocalDate.now(clock);
    }

    public static String uniqueEmail(String prefix) {
        return prefix + "." + UUID.randomUUID().toString().substring(0, 8) + "@test.cims.test";
    }

    public static String uniqueCin() {
        return "U72200MH2015PTC" + String.format("%06d", ThreadLocalRandom.current().nextInt(1_000_000));
    }

    public User user(Role role) {
        User user = new User();
        user.setEmail(uniqueEmail(role.name().toLowerCase()));
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setRole(role);
        user.setActive(true);
        user.setVerified(true);
        return users.save(user);
    }

    public Account admin() {
        User user = user(Role.ADMIN);
        return new Account(user, null, token(user));
    }

    public Account faculty() {
        User user = user(Role.FACULTY);
        Faculty f = new Faculty();
        f.setUser(user);
        f.setName("Test Faculty");
        f.setDepartment("Computer Engineering");
        f.setDesignation("Assistant Professor");
        f.setPhone("9822000000");
        faculty.save(f);
        return new Account(user, f.getId(), token(user));
    }

    public Account student(boolean withResume) {
        User user = user(Role.STUDENT);
        Student s = new Student();
        s.setUser(user);
        s.setStudentName("Test Student");
        s.setPhone("9876500000");
        s.setDepartment("Computer Engineering");
        s.setGpa(new BigDecimal("8.50"));
        if (withResume) {
            s.setResumePath(storage.storeResume(new MockMultipartFile("file", "resume.pdf", "application/pdf", PDF)));
            s.setResumeOriginalName("resume.pdf");
        }
        students.save(s);
        return new Account(user, s.getId(), token(user));
    }

    public String token(User user) {
        return jwtService.generate(user).token();
    }

    public Company company() {
        Company c = new Company();
        c.setName("Test Company " + UUID.randomUUID().toString().substring(0, 6));
        c.setRegistrationNumber(uniqueCin());
        c.setLocation("Pune");
        c.setContactPerson("HR Manager");
        c.setContactEmail(uniqueEmail("hr"));
        c.setContactPhone("9890000000");
        c.setStatus(CompanyStatus.ACTIVE);
        return companies.save(c);
    }

    /** OPEN internship: deadline in 20 days, starts in 40 days, 12 weeks long. */
    public Internship openInternship(Long facultyId, Company company) {
        LocalDate t = today();
        return internship(facultyId, company, InternshipStatus.OPEN, t.plusDays(40), t.plusDays(124), t.plusDays(20));
    }

    /** Accepted-intern scenario: internship that started 50 days ago and ended 8 days ago. */
    public Internship finishedInternship(Long facultyId, Company company) {
        LocalDate t = today();
        return internship(facultyId, company, InternshipStatus.CLOSED, t.minusDays(92), t.minusDays(8), t.minusDays(100));
    }

    public Internship internship(Long facultyId, Company company, InternshipStatus status, LocalDate start,
                                 LocalDate end, LocalDate deadline) {
        Faculty owner = faculty.findWithUserById(facultyId).orElseThrow();
        Internship i = new Internship();
        i.setCompany(company);
        i.setFaculty(owner);
        i.setTitle("Test Internship " + UUID.randomUUID().toString().substring(0, 6));
        i.setDescription("A test internship description that is long enough.");
        i.setDomain("Web Development");
        i.setStipend(new BigDecimal("10000"));
        i.setStartDate(start);
        i.setEndDate(end);
        i.setApplicationDeadline(deadline);
        i.setDurationWeeks((int) (java.time.temporal.ChronoUnit.DAYS.between(start, end) / 7));
        i.setStatus(status);
        i.setCreatedBy(owner.getUser());
        return internships.save(i);
    }

    public Application application(Long studentId, Internship internship, ApplicationStatus status) {
        Student s = students.findWithUserById(studentId).orElseThrow();
        Application a = new Application();
        a.setStudent(s);
        a.setInternship(internship);
        a.setResumePath(s.getResumePath() != null ? s.getResumePath()
                : storage.storeResume(new MockMultipartFile("file", "resume.pdf", "application/pdf", PDF)));
        a.setCoverLetter("I am very interested in this internship and have the relevant skills for it.");
        a.setStatus(status);
        applications.save(a);
        ApplicationStatusHistory h = new ApplicationStatusHistory();
        h.setApplication(a);
        h.setNewStatus(ApplicationStatus.PENDING);
        h.setChangedBy(s.getUser());
        history.save(h);
        return a;
    }
}
