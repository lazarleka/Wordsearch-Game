package com.example.ukrstenereci.controllers;

import com.example.ukrstenereci.models.FriendRequest;
import com.example.ukrstenereci.services.GameService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping(value = "/api")
public class FriendController {
    private final GameService gameService;

    public FriendController(GameService gameService) {
        this.gameService = gameService;
    }

    @PostMapping(value = "/friends/request")
    public ResponseEntity<?> request(@RequestBody FriendRequest request) {
        if (request.getFromUserId() == request.getToUserId()) {
            return ResponseEntity.badRequest().body("Ne mozes dodati samog sebe.");
        }
        Object created = gameService.sendFriendRequest(request.getFromUserId(), request.getToUserId());
        if (created == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Zahtjev nije kreiran.");
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping(value = "/friends/{id}/accept")
    public ResponseEntity<?> accept(@PathVariable int id) {
        Object accepted = gameService.acceptFriend(id);
        if (accepted == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(accepted);
    }

    @GetMapping(value = "/users/{id}/friends")
    public ResponseEntity<?> friends(@PathVariable int id) {
        return ResponseEntity.ok(gameService.getFriends(id));
    }

    @GetMapping(value = "/users/{id}/friendships")
    public ResponseEntity<?> friendships(@PathVariable int id) {
        return ResponseEntity.ok(gameService.getFriendships(id));
    }

    @GetMapping(value = "/users/{id}/friends-page")
    public ResponseEntity<?> friendsPage(@PathVariable int id) {
        return ResponseEntity.ok(gameService.getFriendsPage(id));
    }
}
