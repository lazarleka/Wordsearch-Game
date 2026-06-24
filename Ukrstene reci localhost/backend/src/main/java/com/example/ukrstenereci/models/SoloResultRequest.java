package com.example.ukrstenereci.models;

public class SoloResultRequest {
    private int userId;
    private String themeName;
    private String difficultyId;
    private int foundCount;
    private int totalWords;
    private int elapsedSeconds;
    private int powerUpPenalty;
    private int points;

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }
    public String getThemeName() { return themeName; }
    public void setThemeName(String themeName) { this.themeName = themeName; }
    public String getDifficultyId() { return difficultyId; }
    public void setDifficultyId(String difficultyId) { this.difficultyId = difficultyId; }
    public int getFoundCount() { return foundCount; }
    public void setFoundCount(int foundCount) { this.foundCount = foundCount; }
    public int getTotalWords() { return totalWords; }
    public void setTotalWords(int totalWords) { this.totalWords = totalWords; }
    public int getElapsedSeconds() { return elapsedSeconds; }
    public void setElapsedSeconds(int elapsedSeconds) { this.elapsedSeconds = elapsedSeconds; }
    public int getPowerUpPenalty() { return powerUpPenalty; }
    public void setPowerUpPenalty(int powerUpPenalty) { this.powerUpPenalty = powerUpPenalty; }
    public int getPoints() { return points; }
    public void setPoints(int points) { this.points = points; }
}
