package com.example.ukrstenereci.models;

import java.util.ArrayList;
import java.util.List;

public class MatchProgressRequest {
    private int userId;
    private List<String> foundWords = new ArrayList<>();
    private int elapsedSeconds;
    private boolean finished;

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }
    public List<String> getFoundWords() { return foundWords; }
    public void setFoundWords(List<String> foundWords) { this.foundWords = foundWords; }
    public int getElapsedSeconds() { return elapsedSeconds; }
    public void setElapsedSeconds(int elapsedSeconds) { this.elapsedSeconds = elapsedSeconds; }
    public boolean isFinished() { return finished; }
    public void setFinished(boolean finished) { this.finished = finished; }
}
