package com.cims.repository.spec;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;

import com.cims.entity.Application;
import com.cims.entity.Internship;
import com.cims.entity.Interview;
import com.cims.entity.Student;
import com.cims.entity.enums.InterviewStatus;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;

public final class InterviewSpecifications {

    private InterviewSpecifications() {
    }

    /** {@code scope}: "upcoming" (scheduled, today or later), "past" (everything else) or null. */
    public record Filter(Long studentId, Long facultyId, Long applicationId, InterviewStatus status, String scope,
                         LocalDate today, String likeQuery) {
    }

    @SuppressWarnings("unchecked")
    public static Specification<Interview> matching(Filter filter) {
        return (root, query, cb) -> {
            boolean countQuery = query != null
                    && (Long.class == query.getResultType() || long.class == query.getResultType());
            Join<Interview, Application> application;
            Join<Application, Student> student;
            Join<Application, Internship> internship;
            if (!countQuery) {
                application = (Join<Interview, Application>) (Object) root.fetch("application", JoinType.INNER);
                student = (Join<Application, Student>) (Object) application.fetch("student", JoinType.INNER);
                student.fetch("user", JoinType.INNER);
                internship = (Join<Application, Internship>) (Object) application.fetch("internship", JoinType.INNER);
                internship.fetch("company", JoinType.INNER);
            } else {
                application = root.join("application", JoinType.INNER);
                student = application.join("student", JoinType.INNER);
                internship = application.join("internship", JoinType.INNER);
            }

            List<Predicate> predicates = new ArrayList<>();
            if (filter.studentId() != null) {
                predicates.add(cb.equal(student.get("id"), filter.studentId()));
            }
            if (filter.facultyId() != null) {
                predicates.add(cb.equal(internship.get("faculty").get("id"), filter.facultyId()));
            }
            if (filter.applicationId() != null) {
                predicates.add(cb.equal(application.get("id"), filter.applicationId()));
            }
            if (filter.status() != null) {
                predicates.add(cb.equal(root.get("status"), filter.status()));
            }
            if ("upcoming".equalsIgnoreCase(filter.scope())) {
                predicates.add(cb.equal(root.get("status"), InterviewStatus.SCHEDULED));
                predicates.add(cb.greaterThanOrEqualTo(root.get("interviewDate"), filter.today()));
            } else if ("past".equalsIgnoreCase(filter.scope())) {
                predicates.add(cb.or(cb.notEqual(root.get("status"), InterviewStatus.SCHEDULED),
                        cb.lessThan(root.get("interviewDate"), filter.today())));
            }
            if (filter.likeQuery() != null) {
                predicates.add(cb.or(
                        cb.like(cb.lower(student.get("studentName")), filter.likeQuery()),
                        cb.like(cb.lower(internship.get("title")), filter.likeQuery()),
                        cb.like(cb.lower(root.get("interviewerName")), filter.likeQuery())));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
