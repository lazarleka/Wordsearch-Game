package com.example.ukrstenereci.models;

public class Korisnik {
    private int ID;
    private String korisnickoIme;
    private String ime;
    private String prezime;
    private String email;
    private String lozinka;
    private String avatarBoja;
    private int ukupnoPobjeda;
    private int ukupnoPoraza;
    private int ukupnoPogodjenihRijeci;
    private int ukupnoPartija;

    public Korisnik() {}

    public int getID() { return ID; }
    public void setID(int ID) { this.ID = ID; }
    public String getKorisnickoIme() { return korisnickoIme; }
    public void setKorisnickoIme(String korisnickoIme) { this.korisnickoIme = korisnickoIme; }
    public String getIme() { return ime; }
    public void setIme(String ime) { this.ime = ime; }
    public String getPrezime() { return prezime; }
    public void setPrezime(String prezime) { this.prezime = prezime; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getLozinka() { return lozinka; }
    public void setLozinka(String lozinka) { this.lozinka = lozinka; }
    public String getAvatarBoja() { return avatarBoja; }
    public void setAvatarBoja(String avatarBoja) { this.avatarBoja = avatarBoja; }
    public int getUkupnoPobjeda() { return ukupnoPobjeda; }
    public void setUkupnoPobjeda(int ukupnoPobjeda) { this.ukupnoPobjeda = ukupnoPobjeda; }
    public int getUkupnoPoraza() { return ukupnoPoraza; }
    public void setUkupnoPoraza(int ukupnoPoraza) { this.ukupnoPoraza = ukupnoPoraza; }
    public int getUkupnoPogodjenihRijeci() { return ukupnoPogodjenihRijeci; }
    public void setUkupnoPogodjenihRijeci(int ukupnoPogodjenihRijeci) { this.ukupnoPogodjenihRijeci = ukupnoPogodjenihRijeci; }
    public int getUkupnoPartija() { return ukupnoPartija; }
    public void setUkupnoPartija(int ukupnoPartija) { this.ukupnoPartija = ukupnoPartija; }
}
