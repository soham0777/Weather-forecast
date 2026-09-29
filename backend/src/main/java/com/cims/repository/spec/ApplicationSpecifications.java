package com.cims.repository.spec;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;

import com.cims.entity.Application;
import com.cims.entity.Company;
import com.cims.entity.Internship;
import com.cims.entity.Student;
import com.cims.entity.User;
import com.cims.entity.enums.ApplicationStatus;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;

/** Parameterised filters for application lists. */
public final class ApplicationSpecifications {

    private ApplicationSpecifications() {
    }

    public record Filter(Long studentId, Long facultyId, Long internshipId, Long companyId, ApplicationStatus status,
                         String likeQuery) {
    }

    @SuppressWarnings("unchecked")
    public static Specification<Application> matching(Filter filter) {
        return (root, query, cb) -> {
            boolean countQuery = query != null
                    && (Long.class == query.getResultType() || long.class == query.getResultType());
            Join<Application, Student> student;
            Join<Application, Internship> internship;
            Join<Student, User> user;
            Join<Internship, Company> company;
            if (!countQuery) {
                student = (Join<Application, Student>) (Object) root.fetch("student", JoinType.INNER);
                user = (Join<Student, User>) (Object) student.fetch("user", JoinType.INNER);
                internship = (Join<Application, Internship>) (Object) root.fetch("internship", JoinType.INNER);
                company = (Join<Internship, Company>) (Object) internship.fetch("company", JoinType.INNER);
                internship.fetch("faculty", JoinType.INNER);
            } else {
                student = root.join("student", JoinType.INNER);
                user = student.join("user", JoinType.INNER);
                internship = root.join("internship", JoinType.INNER);
                company = internship.join("company", JoinType.INNER);
            }

            List<Predicate> predicates = new ArrayList<>();
            if (filter.studentId() != null) {
                predicates.add(cb.equal(student.get("id"), filter.studentId()));
            }
            if (filter.facultyId() != null) {
                predicates.add(cb.equal(internship.get("faculty").get("id"), filter.facultyId()));
            }
            if (filter.internshipId() != null) {
                predicates.add(cb.equal(internship.get("id"), filter.internshipId()));
            }
            if (filter.companyId() != null) {
                predicates.add(cb.equal(company.get("id"), filter.companyId()));
            }
            if (filter.status() != null) {
                predicates.add(cb.equal(root.get("status"), filter.status()));
            }
            if (filter.likeQuery() != null) {
                predicates.add(cb.or(
                        cb.like(cb.lower(student.get("studentName")), filter.likeQuery()),
                        cb.like(cb.lower(user.get("email")), filter.likeQuery()),
                        cb.like(cb.lower(internship.get("title")), filter.likeQuery()),
                        cb.like(cb.lower(company.get("name")), filter.likeQuery())));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
