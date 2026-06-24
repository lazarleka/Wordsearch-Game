package com.example.ukrstenereci.controllers;

import com.example.ukrstenereci.models.Korisnik;
import com.example.ukrstenereci.models.LoginRequest;
import com.example.ukrstenereci.services.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping(value = "/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping(value = "/register")
    public ResponseEntity<?> register(@RequestBody Korisnik korisnik) {
        Korisnik created = authService.register(korisnik);
        if (created == null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Email ili korisničko ime već postoji");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping(value = "/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        Korisnik korisnik = authService.login(request);
        if (korisnik == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Pogrešan email ili lozinka");
        }
        return ResponseEntity.ok(korisnik);
    }

    @GetMapping(value = "/users")
    public ResponseEntity<?> searchUsers(@RequestParam(defaultValue = "") String search) {
        return ResponseEntity.ok(authService.search(search));
    }
}
