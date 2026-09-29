package com.cims.repository.spec;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

import org.springframework.data.jpa.domain.Specification;

import com.cims.entity.Company;
import com.cims.entity.Internship;
import com.cims.entity.enums.InternshipStatus;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;

/** Dynamic, parameterised filters for the internship search (no string-built SQL). */
public final class InternshipSpecifications {

    private InternshipSpecifications() {
    }

    public record Filter(String likeQuery, String domain, Long companyId, String likeLocation, BigDecimal minStipend,
                         BigDecimal maxStipend, Collection<InternshipStatus> statuses, Long facultyId) {
    }

    public static Specification<Internship> matching(Filter filter) {
        return (root, query, cb) -> {
            Join<Internship, Company> company;
            boolean countQuery = query != null
                    && (Long.class == query.getResultType() || long.class == query.getResultType());
            if (!countQuery) {
                // Fetch the associations shown in every row to avoid N+1 queries. Hibernate's
                // fetch is also a join, so it can be reused for the company predicates.
                @SuppressWarnings("unchecked")
                Join<Internship, Company> fetched = (Join<Internship, Company>) (Object) root.fetch("company", JoinType.INNER);
                company = fetched;
                root.fetch("faculty", JoinType.INNER);
            } else {
                company = root.join("company", JoinType.INNER);
            }

            List<Predicate> predicates = new ArrayList<>();
            if (filter.likeQuery() != null) {
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")), filter.likeQuery()),
                        cb.like(cb.lower(root.get("domain")), filter.likeQuery()),
                        cb.like(cb.lower(company.get("name")), filter.likeQuery()),
                        cb.like(cb.lower(company.get("location")), filter.likeQuery())));
            }
            if (filter.domain() != null) {
                predicates.add(cb.equal(cb.lower(root.get("domain")), filter.domain().toLowerCase(Locale.ROOT)));
            }
            if (filter.companyId() != null) {
                predicates.add(cb.equal(company.get("id"), filter.companyId()));
            }
            if (filter.likeLocation() != null) {
                predicates.add(cb.like(cb.lower(company.get("location")), filter.likeLocation()));
            }
            if (filter.minStipend() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("stipend"), filter.minStipend()));
            }
            if (filter.maxStipend() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("stipend"), filter.maxStipend()));
            }
            if (filter.statuses() != null && !filter.statuses().isEmpty()) {
                predicates.add(root.get("status").in(filter.statuses()));
            }
            if (filter.facultyId() != null) {
                predicates.add(cb.equal(root.get("faculty").get("id"), filter.facultyId()));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
