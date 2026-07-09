package com.example.ukrstenereci.controllers;

import com.example.ukrstenereci.services.GameService;
import com.example.ukrstenereci.models.ThemeSubmissionRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping(value = "/api")
public class ThemeController {
    private final GameService gameService;

    public ThemeController(GameService gameService) {
        this.gameService = gameService;
    }

    @GetMapping(value = "/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(java.util.Map.of("ok", true));
    }

    @GetMapping(value = "/themes")
    public ResponseEntity<?> themes() {
        return ResponseEntity.ok(gameService.getThemes());
    }

    @GetMapping(value = "/themes/{themeId}/words")
    public ResponseEntity<?> words(@PathVariable String themeId, @RequestParam(defaultValue = "10") int count) {
        return ResponseEntity.ok(gameService.getWords(themeId, count));
    }

    @PostMapping(value = "/themes/submit")
    public ResponseEntity<?> submit(@RequestBody ThemeSubmissionRequest request) {
        Object created = gameService.submitTheme(request);
        if (created == null) return ResponseEntity.badRequest().body("Prijedlog teme nije sačuvan.");
        return ResponseEntity.status(201).body(created);
    }

    @GetMapping(value = "/admin/theme-submissions")
    public ResponseEntity<?> pendingSubmissions() {
        return ResponseEntity.ok(gameService.pendingThemeSubmissions());
    }

    @PostMapping(value = "/admin/theme-submissions/{id}/approve")
    public ResponseEntity<?> approveSubmission(@PathVariable int id, @RequestBody(required = false) Map<String, Object> request) {
        Object approved = request == null || request.isEmpty()
                ? gameService.approveThemeSubmission(id)
                : gameService.approveThemeSubmission(id, request);
        if (approved == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(approved);
    }
}
