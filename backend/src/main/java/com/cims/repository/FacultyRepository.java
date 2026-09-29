package com.cims.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.cims.entity.Faculty;

public interface FacultyRepository extends JpaRepository<Faculty, Long> {

    @EntityGraph(attributePaths = "user")
    Optional<Faculty> findByUserId(Long userId);

    @EntityGraph(attributePaths = "user")
    Optional<Faculty> findWithUserById(Long id);

    @EntityGraph(attributePaths = "user")
    @Query(value = """
            select f from Faculty f join f.user u
            where (:q is null or lower(f.name) like :q or lower(u.email) like :q or lower(f.designation) like :q)
              and (:department is null or f.department = :department)
              and (:active is null or u.active = :active)
            """,
            countQuery = """
            select count(f) from Faculty f join f.user u
            where (:q is null or lower(f.name) like :q or lower(u.email) like :q or lower(f.designation) like :q)
              and (:department is null or f.department = :department)
              and (:active is null or u.active = :active)
            """)
    Page<Faculty> search(@Param("q") String q, @Param("department") String department,
                         @Param("active") Boolean active, Pageable pageable);

    List<Faculty> findByUserIdIn(Collection<Long> userIds);

    @Query("select f from Faculty f join f.user u where u.active = true order by f.name")
    List<Faculty> findAllActive();
}
