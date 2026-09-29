package com.cims.repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Repository;

import com.cims.dto.report.ReportCommon.ActiveCompany;
import com.cims.dto.report.ReportCommon.CompanyRating;
import com.cims.dto.report.ReportCommon.InternshipApplications;
import com.cims.dto.report.ReportCommon.PerformanceAverages;
import com.cims.dto.report.ReportCommon.PopularInternship;
import com.cims.dto.report.ReportCommon.StudentFeedbackAverages;
import com.cims.dto.report.ReportCommon.TopStudent;
import com.cims.entity.enums.ApplicationStatus;
import com.cims.entity.enums.InternshipStatus;
import com.cims.entity.enums.InterviewResult;
import com.cims.entity.enums.InterviewStatus;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

/**
 * Aggregate JPQL queries for dashboards and reports. Every figure is computed from the
 * database at request time; optional {@code facultyId}/{@code studentId} parameters scope the
 * results to one user.
 */
@Repository
public class ReportQueryRepository {

    @PersistenceContext
    private EntityManager em;

    // ------------------------------------------------------------------ applications

    public Map<ApplicationStatus, Long> applicationStatusCounts(Long facultyId, Long studentId) {
        List<Object[]> rows = em.createQuery("""
                        select a.status, count(a) from Application a
                        where (:facultyId is null or a.internship.faculty.id = :facultyId)
                          and (:studentId is null or a.student.id = :studentId)
                        group by a.status""", Object[].class)
                .setParameter("facultyId", facultyId)
                .setParameter("studentId", studentId)
                .getResultList();
        Map<ApplicationStatus, Long> counts = new EnumMap<>(ApplicationStatus.class);
        for (ApplicationStatus status : ApplicationStatus.values()) {
            counts.put(status, 0L);
        }
        rows.forEach(row -> counts.put((ApplicationStatus) row[0], (Long) row[1]));
        return counts;
    }

    public List<Instant> applicationTimestampsSince(Instant since) {
        return em.createQuery("select a.appliedAt from Application a where a.appliedAt >= :since", Instant.class)
                .setParameter("since", since)
                .getResultList();
    }

    public long placedStudents() {
        return em.createQuery("select count(distinct a.student.id) from Application a where a.status = :status", Long.class)
                .setParameter("status", ApplicationStatus.ACCEPTED)
                .getSingleResult();
    }

    public BigDecimal averageAcceptedStipend() {
        Double avg = em.createQuery("select avg(a.internship.stipend) from Application a where a.status = :status", Double.class)
                .setParameter("status", ApplicationStatus.ACCEPTED)
                .getSingleResult();
        return avg == null ? null : BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP);
    }

    public long completedApplications(Long facultyId) {
        return em.createQuery("""
                        select count(a) from Application a
                        where a.completedAt is not null and (:facultyId is null or a.internship.faculty.id = :facultyId)""", Long.class)
                .setParameter("facultyId", facultyId)
                .getSingleResult();
    }

    // ------------------------------------------------------------------ internships

    public Map<InternshipStatus, Long> internshipStatusCounts(Long facultyId) {
        List<Object[]> rows = em.createQuery("""
                        select i.status, count(i) from Internship i
                        where (:facultyId is null or i.faculty.id = :facultyId)
                        group by i.status""", Object[].class)
                .setParameter("facultyId", facultyId)
                .getResultList();
        Map<InternshipStatus, Long> counts = new EnumMap<>(InternshipStatus.class);
        for (InternshipStatus status : InternshipStatus.values()) {
            counts.put(status, 0L);
        }
        rows.forEach(row -> counts.put((InternshipStatus) row[0], (Long) row[1]));
        return counts;
    }

    public List<PopularInternship> popularInternships(int limit) {
        return em.createQuery("""
                        select i.id, i.title, c.name, count(a) from Application a join a.internship i join i.company c
                        group by i.id, i.title, c.name
                        order by count(a) desc, i.id asc""", Object[].class)
                .setMaxResults(limit)
                .getResultList().stream()
                .map(r -> new PopularInternship((Long) r[0], (String) r[1], (String) r[2], (Long) r[3]))
                .toList();
    }

    public List<InternshipApplications> applicationsPerInternship(Long facultyId) {
        return em.createQuery("""
                        select i.id, i.title, i.status, count(a),
                               sum(case when a.status = com.cims.entity.enums.ApplicationStatus.PENDING then 1 else 0 end),
                               sum(case when a.status = com.cims.entity.enums.ApplicationStatus.SHORTLISTED then 1 else 0 end),
                               sum(case when a.status = com.cims.entity.enums.ApplicationStatus.ACCEPTED then 1 else 0 end),
                               sum(case when a.status = com.cims.entity.enums.ApplicationStatus.REJECTED then 1 else 0 end),
                               sum(case when a.status = com.cims.entity.enums.ApplicationStatus.WITHDRAWN then 1 else 0 end)
                        from Internship i left join Application a on a.internship = i
                        where i.faculty.id = :facultyId
                        group by i.id, i.title, i.status
                        order by i.id desc""", Object[].class)
                .setParameter("facultyId", facultyId)
                .getResultList().stream()
                .map(r -> new InternshipApplications((Long) r[0], (String) r[1], r[2].toString(), (Long) r[3],
                        toLong(r[4]), toLong(r[5]), toLong(r[6]), toLong(r[7]), toLong(r[8])))
                .toList();
    }

    // ------------------------------------------------------------------ students / evaluations

    public List<TopStudent> topStudents(int limit) {
        return em.createQuery("""
                        select s.id, s.studentName, s.department, avg(e.overallRating), count(e)
                        from Evaluation e join e.application a join a.student s
                        where e.archived = false
                        group by s.id, s.studentName, s.department
                        order by avg(e.overallRating) desc, count(e) desc, s.id asc""", Object[].class)
                .setMaxResults(limit)
                .getResultList().stream()
                .map(r -> new TopStudent((Long) r[0], (String) r[1], (String) r[2], round((Double) r[3]), (Long) r[4]))
                .toList();
    }

    public PerformanceAverages evaluationAverages(Long facultyId) {
        Object[] r = em.createQuery("""
                        select count(e), avg(e.technicalSkills), avg(e.softSkills), avg(e.punctuality),
                               avg(e.responsibility), avg(e.teamwork), avg(e.learningAbility), avg(e.overallRating)
                        from Evaluation e
                        where e.archived = false and (:facultyId is null or e.application.internship.faculty.id = :facultyId)""",
                        Object[].class)
                .setParameter("facultyId", facultyId)
                .getSingleResult();
        return new PerformanceAverages((Long) r[0], round(r[1]), round(r[2]), round(r[3]), round(r[4]), round(r[5]),
                round(r[6]), round(r[7]));
    }

    public long evaluatedStudents(Long facultyId) {
        return em.createQuery("""
                        select count(distinct e.application.student.id) from Evaluation e
                        where e.archived = false and (:facultyId is null or e.application.internship.faculty.id = :facultyId)""",
                        Long.class)
                .setParameter("facultyId", facultyId)
                .getSingleResult();
    }

    /** Company feedback averages; the "overall" slot holds the average hire likelihood. */
    public PerformanceAverages companyFeedbackAverages(Long facultyId) {
        Object[] r = em.createQuery("""
                        select count(f), avg(f.technicalSkills), avg(f.softSkills), avg(f.punctuality),
                               avg(f.responsibility), avg(f.teamwork), avg(f.learningAbility), avg(f.hireLikelihood)
                        from CompanyFeedback f
                        where (:facultyId is null or f.application.internship.faculty.id = :facultyId)""", Object[].class)
                .setParameter("facultyId", facultyId)
                .getSingleResult();
        return new PerformanceAverages((Long) r[0], round(r[1]), round(r[2]), round(r[3]), round(r[4]), round(r[5]),
                round(r[6]), round(r[7]));
    }

    public StudentFeedbackAverages studentFeedbackAverages(Long facultyId) {
        Object[] r = em.createQuery("""
                        select count(f), avg(f.companyCulture), avg(f.mentorshipQuality), avg(f.technicalLearning),
                               avg(f.workEnvironment), avg(f.overallExperience)
                        from StudentFeedback f
                        where (:facultyId is null or f.application.internship.faculty.id = :facultyId)""", Object[].class)
                .setParameter("facultyId", facultyId)
                .getSingleResult();
        return new StudentFeedbackAverages((Long) r[0], round(r[1]), round(r[2]), round(r[3]), round(r[4]), round(r[5]));
    }

    // ------------------------------------------------------------------ companies

    public List<ActiveCompany> mostActiveCompanies(int limit) {
        return em.createQuery("""
                        select c.id, c.name, count(distinct i.id), count(a.id),
                               sum(case when a.status = com.cims.entity.enums.ApplicationStatus.ACCEPTED then 1 else 0 end)
                        from Company c
                          left join Internship i on i.company = c
                          left join Application a on a.internship = i
                        group by c.id, c.name
                        having count(distinct i.id) > 0
                        order by count(distinct i.id) desc, count(a.id) desc, c.id asc""", Object[].class)
                .setMaxResults(limit)
                .getResultList().stream()
                .map(r -> new ActiveCompany((Long) r[0], (String) r[1], (Long) r[2], (Long) r[3], toLong(r[4])))
                .toList();
    }

    public List<CompanyRating> companyRatings(int limit) {
        return em.createQuery("""
                        select c.id, c.name, avg(f.overallExperience), count(f)
                        from StudentFeedback f join f.application a join a.internship i join i.company c
                        group by c.id, c.name
                        order by avg(f.overallExperience) desc, count(f) desc, c.id asc""", Object[].class)
                .setMaxResults(limit)
                .getResultList().stream()
                .map(r -> new CompanyRating((Long) r[0], (String) r[1], round((Double) r[2]), (Long) r[3]))
                .toList();
    }

    // ------------------------------------------------------------------ interviews

    public Map<InterviewStatus, Long> interviewStatusCounts(Long facultyId) {
        List<Object[]> rows = em.createQuery("""
                        select i.status, count(i) from Interview i
                        where (:facultyId is null or i.application.internship.faculty.id = :facultyId)
                        group by i.status""", Object[].class)
                .setParameter("facultyId", facultyId)
                .getResultList();
        Map<InterviewStatus, Long> counts = new EnumMap<>(InterviewStatus.class);
        for (InterviewStatus status : InterviewStatus.values()) {
            counts.put(status, 0L);
        }
        rows.forEach(row -> counts.put((InterviewStatus) row[0], (Long) row[1]));
        return counts;
    }

    public long interviewsWithResult(Long facultyId, InterviewResult result) {
        return em.createQuery("""
                        select count(i) from Interview i
                        where i.result = :result and (:facultyId is null or i.application.internship.faculty.id = :facultyId)""",
                        Long.class)
                .setParameter("result", result)
                .setParameter("facultyId", facultyId)
                .getSingleResult();
    }

    public long upcomingInterviews(Long facultyId, Long studentId, java.time.LocalDate today) {
        return em.createQuery("""
                        select count(i) from Interview i
                        where i.status = com.cims.entity.enums.InterviewStatus.SCHEDULED and i.interviewDate >= :today
                          and (:facultyId is null or i.application.internship.faculty.id = :facultyId)
                          and (:studentId is null or i.application.student.id = :studentId)""", Long.class)
                .setParameter("today", today)
                .setParameter("facultyId", facultyId)
                .setParameter("studentId", studentId)
                .getSingleResult();
    }

    // ------------------------------------------------------------------ helpers

    private static long toLong(Object value) {
        return value == null ? 0L : ((Number) value).longValue();
    }

    private static Double round(Object value) {
        if (value == null) {
            return null;
        }
        return Math.round(((Number) value).doubleValue() * 100.0) / 100.0;
    }
}
