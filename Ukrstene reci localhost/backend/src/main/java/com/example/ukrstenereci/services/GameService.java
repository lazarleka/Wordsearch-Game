package com.example.ukrstenereci.services;

import com.example.ukrstenereci.models.ChallengeRequest;
import com.example.ukrstenereci.models.Korisnik;
import com.example.ukrstenereci.models.MatchProgressRequest;
import com.example.ukrstenereci.models.SoloResultRequest;
import com.example.ukrstenereci.models.Tema;
import com.example.ukrstenereci.models.ThemeSubmissionRequest;
import com.example.ukrstenereci.repositories.GameRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class GameService {
    private final GameRepository gameRepository;

    public GameService(GameRepository gameRepository) {
        this.gameRepository = gameRepository;
    }

    public List<Tema> getThemes() {
        return gameRepository.getThemes();
    }

    public List<String> getWords(String themeId, int count) {
        return gameRepository.getWords(themeId, count);
    }

    public Map<String, Object> sendFriendRequest(int fromUserId, int toUserId) {
        return gameRepository.sendFriendRequest(fromUserId, toUserId);
    }

    public Map<String, Object> acceptFriend(int friendshipId) {
        return gameRepository.acceptFriend(friendshipId);
    }

    public List<Korisnik> getFriends(int userId) {
        return gameRepository.getFriends(userId);
    }

    public List<Map<String, Object>> getFriendships(int userId) {
        return gameRepository.getFriendships(userId);
    }

    public Map<String, Object> getFriendsPage(int userId) {
        return gameRepository.getFriendsPage(userId);
    }

    public Map<String, Object> createChallenge(ChallengeRequest request) {
        return gameRepository.createChallenge(request);
    }

    public Map<String, Object> acceptChallenge(int challengeId, int userId) {
        return gameRepository.acceptChallenge(challengeId, userId);
    }

    public Map<String, Object> rejectChallenge(int challengeId, int userId) {
        return gameRepository.rejectChallenge(challengeId, userId);
    }

    public Map<String, Object> updateProgress(int matchId, MatchProgressRequest request) {
        return gameRepository.updateProgress(matchId, request);
    }

    public Map<String, Object> finishMatch(int matchId) {
        return gameRepository.finishMatch(matchId);
    }

    public Map<String, Object> saveSoloResult(SoloResultRequest request) {
        return gameRepository.saveSoloResult(request);
    }

    public Map<String, Object> forfeitMatch(int matchId, MatchProgressRequest request) {
        return gameRepository.forfeitMatch(matchId, request);
    }

    public List<Map<String, Object>> getChallengesForUser(int userId) {
        return gameRepository.getChallengesForUser(userId);
    }

    public List<Map<String, Object>> getOutgoingChallengesForUser(int userId) {
        return gameRepository.getOutgoingChallengesForUser(userId);
    }

    public Map<String, Object> getActiveMatchForUser(int userId) {
        return gameRepository.getActiveMatchForUser(userId);
    }

    public Map<String, Object> getMatchResult(int matchId, int userId) {
        return gameRepository.getMatchResult(matchId, userId);
    }

    public List<Map<String, Object>> getHistoryForUser(int userId) {
        return gameRepository.getHistoryForUser(userId);
    }

    public Map<String, Object> achievementsForUser(int userId) {
        return gameRepository.achievementsForUser(userId);
    }

    public Map<String, Object> submitTheme(ThemeSubmissionRequest request) {
        return gameRepository.submitTheme(request);
    }

    public List<Map<String, Object>> pendingThemeSubmissions() {
        return gameRepository.pendingThemeSubmissions();
    }

    public Map<String, Object> approveThemeSubmission(int id) {
        return gameRepository.approveThemeSubmission(id);
    }

    public Map<String, Object> approveThemeSubmission(int id, Map<String, Object> request) {
        return gameRepository.approveThemeSubmission(id, request);
    }

    public Map<String, Object> adminDashboard(int adminUserId) {
        return gameRepository.adminDashboard(adminUserId);
    }

    public Map<String, Object> createAdminTheme(Map<String, Object> request) {
        return gameRepository.createAdminTheme(request);
    }

    public Map<String, Object> updateAdminTheme(String id, Map<String, Object> request) {
        return gameRepository.updateAdminTheme(id, request);
    }

    public boolean deleteAdminTheme(int adminUserId, String id) {
        return gameRepository.deleteAdminTheme(adminUserId, id);
    }

    public Map<String, Object> createAdminWord(Map<String, Object> request) {
        return gameRepository.createAdminWord(request);
    }

    public Map<String, Object> updateAdminWord(int id, Map<String, Object> request) {
        return gameRepository.updateAdminWord(id, request);
    }

    public boolean deleteAdminWord(int adminUserId, int id) {
        return gameRepository.deleteAdminWord(adminUserId, id);
    }

    public Map<String, Object> rejectThemeSubmission(int id, Map<String, Object> request) {
        return gameRepository.rejectThemeSubmission(id, request);
    }
}
