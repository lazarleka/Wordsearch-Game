package com.example.ukrstenereci.models;

import java.util.ArrayList;
import java.util.List;

public class MatchProgressRequest {
    private int userId;
    private List<String> foundWords = new ArrayList<>();
    private int elapsedSeconds;
    private boolean finished;
    private int powerUpPenalty;
    private int points;

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }
    public List<String> getFoundWords() { return foundWords; }
    public void setFoundWords(List<String> foundWords) { this.foundWords = foundWords; }
    public int getElapsedSeconds() { return elapsedSeconds; }
    public void setElapsedSeconds(int elapsedSeconds) { this.elapsedSeconds = elapsedSeconds; }
    public boolean isFinished() { return finished; }
    public void setFinished(boolean finished) { this.finished = finished; }
    public int getPowerUpPenalty() { return powerUpPenalty; }
    public void setPowerUpPenalty(int powerUpPenalty) { this.powerUpPenalty = powerUpPenalty; }
    public int getPoints() { return points; }
    public void setPoints(int points) { this.points = points; }
}
