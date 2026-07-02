package com.coloranalysisbackend.controller;

import com.coloranalysisbackend.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import com.coloranalysisbackend.model.User;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "认证管理", description = "注册、登录与JWT认证")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @Operation(summary = "用户注册", description = "创建新用户账号")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
        try {
            String id = authService.register(req.getUsername(), req.getPassword());
            return ResponseEntity.ok(new IdResponse(id));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @PostMapping("/login")
    @Operation(summary = "用户登录", description = "使用用户名密码登录并获取JWT")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        try {
            AuthService.LoginResult result = authService.login(req.getUsername(), req.getPassword());
            return ResponseEntity.ok(new LoginResponse(result.token(), result.userId(), result.username()));
        } catch (AuthenticationException ex) {
            return ResponseEntity.status(401).body("认证失败");
        }
    }

    @PostMapping("/change-password")
    @Operation(summary = "修改密码", description = "验证旧密码后更新为新密码")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordRequest req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return ResponseEntity.status(401).build();
        }
        try {
            authService.changePassword(auth.getName(), req.getOldPassword(), req.getNewPassword());
            return ResponseEntity.ok(Map.of("message", "密码修改成功"));
        } catch (BadCredentialsException ex) {
            return ResponseEntity.status(401).body(ex.getMessage());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @GetMapping("/me")
    @Operation(summary = "当前登录用户")
    public ResponseEntity<?> me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return ResponseEntity.status(401).build();
        }
        try {
            User user = authService.me(auth.getName());
            return ResponseEntity.ok(new MeResponse(user.getId(), user.getUsername()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @Data
    public static class RegisterRequest {
        private String username;
        private String password;
    }

    @Data
    public static class LoginRequest {
        private String username;
        private String password;
    }

    @Data
    public static class LoginResponse {
        private final String token;
        private final String userId;
        private final String username;
    }

    @Data
    public static class MeResponse {
        private final String userId;
        private final String username;
    }

    @Data
    public static class IdResponse {
        private final String id;
    }

    @Data
    public static class ChangePasswordRequest {
        private String oldPassword;
        private String newPassword;
    }
}