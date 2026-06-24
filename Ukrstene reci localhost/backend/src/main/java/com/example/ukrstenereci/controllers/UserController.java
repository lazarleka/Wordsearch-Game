package com.example.ukrstenereci.controllers;

import com.example.ukrstenereci.services.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping(value = "/api")
public class UserController {
    private final AuthService authService;

    public UserController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping(value = "/users")
    public ResponseEntity<?> searchUsers(@RequestParam(defaultValue = "") String search) {
        return ResponseEntity.ok(authService.search(search));
    }

    @GetMapping(value = "/leaderboard")
    public ResponseEntity<?> leaderboard() {
        return ResponseEntity.ok(authService.leaderboard());
    }
}
