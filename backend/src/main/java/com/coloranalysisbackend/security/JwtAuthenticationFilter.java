package com.coloranalysisbackend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    public JwtAuthenticationFilter(JwtUtil jwtUtil, UserDetailsService userDetailsService) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        String method = request.getMethod();
        System.out.println("JWT Filter: " + method + " " + path);
        System.out.println("JWT Filter: SecurityContext before filter = " + SecurityContextHolder.getContext().getAuthentication());
        
        // Skip JWT validation for public endpoints
        if (path.startsWith("/api/auth/") || 
            path.startsWith("/api/images/") || 
            path.startsWith("/api/tasks/") ||
            path.startsWith("/v3/api-docs/") ||
            path.startsWith("/swagger-ui") ||
            path.equals("/swagger-ui.html") ||
            path.equals("/error")) {
            System.out.println("JWT Filter: Skipping public path");
            filterChain.doFilter(request, response);
            return;
        }
        
        String header = request.getHeader("Authorization");
        System.out.println("JWT Filter: Authorization header = " + (header != null ? header.substring(0, Math.min(20, header.length())) + "..." : "null"));
        
        if (header != null && header.startsWith("Bearer ")) {
            try {
                String token = header.substring(7);
                System.out.println("JWT Filter: Token length = " + token.length());
                System.out.println("JWT Filter: Token (first 50 chars) = " + token.substring(0, Math.min(50, token.length())));
                
                String username = jwtUtil.extractUsername(token);
                System.out.println("JWT Filter: Extracted username = " + username);
                
                if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                    System.out.println("JWT Filter: Loading user details for " + username);
                    UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                    System.out.println("JWT Filter: User details loaded, username=" + userDetails.getUsername());
                    System.out.println("JWT Filter: User authorities=" + userDetails.getAuthorities());
                    System.out.println("JWT Filter: User enabled=" + userDetails.isEnabled());
                    
                    System.out.println("JWT Filter: Validating token for user=" + userDetails.getUsername());
                    boolean isValid = jwtUtil.validateToken(token, userDetails.getUsername());
                    System.out.println("JWT Filter: Token valid = " + isValid);
                    
                    if (isValid) {
                        UsernamePasswordAuthenticationToken authToken =
                                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authToken);
                        System.out.println("JWT Filter: Authentication set for user=" + username + ", authorities=" + userDetails.getAuthorities());
                        System.out.println("JWT Filter: SecurityContext after set = " + SecurityContextHolder.getContext().getAuthentication());
                    } else {
                        System.out.println("JWT Filter: Token validation failed for user=" + username);
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.setContentType("application/json");
                        response.getWriter().write("{\"error\":\"Token validation failed\"}");
                        return;
                    }
                } else {
                    System.out.println("JWT Filter: username is null or authentication already exists");
                    if (SecurityContextHolder.getContext().getAuthentication() != null) {
                        System.out.println("JWT Filter: Existing authentication = " + SecurityContextHolder.getContext().getAuthentication());
                    }
                }
            } catch (RuntimeException ex) {
                System.out.println("JWT Filter: Exception - " + ex.getClass().getName() + ": " + ex.getMessage());
                ex.printStackTrace();
                SecurityContextHolder.clearContext();
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"JWT validation failed: " + ex.getMessage() + "\"}");
                return;
            }
        } else {
            System.out.println("JWT Filter: No valid Authorization header for path=" + path);
        }
        
        System.out.println("JWT Filter: Proceeding to filter chain");
        filterChain.doFilter(request, response);
        System.out.println("JWT Filter: After filter chain, SecurityContext = " + SecurityContextHolder.getContext().getAuthentication());
    }
}
