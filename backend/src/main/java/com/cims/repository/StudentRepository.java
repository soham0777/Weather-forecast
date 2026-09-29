package com.cims.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.cims.entity.Student;

public interface StudentRepository extends JpaRepository<Student, Long> {

    @EntityGraph(attributePaths = "user")
    Optional<Student> findByUserId(Long userId);

    @EntityGraph(attributePaths = "user")
    Optional<Student> findWithUserById(Long id);

    /**
     * Admin student list. {@code q} must already be lower-case and wrapped in % wildcards.
     */
    @EntityGraph(attributePaths = "user")
    @Query(value = """
            select s from Student s join s.user u
            where (:q is null or lower(s.studentName) like :q or lower(u.email) like :q or s.phone like :q)
              and (:department is null or s.department = :department)
              and (:active is null or u.active = :active)
            """,
            countQuery = """
            select count(s) from Student s join s.user u
            where (:q is null or lower(s.studentName) like :q or lower(u.email) like :q or s.phone like :q)
              and (:department is null or s.department = :department)
              and (:active is null or u.active = :active)
            """)
    Page<Student> search(@Param("q") String q, @Param("department") String department,
                         @Param("active") Boolean active, Pageable pageable);

    @Query("select distinct s.department from Student s order by s.department")
    List<String> findDistinctDepartments();

    long countByResumePathIsNotNull();

    long countByResumePathIsNull();
}
