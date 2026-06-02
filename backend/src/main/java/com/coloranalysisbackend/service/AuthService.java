package com.coloranalysisbackend.service;

import com.coloranalysisbackend.model.User;
import com.coloranalysisbackend.repository.UserRepository;
import com.coloranalysisbackend.security.CustomUserDetails;
import com.coloranalysisbackend.security.JwtUtil;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authManager;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       AuthenticationManager authManager,
                       JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authManager = authManager;
        this.jwtUtil = jwtUtil;
    }

    public String register(String username, String rawPassword) {
        if (userRepository.findByUsername(username).isPresent()) {
            throw new IllegalArgumentException("用户名已存在");
        }
        User user = new User();
        user.setId(UUID.randomUUID().toString());
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setRole("ROLE_USER");
        userRepository.save(user);
        return user.getId();
    }

    public String login(String username, String password) {
        Authentication auth = authManager.authenticate(
                new UsernamePasswordAuthenticationToken(username, password));
        CustomUserDetails details = (CustomUserDetails) auth.getPrincipal();
        return jwtUtil.generateToken(details.getUsername());
    }
}