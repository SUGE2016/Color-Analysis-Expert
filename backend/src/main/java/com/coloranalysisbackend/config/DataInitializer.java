package com.coloranalysisbackend.config;

import com.coloranalysisbackend.service.AuthService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {
    private final AuthService authService;

    public DataInitializer(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public void run(String... args) throws Exception {
        try {
            authService.register("admin", "admin123");
            System.out.println("created default admin user");
        } catch (Exception ignored) {
            // User already exists, try to update role
            try {
                authService.updateAdminRole();
                System.out.println("updated admin user role to ROLE_ADMIN");
            } catch (Exception e) {
                System.out.println("failed to update admin role: " + e.getMessage());
            }
        }
    }
}