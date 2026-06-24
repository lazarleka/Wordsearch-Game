package com.example.ukrstenereci.controllers;

import com.example.ukrstenereci.models.ChallengeRequest;
import com.example.ukrstenereci.models.MatchProgressRequest;
import com.example.ukrstenereci.models.SoloResultRequest;
import com.example.ukrstenereci.services.GameService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping(value = "/api")
public class MultiplayerController {
    private final GameService gameService;

    public MultiplayerController(GameService gameService) {
        this.gameService = gameService;
    }

    @PostMapping(value = "/challenges")
    public ResponseEntity<?> createChallenge(@RequestBody ChallengeRequest request) {
        Object created = gameService.createChallenge(request);
        if (created == null) return ResponseEntity.badRequest().body("Izazov nije kreiran.");
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping(value = "/users/{id}/challenges")
    public ResponseEntity<?> challenges(@PathVariable int id) {
        return ResponseEntity.ok(gameService.getChallengesForUser(id));
    }

    @GetMapping(value = "/users/{id}/outgoing-challenges")
    public ResponseEntity<?> outgoingChallenges(@PathVariable int id) {
        return ResponseEntity.ok(gameService.getOutgoingChallengesForUser(id));
    }

    @GetMapping(value = "/users/{id}/active-match")
    public ResponseEntity<?> activeMatch(@PathVariable int id) {
        Object match = gameService.getActiveMatchForUser(id);
        return match == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(match);
    }

    @GetMapping(value = "/matches/{id}/result/{userId}")
    public ResponseEntity<?> matchResult(@PathVariable int id, @PathVariable int userId) {
        Object result = gameService.getMatchResult(id, userId);
        return result == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(result);
    }

    @GetMapping(value = "/users/{id}/matches")
    public ResponseEntity<?> history(@PathVariable int id) {
        return ResponseEntity.ok(gameService.getHistoryForUser(id));
    }

    @GetMapping(value = "/users/{id}/achievements")
    public ResponseEntity<?> achievements(@PathVariable int id) {
        return ResponseEntity.ok(gameService.achievementsForUser(id));
    }

    @PostMapping(value = "/challenges/{id}/accept")
    public ResponseEntity<?> acceptChallenge(@PathVariable int id, @RequestBody Map<String, Integer> body) {
        Object match = gameService.acceptChallenge(id, body.getOrDefault("userId", 0));
        if (match == null) return ResponseEntity.notFound().build();
        return ResponseEntity.status(HttpStatus.CREATED).body(match);
    }

    @PostMapping(value = "/challenges/{id}/reject")
    public ResponseEntity<?> rejectChallenge(@PathVariable int id, @RequestBody Map<String, Integer> body) {
        Object result = gameService.rejectChallenge(id, body.getOrDefault("userId", 0));
        if (result == null) return ResponseEntity.badRequest().body("Izazov nije moguće odbiti.");
        return ResponseEntity.ok(result);
    }

    @PostMapping(value = "/matches/{id}/progress")
    public ResponseEntity<?> progress(@PathVariable int id, @RequestBody MatchProgressRequest request) {
        Object progress = gameService.updateProgress(id, request);
        if (progress == null) return ResponseEntity.badRequest().body("Napredak nije sačuvan.");
        return ResponseEntity.ok(progress);
    }

    @PostMapping(value = "/matches/{id}/finish")
    public ResponseEntity<?> finish(@PathVariable int id) {
        Object result = gameService.finishMatch(id);
        if (result == null) return ResponseEntity.badRequest().body("Meč ne može biti završen.");
        return ResponseEntity.ok(result);
    }

    @PostMapping(value = "/solo-results")
    public ResponseEntity<?> soloResult(@RequestBody SoloResultRequest request) {
        Object result = gameService.saveSoloResult(request);
        if (result == null) return ResponseEntity.badRequest().body("Solo rezultat nije sačuvan.");
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PostMapping(value = "/matches/{id}/forfeit")
    public ResponseEntity<?> forfeit(@PathVariable int id, @RequestBody MatchProgressRequest request) {
        Object result = gameService.forfeitMatch(id, request);
        if (result == null) return ResponseEntity.badRequest().body("Predaja nije moguća.");
        return ResponseEntity.ok(result);
    }
}
