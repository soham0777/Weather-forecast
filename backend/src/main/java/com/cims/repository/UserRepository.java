package com.cims.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.cims.entity.User;
import com.cims.entity.enums.Role;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByRole(Role role);

    long countByRoleAndActiveTrue(Role role);

    long countByVerifiedTrue();

    long countByVerifiedFalse();

    @Query("select u.createdAt from User u where u.createdAt >= :since")
    List<Instant> findCreatedAtSince(@Param("since") Instant since);
}
