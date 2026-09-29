package com.cims.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.cims.entity.Company;
import com.cims.entity.enums.CompanyStatus;

public interface CompanyRepository extends JpaRepository<Company, Long> {

    boolean existsByRegistrationNumber(String registrationNumber);

    boolean existsByRegistrationNumberAndIdNot(String registrationNumber, Long id);

    long countByStatus(CompanyStatus status);

    List<Company> findByStatusOrderByNameAsc(CompanyStatus status);

    @Query("""
            select c from Company c
            where (:q is null or lower(c.name) like :q or lower(c.registrationNumber) like :q
                   or lower(c.contactPerson) like :q)
              and (:location is null or lower(c.location) like :location)
              and (:status is null or c.status = :status)
            """)
    Page<Company> search(@Param("q") String q, @Param("location") String location,
                         @Param("status") CompanyStatus status, Pageable pageable);
}
