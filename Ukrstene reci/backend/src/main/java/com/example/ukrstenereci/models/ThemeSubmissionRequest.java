package com.example.ukrstenereci.models;

import java.util.ArrayList;
import java.util.List;

public class ThemeSubmissionRequest {
    private int userId;
    private String label;
    private List<String> words = new ArrayList<>();

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public List<String> getWords() { return words; }
    public void setWords(List<String> words) { this.words = words; }
}
