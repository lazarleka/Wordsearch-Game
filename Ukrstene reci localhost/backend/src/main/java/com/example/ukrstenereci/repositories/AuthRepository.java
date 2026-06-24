package com.example.ukrstenereci.repositories;

import com.example.ukrstenereci.DBUtil;
import com.example.ukrstenereci.models.Korisnik;
import com.example.ukrstenereci.services.PasswordUtil;
import org.springframework.stereotype.Repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

@Repository
public class AuthRepository {
    private Korisnik mapRow(ResultSet rs) throws Exception {
        Korisnik k = new Korisnik();
        k.setID(rs.getInt("ID"));
        k.setKorisnickoIme(rs.getString("KorisnickoIme"));
        k.setIme(rs.getString("Ime"));
        k.setPrezime(rs.getString("Prezime"));
        k.setEmail(rs.getString("Email"));
        k.setAvatarBoja(rs.getString("AvatarBoja"));
        k.setUkupnoPobjeda(rs.getInt("UkupnoPobjeda"));
        k.setUkupnoPoraza(rs.getInt("UkupnoPoraza"));
        return k;
    }

    public Korisnik register(Korisnik korisnik) {
        try (Connection conn = DBUtil.open()) {
            String sql = "INSERT INTO korisnik (KorisnickoIme, Ime, Prezime, Email, LozinkaHash, AvatarBoja) VALUES (?, ?, ?, ?, ?, ?)";
            PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, korisnik.getKorisnickoIme().trim().toLowerCase());
            ps.setString(2, korisnik.getIme());
            ps.setString(3, korisnik.getPrezime());
            ps.setString(4, korisnik.getEmail().trim().toLowerCase());
            ps.setString(5, PasswordUtil.hash(korisnik.getLozinka()));
            ps.setString(6, korisnik.getAvatarBoja() != null ? korisnik.getAvatarBoja() : "#00e5b4");
            ps.executeUpdate();

            ResultSet keys = ps.getGeneratedKeys();
            if (keys.next()) return findById(keys.getInt(1));
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    public Korisnik login(String email, String password) {
        try (Connection conn = DBUtil.open()) {
            PreparedStatement ps = conn.prepareStatement("SELECT * FROM korisnik WHERE Email=?");
            ps.setString(1, email.trim().toLowerCase());
            ResultSet rs = ps.executeQuery();
            if (rs.next() && PasswordUtil.verify(password, rs.getString("LozinkaHash"))) {
                return mapRow(rs);
            }
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    public Korisnik findById(int id) {
        try (Connection conn = DBUtil.open()) {
            PreparedStatement ps = conn.prepareStatement("SELECT * FROM korisnik WHERE ID=?");
            ps.setInt(1, id);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) return mapRow(rs);
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    public List<Korisnik> search(String term) {
        List<Korisnik> result = new ArrayList<>();
        try (Connection conn = DBUtil.open()) {
            PreparedStatement ps = conn.prepareStatement("SELECT * FROM korisnik WHERE LOWER(KorisnickoIme) LIKE ? OR LOWER(Ime) LIKE ? OR LOWER(Email) LIKE ? ORDER BY KorisnickoIme LIMIT 25");
            String value = "%" + (term == null ? "" : term.toLowerCase()) + "%";
            ps.setString(1, value);
            ps.setString(2, value);
            ps.setString(3, value);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) result.add(mapRow(rs));
        } catch (Exception e) {
            System.out.println(e);
        }
        return result;
    }

    public List<Korisnik> leaderboard() {
        List<Korisnik> result = new ArrayList<>();
        try (Connection conn = DBUtil.open()) {
            PreparedStatement ps = conn.prepareStatement(
                    "SELECT k.*, " +
                    "COALESCE(v.UkupnoRijeci, 0) + COALESCE(s.UkupnoRijeci, 0) AS UkupnoPogodjenihRijeci, " +
                    "COALESCE(v.UkupnoPartija, 0) + COALESCE(s.UkupnoPartija, 0) AS UkupnoPartija, " +
                    "COALESCE(v.UkupnoBodova, 0) + COALESCE(s.UkupnoBodova, 0) AS UkupnoBodova " +
                    "FROM korisnik k " +
                    "LEFT JOIN (SELECT mi.Korisnik_ID, SUM(mi.BrojPronadjenih) UkupnoRijeci, COUNT(*) UkupnoPartija, SUM(mi.Bodovi) UkupnoBodova FROM mec_igrac mi JOIN mec m ON m.ID=mi.Mec_ID WHERE m.Status='zavrsen' GROUP BY mi.Korisnik_ID) v ON v.Korisnik_ID=k.ID " +
                    "LEFT JOIN (SELECT Korisnik_ID, SUM(BrojPronadjenih) UkupnoRijeci, COUNT(*) UkupnoPartija, SUM(Bodovi) UkupnoBodova FROM solo_rezultat GROUP BY Korisnik_ID) s ON s.Korisnik_ID=k.ID " +
                    "ORDER BY UkupnoBodova DESC, UkupnoPogodjenihRijeci DESC, k.KorisnickoIme ASC " +
                    "LIMIT 50");
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Korisnik korisnik = mapRow(rs);
                korisnik.setUkupnoPogodjenihRijeci(rs.getInt("UkupnoPogodjenihRijeci"));
                korisnik.setUkupnoPartija(rs.getInt("UkupnoPartija"));
                korisnik.setUkupnoBodova(rs.getInt("UkupnoBodova"));
                result.add(korisnik);
            }
        } catch (Exception e) {
            System.out.println(e);
        }
        return result;
    }
}
