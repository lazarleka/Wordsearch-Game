package com.example.ukrstenereci.models;

public class Tema {
    private String id;
    private String label;
    private boolean isBuiltin;
    private int wordCount;

    public Tema() {}

    public Tema(String id, String label, boolean isBuiltin, int wordCount) {
        this.id = id;
        this.label = label;
        this.isBuiltin = isBuiltin;
        this.wordCount = wordCount;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public boolean getIsBuiltin() { return isBuiltin; }
    public void setIsBuiltin(boolean builtin) { isBuiltin = builtin; }
    public int getWordCount() { return wordCount; }
    public void setWordCount(int wordCount) { this.wordCount = wordCount; }
}
