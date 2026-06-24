package com.example.ukrstenereci.services;

import com.example.ukrstenereci.models.Korisnik;
import com.example.ukrstenereci.models.LoginRequest;
import com.example.ukrstenereci.repositories.AuthRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuthService {
    private final AuthRepository authRepository;

    public AuthService(AuthRepository authRepository) {
        this.authRepository = authRepository;
    }

    public Korisnik register(Korisnik korisnik) {
        return authRepository.register(korisnik);
    }

    public Korisnik login(LoginRequest request) {
        return authRepository.login(request.getEmail(), request.getLozinka());
    }

    public List<Korisnik> search(String term) {
        return authRepository.search(term);
    }

    public List<Korisnik> leaderboard() {
        return authRepository.leaderboard();
    }
}
