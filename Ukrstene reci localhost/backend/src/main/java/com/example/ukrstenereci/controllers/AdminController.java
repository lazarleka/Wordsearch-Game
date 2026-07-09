package com.example.ukrstenereci.controllers;

import com.example.ukrstenereci.services.GameService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping(value = "/api/admin")
public class AdminController {
    private final GameService gameService;

    public AdminController(GameService gameService) {
        this.gameService = gameService;
    }

    @GetMapping(value = "/dashboard")
    public ResponseEntity<?> dashboard(@RequestParam int adminUserId) {
        Object data = gameService.adminDashboard(adminUserId);
        if (data == null) return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Nema admin pristup.");
        return ResponseEntity.ok(data);
    }

    @PostMapping(value = "/themes")
    public ResponseEntity<?> createTheme(@RequestBody Map<String, Object> request) {
        Object created = gameService.createAdminTheme(request);
        if (created == null) return ResponseEntity.badRequest().body("Tema nije sacuvana.");
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping(value = "/themes/{id}")
    public ResponseEntity<?> updateTheme(@PathVariable String id, @RequestBody Map<String, Object> request) {
        Object updated = gameService.updateAdminTheme(id, request);
        if (updated == null) return ResponseEntity.badRequest().body("Tema nije izmijenjena.");
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping(value = "/themes/{id}")
    public ResponseEntity<?> deleteTheme(@PathVariable String id, @RequestParam int adminUserId) {
        if (!gameService.deleteAdminTheme(adminUserId, id)) return ResponseEntity.badRequest().body("Tema nije obrisana.");
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping(value = "/words")
    public ResponseEntity<?> createWord(@RequestBody Map<String, Object> request) {
        Object created = gameService.createAdminWord(request);
        if (created == null) return ResponseEntity.badRequest().body("Rijec nije sacuvana.");
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping(value = "/words/{id}")
    public ResponseEntity<?> updateWord(@PathVariable int id, @RequestBody Map<String, Object> request) {
        Object updated = gameService.updateAdminWord(id, request);
        if (updated == null) return ResponseEntity.badRequest().body("Rijec nije izmijenjena.");
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping(value = "/words/{id}")
    public ResponseEntity<?> deleteWord(@PathVariable int id, @RequestParam int adminUserId) {
        if (!gameService.deleteAdminWord(adminUserId, id)) return ResponseEntity.badRequest().body("Rijec nije obrisana.");
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping(value = "/theme-submissions/{id}/reject")
    public ResponseEntity<?> rejectSubmission(@PathVariable int id, @RequestBody Map<String, Object> request) {
        Object rejected = gameService.rejectThemeSubmission(id, request);
        if (rejected == null) return ResponseEntity.badRequest().body("Prijedlog nije odbijen.");
        return ResponseEntity.ok(rejected);
    }
}
