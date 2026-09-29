package com.cims.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.cims.entity.enums.Role;
import com.cims.repository.UserRepository;
import com.cims.service.UserAccountService;
import com.cims.util.TextUtils;
import com.cims.validation.ValidationPatterns;

/**
 * Creates the first administrator of a fresh production database (seed.sql is for development
 * only). Runs only when BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are set AND no admin
 * account exists yet; remove the variables after the first successful start.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository userRepository;
    private final UserAccountService userAccountService;
    private final String email;
    private final String password;

    public AdminBootstrap(UserRepository userRepository, UserAccountService userAccountService,
                          @Value("${app.bootstrap-admin.email:}") String email,
                          @Value("${app.bootstrap-admin.password:}") String password) {
        this.userRepository = userRepository;
        this.userAccountService = userAccountService;
        this.email = email;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            return;
        }
        if (userRepository.countByRole(Role.ADMIN) > 0) {
            log.info("Administrator already exists; BOOTSTRAP_ADMIN_* variables are ignored and can be removed.");
            return;
        }
        if (!ValidationPatterns.PASSWORD_PATTERN.matcher(password).matches()) {
            log.error("BOOTSTRAP_ADMIN_PASSWORD does not meet the password policy (8+ chars, upper, lower, digit, special). "
                    + "No administrator was created.");
            return;
        }
        userAccountService.createUser(TextUtils.normalizeEmail(email), password, Role.ADMIN, true);
        log.info("Created the initial administrator account {}. Remove BOOTSTRAP_ADMIN_* variables now.",
                TextUtils.normalizeEmail(email));
    }
}
