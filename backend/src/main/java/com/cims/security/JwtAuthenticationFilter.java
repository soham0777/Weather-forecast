package com.cims.security;

import java.io.IOException;
import java.util.Optional;

import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import com.cims.entity.User;
import com.cims.repository.UserRepository;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Authenticates requests carrying {@code Authorization: Bearer <jwt>}. The user is re-loaded
 * from the database on every request so that deactivated accounts and role changes take
 * effect immediately, even for tokens issued earlier.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /** Request attribute read by {@link RestAuthenticationEntryPoint} to explain a 401. */
    public static final String AUTH_ERROR_ATTRIBUTE = "cims.authError";

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            chain.doFilter(request, response);
            return;
        }

        String token = header.substring(BEARER_PREFIX.length()).trim();
        try {
            Claims claims = jwtService.parse(token);
            Long userId = Long.valueOf(claims.getSubject());
            Optional<User> user = userRepository.findById(userId);
            if (user.isEmpty()) {
                request.setAttribute(AUTH_ERROR_ATTRIBUTE, "Your account no longer exists.");
            } else if (!user.get().isActive()) {
                request.setAttribute(AUTH_ERROR_ATTRIBUTE, "Your account has been deactivated. Please contact the administrator.");
            } else {
                User u = user.get();
                UserPrincipal principal = new UserPrincipal(u.getId(), u.getEmail(), u.getRole());
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(principal, null, principal.authorities());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        } catch (ExpiredJwtException ex) {
            request.setAttribute(AUTH_ERROR_ATTRIBUTE, "Your session has expired. Please log in again.");
        } catch (JwtException | IllegalArgumentException ex) {
            request.setAttribute(AUTH_ERROR_ATTRIBUTE, "Invalid authentication token. Please log in again.");
        }
        chain.doFilter(request, response);
    }
}
