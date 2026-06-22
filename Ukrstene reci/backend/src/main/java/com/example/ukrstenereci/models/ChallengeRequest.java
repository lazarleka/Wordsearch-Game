package com.example.ukrstenereci.models;

import java.util.ArrayList;
import java.util.List;

public class ChallengeRequest {
    private int challengerId;
    private int opponentId;
    private String themeId;
    private String difficultyId;
    private int wordCount;
    private int gridSize;
    private int timeLimitSeconds;
    private String customTheme;
    private List<String> words = new ArrayList<>();

    public int getChallengerId() { return challengerId; }
    public void setChallengerId(int challengerId) { this.challengerId = challengerId; }
    public int getOpponentId() { return opponentId; }
    public void setOpponentId(int opponentId) { this.opponentId = opponentId; }
    public String getThemeId() { return themeId; }
    public void setThemeId(String themeId) { this.themeId = themeId; }
    public String getDifficultyId() { return difficultyId; }
    public void setDifficultyId(String difficultyId) { this.difficultyId = difficultyId; }
    public int getWordCount() { return wordCount; }
    public void setWordCount(int wordCount) { this.wordCount = wordCount; }
    public int getGridSize() { return gridSize; }
    public void setGridSize(int gridSize) { this.gridSize = gridSize; }
    public int getTimeLimitSeconds() { return timeLimitSeconds; }
    public void setTimeLimitSeconds(int timeLimitSeconds) { this.timeLimitSeconds = timeLimitSeconds; }
    public String getCustomTheme() { return customTheme; }
    public void setCustomTheme(String customTheme) { this.customTheme = customTheme; }
    public List<String> getWords() { return words; }
    public void setWords(List<String> words) { this.words = words; }
}
