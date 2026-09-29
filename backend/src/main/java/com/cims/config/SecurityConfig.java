package com.cims.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.cims.repository.UserRepository;
import com.cims.security.JwtAuthenticationFilter;
import com.cims.security.JwtService;
import com.cims.security.RestAccessDeniedHandler;
import com.cims.security.RestAuthenticationEntryPoint;

/**
 * Stateless JWT security. URL rules give coarse role separation; fine-grained ownership
 * checks (e.g. a faculty member may only manage their own internships) live in the services.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService,
                                                   UserRepository userRepository,
                                                   RestAuthenticationEntryPoint authenticationEntryPoint,
                                                   RestAccessDeniedHandler accessDeniedHandler) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> { })
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login",
                                "/api/auth/verify-email").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                        .requestMatchers("/error").permitAll()
                        // Role checks for writes happen here, before the request body is validated,
                        // so unauthorised callers get 403 rather than validation details.
                        // @PreAuthorize on the controllers repeats them as a second layer.
                        .requestMatchers("/api/reports/admin/**", "/api/dashboard/admin/**", "/api/audit-logs/**",
                                "/api/users/**").hasRole("ADMIN")
                        .requestMatchers("/api/reports/faculty/**", "/api/dashboard/faculty/**").hasRole("FACULTY")
                        .requestMatchers("/api/reports/student/**", "/api/dashboard/student/**").hasRole("STUDENT")
                        .requestMatchers("/api/students/me/**", "/api/students/me").hasRole("STUDENT")
                        .requestMatchers(HttpMethod.GET, "/api/students").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/students").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/students/*").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/students/*").hasRole("ADMIN")
                        .requestMatchers("/api/faculty/me/**", "/api/faculty/me").hasRole("FACULTY")
                        .requestMatchers("/api/faculty", "/api/faculty/options").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/faculty/*").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/faculty/*").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/companies/options").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.POST, "/api/companies/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/companies/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/companies/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/companies/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/internships/**").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.PUT, "/api/internships/**").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.PATCH, "/api/internships/**").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.DELETE, "/api/internships/**").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.PATCH, "/api/applications/*/status").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.POST, "/api/applications/*/complete").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.POST, "/api/applications").hasRole("STUDENT")
                        .requestMatchers(HttpMethod.PUT, "/api/applications/*").hasRole("STUDENT")
                        .requestMatchers(HttpMethod.DELETE, "/api/applications/*").hasRole("STUDENT")
                        .requestMatchers(HttpMethod.POST, "/api/interviews/**").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.PUT, "/api/interviews/**").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.PATCH, "/api/interviews/**").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.DELETE, "/api/interviews/**").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.GET, "/api/evaluations/pending").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.POST, "/api/evaluations/**").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.PUT, "/api/evaluations/**").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.DELETE, "/api/evaluations/**").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.POST, "/api/feedback/student/**").hasRole("STUDENT")
                        .requestMatchers(HttpMethod.PUT, "/api/feedback/student/**").hasRole("STUDENT")
                        .requestMatchers(HttpMethod.POST, "/api/feedback/company/**").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.PUT, "/api/feedback/company/**").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.GET, "/api/feedback/faculty/**").hasAnyRole("ADMIN", "FACULTY")
                        .requestMatchers(HttpMethod.POST, "/api/feedback/faculty/**").hasRole("FACULTY")
                        .requestMatchers(HttpMethod.PUT, "/api/feedback/faculty/**").hasRole("FACULTY")
                        .requestMatchers(HttpMethod.PATCH, "/api/feedback/system/*/status").hasRole("ADMIN")
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().denyAll())
                .addFilterBefore(new JwtAuthenticationFilter(jwtService, userRepository),
                        UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(AppProperties properties) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(properties.cors().allowedOrigins().stream()
                .map(String::trim)
                .map(origin -> origin.endsWith("/") ? origin.substring(0, origin.length() - 1) : origin)
                .filter(origin -> !origin.isEmpty())
                .toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
        config.setExposedHeaders(List.of("Content-Disposition"));
        config.setAllowCredentials(false);
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
