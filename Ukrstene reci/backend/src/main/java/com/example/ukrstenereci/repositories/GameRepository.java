package com.example.ukrstenereci.repositories;

import com.example.ukrstenereci.DBUtil;
import com.example.ukrstenereci.LiveSocketHandler;
import com.example.ukrstenereci.models.ChallengeRequest;
import com.example.ukrstenereci.models.Korisnik;
import com.example.ukrstenereci.models.MatchProgressRequest;
import com.example.ukrstenereci.models.Tema;
import com.example.ukrstenereci.models.ThemeSubmissionRequest;
import org.springframework.stereotype.Repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Repository
public class GameRepository {
    private final AuthRepository authRepository;

    public GameRepository(AuthRepository authRepository) {
        this.authRepository = authRepository;
    }

    public List<Tema> getThemes() {
        List<Tema> result = new ArrayList<>();
        try (Connection conn = DBUtil.open()) {
            PreparedStatement ps = conn.prepareStatement("SELECT t.ID, t.Naziv, t.Staticka, COUNT(r.ID) AS BrojRijeci FROM tema t LEFT JOIN tema_rijec r ON r.Tema_ID=t.ID GROUP BY t.ID, t.Naziv, t.Staticka ORDER BY t.Staticka DESC, t.Naziv ASC");
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                result.add(new Tema(rs.getString("ID"), rs.getString("Naziv"), rs.getBoolean("Staticka"), rs.getInt("BrojRijeci")));
            }
        } catch (Exception e) {
            System.out.println(e);
        }
        return result;
    }

    public List<String> getWords(String themeId, int count) {
        List<String> result = new ArrayList<>();
        try (Connection conn = DBUtil.open()) {
            PreparedStatement ps = conn.prepareStatement("SELECT Rijec FROM tema_rijec WHERE Tema_ID=? ORDER BY RAND() LIMIT ?");
            ps.setString(1, themeId);
            ps.setInt(2, Math.max(1, Math.min(count, 20)));
            ResultSet rs = ps.executeQuery();
            while (rs.next()) result.add(rs.getString("Rijec"));
        } catch (Exception e) {
            System.out.println(e);
        }
        return result;
    }

    public Map<String, Object> sendFriendRequest(int fromUserId, int toUserId) {
        try (Connection conn = DBUtil.open()) {
            PreparedStatement existing = conn.prepareStatement("SELECT * FROM prijateljstvo WHERE (Posiljalac_ID=? AND Primalac_ID=?) OR (Posiljalac_ID=? AND Primalac_ID=?)");
            existing.setInt(1, fromUserId);
            existing.setInt(2, toUserId);
            existing.setInt(3, toUserId);
            existing.setInt(4, fromUserId);
            ResultSet found = existing.executeQuery();
            if (found.next()) return rowToMap(found);

            PreparedStatement ps = conn.prepareStatement("INSERT INTO prijateljstvo (Posiljalac_ID, Primalac_ID, Status) VALUES (?, ?, 'na_cekanju')", Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, fromUserId);
            ps.setInt(2, toUserId);
            ps.executeUpdate();
            Map<String, Object> friendship = getById(conn, "prijateljstvo", ps);
            LiveSocketHandler.broadcast("friend_request_created", mapToJson(friendship));
            return friendship;
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    public Map<String, Object> acceptFriend(int friendshipId) {
        try (Connection conn = DBUtil.open()) {
            PreparedStatement ps = conn.prepareStatement("UPDATE prijateljstvo SET Status='prihvaceno' WHERE ID=?");
            ps.setInt(1, friendshipId);
            ps.executeUpdate();
            PreparedStatement select = conn.prepareStatement("SELECT * FROM prijateljstvo WHERE ID=?");
            select.setInt(1, friendshipId);
            ResultSet rs = select.executeQuery();
            if (rs.next()) {
                Map<String, Object> friendship = rowToMap(rs);
                LiveSocketHandler.broadcast("friend_request_accepted", mapToJson(friendship));
                return friendship;
            }
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    public List<Korisnik> getFriends(int userId) {
        List<Korisnik> result = new ArrayList<>();
        try (Connection conn = DBUtil.open()) {
            PreparedStatement ps = conn.prepareStatement("SELECT CASE WHEN Posiljalac_ID=? THEN Primalac_ID ELSE Posiljalac_ID END AS Friend_ID FROM prijateljstvo WHERE Status='prihvaceno' AND (Posiljalac_ID=? OR Primalac_ID=?)");
            ps.setInt(1, userId);
            ps.setInt(2, userId);
            ps.setInt(3, userId);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Korisnik k = authRepository.findById(rs.getInt("Friend_ID"));
                if (k != null) result.add(k);
            }
        } catch (Exception e) {
            System.out.println(e);
        }
        return result;
    }

    public List<Map<String, Object>> getFriendships(int userId) {
        List<Map<String, Object>> result = new ArrayList<>();
        try (Connection conn = DBUtil.open()) {
            PreparedStatement ps = conn.prepareStatement(
                    "SELECT f.*, " +
                    "CASE WHEN f.Posiljalac_ID=? THEN f.Primalac_ID ELSE f.Posiljalac_ID END AS DrugiKorisnik_ID, " +
                    "k.KorisnickoIme AS DrugiKorisnickoIme, k.Ime AS DrugiIme " +
                    "FROM prijateljstvo f " +
                    "JOIN korisnik k ON k.ID=CASE WHEN f.Posiljalac_ID=? THEN f.Primalac_ID ELSE f.Posiljalac_ID END " +
                    "WHERE f.Posiljalac_ID=? OR f.Primalac_ID=? " +
                    "ORDER BY f.Azurirano DESC");
            ps.setInt(1, userId);
            ps.setInt(2, userId);
            ps.setInt(3, userId);
            ps.setInt(4, userId);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) result.add(rowToMap(rs));
        } catch (Exception e) {
            System.out.println(e);
        }
        return result;
    }

    public Map<String, Object> createChallenge(ChallengeRequest request) {
        try (Connection conn = DBUtil.open()) {
            if (!areFriends(conn, request.getChallengerId(), request.getOpponentId())) return null;
            expireChallenges(conn);
            if (hasActiveMatch(conn, request.getChallengerId()) || hasActiveMatch(conn, request.getOpponentId())) return null;

            PreparedStatement existingPs = conn.prepareStatement(
                    "SELECT i.*, COALESCE(t.Naziv, i.CustomTema) AS TemaNaziv, k.KorisnickoIme AS ProtivnikIme " +
                    "FROM izazov i LEFT JOIN tema t ON t.ID=i.Tema_ID JOIN korisnik k ON k.ID=i.Protivnik_ID " +
                    "WHERE i.Izazivac_ID=? AND i.Protivnik_ID=? AND i.Status='na_cekanju' ORDER BY i.Kreiran DESC LIMIT 1");
            existingPs.setInt(1, request.getChallengerId());
            existingPs.setInt(2, request.getOpponentId());
            ResultSet existingRs = existingPs.executeQuery();
            if (existingRs.next()) return rowToMap(existingRs);

            Set<String> words = cleanWords(request.getWords());
            if (words.isEmpty() && request.getThemeId() != null && !request.getThemeId().isBlank()) {
                PreparedStatement wordPs = conn.prepareStatement("SELECT Rijec FROM tema_rijec WHERE Tema_ID=? ORDER BY RAND() LIMIT ?");
                wordPs.setString(1, request.getThemeId());
                wordPs.setInt(2, request.getWordCount());
                ResultSet wordRs = wordPs.executeQuery();
                while (wordRs.next()) words.add(wordRs.getString("Rijec"));
            }
            if (words.isEmpty()) return null;

            PreparedStatement ps = conn.prepareStatement("INSERT INTO izazov (Izazivac_ID, Protivnik_ID, Tema_ID, CustomTema, RijeciJson, Tezina, BrojRijeci, VelicinaMatrice, VremenskoOgranicenjeSekundi, Status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'na_cekanju')", Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, request.getChallengerId());
            ps.setInt(2, request.getOpponentId());
            if (request.getThemeId() == null || request.getThemeId().isBlank()) ps.setNull(3, java.sql.Types.VARCHAR);
            else ps.setString(3, request.getThemeId());
            ps.setString(4, request.getCustomTheme());
            ps.setString(5, toJson(words));
            ps.setString(6, request.getDifficultyId());
            ps.setInt(7, words.size());
            ps.setInt(8, request.getGridSize());
            ps.setInt(9, 300);
            ps.executeUpdate();
            ResultSet keys = ps.getGeneratedKeys();
            if (!keys.next()) return null;
            PreparedStatement createdPs = conn.prepareStatement(
                    "SELECT i.*, COALESCE(t.Naziv, i.CustomTema) AS TemaNaziv, " +
                    "izazivac.KorisnickoIme AS IzazivacIme, protivnik.KorisnickoIme AS ProtivnikIme " +
                    "FROM izazov i LEFT JOIN tema t ON t.ID=i.Tema_ID " +
                    "JOIN korisnik izazivac ON izazivac.ID=i.Izazivac_ID " +
                    "JOIN korisnik protivnik ON protivnik.ID=i.Protivnik_ID WHERE i.ID=?");
            createdPs.setInt(1, keys.getInt(1));
            ResultSet createdRs = createdPs.executeQuery();
            if (!createdRs.next()) return null;
            Map<String, Object> challenge = rowToMap(createdRs);
            LiveSocketHandler.broadcast("challenge_created", mapToJson(challenge));
            return challenge;
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    public Map<String, Object> rejectChallenge(int challengeId, int userId) {
        try (Connection conn = DBUtil.open()) {
            expireChallenges(conn);
            PreparedStatement update = conn.prepareStatement(
                    "UPDATE izazov SET Status='odbijen', Odgovoren=NOW() " +
                    "WHERE ID=? AND Protivnik_ID=? AND Status='na_cekanju'");
            update.setInt(1, challengeId);
            update.setInt(2, userId);
            if (update.executeUpdate() == 0) return null;

            Map<String, Object> result = new HashMap<>();
            result.put("challengeId", challengeId);
            result.put("opponentId", userId);
            LiveSocketHandler.broadcast("challenge_rejected", mapToJson(result));
            return result;
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    public Map<String, Object> acceptChallenge(int challengeId, int userId) {
        try (Connection conn = DBUtil.open()) {
            expireChallenges(conn);
            conn.setAutoCommit(false);
            PreparedStatement select = conn.prepareStatement(
                    "SELECT * FROM izazov WHERE ID=? AND Protivnik_ID=? AND Status='na_cekanju' " +
                    "AND Kreiran >= NOW() - INTERVAL 10 SECOND FOR UPDATE");
            select.setInt(1, challengeId);
            select.setInt(2, userId);
            ResultSet challenge = select.executeQuery();
            if (!challenge.next()) {
                conn.rollback();
                return null;
            }
            if (hasActiveMatch(conn, challenge.getInt("Izazivac_ID")) || hasActiveMatch(conn, challenge.getInt("Protivnik_ID"))) {
                conn.rollback();
                return null;
            }

            PreparedStatement update = conn.prepareStatement("UPDATE izazov SET Status='prihvacen', Odgovoren=NOW() WHERE ID=?");
            update.setInt(1, challengeId);
            update.executeUpdate();

            PreparedStatement insertMatch = conn.prepareStatement("INSERT INTO mec (Izazov_ID, Tema_ID, CustomTema, RijeciJson, Tezina, BrojRijeci, VelicinaMatrice, VremenskoOgranicenjeSekundi, Status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktivan')", Statement.RETURN_GENERATED_KEYS);
            insertMatch.setInt(1, challenge.getInt("ID"));
            if (challenge.getString("Tema_ID") == null) insertMatch.setNull(2, java.sql.Types.VARCHAR);
            else insertMatch.setString(2, challenge.getString("Tema_ID"));
            insertMatch.setString(3, challenge.getString("CustomTema"));
            insertMatch.setString(4, challenge.getString("RijeciJson"));
            insertMatch.setString(5, challenge.getString("Tezina"));
            insertMatch.setInt(6, challenge.getInt("BrojRijeci"));
            insertMatch.setInt(7, challenge.getInt("VelicinaMatrice"));
            insertMatch.setInt(8, challenge.getInt("VremenskoOgranicenjeSekundi"));
            insertMatch.executeUpdate();
            ResultSet keys = insertMatch.getGeneratedKeys();
            keys.next();
            int matchId = keys.getInt(1);

            insertMatchPlayer(conn, matchId, challenge.getInt("Izazivac_ID"));
            insertMatchPlayer(conn, matchId, challenge.getInt("Protivnik_ID"));
            PreparedStatement cancelOthers = conn.prepareStatement(
                    "UPDATE izazov SET Status='otkazan', Odgovoren=NOW() WHERE ID<>? AND Status='na_cekanju' AND " +
                    "(Izazivac_ID IN (?, ?) OR Protivnik_ID IN (?, ?))");
            cancelOthers.setInt(1, challengeId);
            cancelOthers.setInt(2, challenge.getInt("Izazivac_ID"));
            cancelOthers.setInt(3, challenge.getInt("Protivnik_ID"));
            cancelOthers.setInt(4, challenge.getInt("Izazivac_ID"));
            cancelOthers.setInt(5, challenge.getInt("Protivnik_ID"));
            cancelOthers.executeUpdate();
            conn.commit();

            PreparedStatement matchSelect = conn.prepareStatement(
                    "SELECT m.*, i.Izazivac_ID, i.Protivnik_ID, COALESCE(t.Naziv, m.CustomTema) AS TemaNaziv, 0 AS ProtekloSekundi " +
                    "FROM mec m JOIN izazov i ON i.ID=m.Izazov_ID LEFT JOIN tema t ON t.ID=m.Tema_ID WHERE m.ID=?");
            matchSelect.setInt(1, matchId);
            ResultSet match = matchSelect.executeQuery();
            if (match.next()) {
                Map<String, Object> accepted = rowToMap(match);
                LiveSocketHandler.broadcast("challenge_accepted", mapToJson(accepted));
                return accepted;
            }
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    public Map<String, Object> updateProgress(int matchId, MatchProgressRequest request) {
        try (Connection conn = DBUtil.open()) {
            PreparedStatement matchPs = conn.prepareStatement(
                    "SELECT Status, Pobjednik_ID, RijeciJson, BrojRijeci, " +
                    "LEAST(VremenskoOgranicenjeSekundi, TIMESTAMPDIFF(SECOND, Zapocet, NOW())) AS Proteklo " +
                    "FROM mec WHERE ID=?");
            matchPs.setInt(1, matchId);
            ResultSet match = matchPs.executeQuery();
            if (!match.next()) return null;
            if ("zavrsen".equals(match.getString("Status"))) return buildFinishedResult(conn, matchId);

            Set<String> allowedWords = new LinkedHashSet<>(parseSimpleJsonArray(match.getString("RijeciJson")));
            Set<String> words = cleanWords(request.getFoundWords());
            words.retainAll(allowedWords);
            int elapsedSeconds = Math.max(0, match.getInt("Proteklo"));

            PreparedStatement ps = conn.prepareStatement("UPDATE mec_igrac SET PronadjeneRijeciJson=?, BrojPronadjenih=?, VrijemeSekundi=?, Zavrsio=? WHERE Mec_ID=? AND Korisnik_ID=?");
            ps.setString(1, toJson(words));
            ps.setInt(2, words.size());
            ps.setInt(3, elapsedSeconds);
            ps.setBoolean(4, request.isFinished());
            ps.setInt(5, matchId);
            ps.setInt(6, request.getUserId());
            if (ps.executeUpdate() == 0) return null;

            if (words.size() >= match.getInt("BrojRijeci")) {
                return finishMatch(matchId);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("ok", true);
            result.put("foundCount", words.size());
            result.put("elapsedSeconds", elapsedSeconds);
            result.put("matchId", matchId);
            result.put("userId", request.getUserId());
            LiveSocketHandler.broadcast("match_progress", mapToJson(result));
            return result;
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    public Map<String, Object> finishMatch(int matchId) {
        try (Connection conn = DBUtil.open()) {
            PreparedStatement statusPs = conn.prepareStatement(
                    "SELECT Status, Pobjednik_ID, BrojRijeci, VremenskoOgranicenjeSekundi, " +
                    "TIMESTAMPDIFF(SECOND, Zapocet, NOW()) AS Proteklo FROM mec WHERE ID=?");
            statusPs.setInt(1, matchId);
            ResultSet statusRs = statusPs.executeQuery();
            if (!statusRs.next()) return null;
            if ("zavrsen".equals(statusRs.getString("Status"))) {
                return buildFinishedResult(conn, matchId);
            }

            PreparedStatement playersPs = conn.prepareStatement("SELECT * FROM mec_igrac WHERE Mec_ID=? ORDER BY BrojPronadjenih DESC, VrijemeSekundi ASC");
            playersPs.setInt(1, matchId);
            ResultSet players = playersPs.executeQuery();
            List<Map<String, Object>> list = new ArrayList<>();
            while (players.next()) list.add(rowToMap(players));
            if (list.size() < 2) return null;

            Integer winner = null;
            int first = ((Number) list.get(0).get("BrojPronadjenih")).intValue();
            int second = ((Number) list.get(1).get("BrojPronadjenih")).intValue();
            boolean completedAll = first >= statusRs.getInt("BrojRijeci");
            boolean timeExpired = statusRs.getInt("Proteklo") >= statusRs.getInt("VremenskoOgranicenjeSekundi");
            if (!completedAll && !timeExpired) return null;
            if (first != second) winner = ((Number) list.get(0).get("Korisnik_ID")).intValue();

            PreparedStatement update = conn.prepareStatement("UPDATE mec SET Status='zavrsen', Pobjednik_ID=?, RazlogZavrsetka=?, Zavrsen=NOW() WHERE ID=? AND Status='aktivan'");
            if (winner == null) update.setNull(1, java.sql.Types.INTEGER);
            else update.setInt(1, winner);
            update.setString(2, completedAll ? "sve_rijeci" : "vrijeme");
            update.setInt(3, matchId);
            if (update.executeUpdate() == 0) return buildFinishedResult(conn, matchId);

            updateStats(conn, list, winner);
            Map<String, Object> result = buildFinishedResult(conn, matchId);
            LiveSocketHandler.broadcast("match_finished", mapToJson(result));
            return result;
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    public Map<String, Object> forfeitMatch(int matchId, MatchProgressRequest request) {
        try (Connection conn = DBUtil.open()) {
            conn.setAutoCommit(false);
            PreparedStatement matchPs = conn.prepareStatement(
                    "SELECT m.Status, m.RijeciJson, LEAST(m.VremenskoOgranicenjeSekundi, TIMESTAMPDIFF(SECOND, m.Zapocet, NOW())) AS Proteklo " +
                    "FROM mec m JOIN mec_igrac mi ON mi.Mec_ID=m.ID WHERE m.ID=? AND mi.Korisnik_ID=? FOR UPDATE");
            matchPs.setInt(1, matchId);
            matchPs.setInt(2, request.getUserId());
            ResultSet match = matchPs.executeQuery();
            if (!match.next()) {
                conn.rollback();
                return null;
            }
            if ("zavrsen".equals(match.getString("Status"))) {
                conn.rollback();
                return buildFinishedResult(conn, matchId);
            }

            Set<String> allowedWords = new LinkedHashSet<>(parseSimpleJsonArray(match.getString("RijeciJson")));
            Set<String> words = cleanWords(request.getFoundWords());
            words.retainAll(allowedWords);
            PreparedStatement save = conn.prepareStatement(
                    "UPDATE mec_igrac SET PronadjeneRijeciJson=?, BrojPronadjenih=?, VrijemeSekundi=?, Zavrsio=1 WHERE Mec_ID=? AND Korisnik_ID=?");
            save.setString(1, toJson(words));
            save.setInt(2, words.size());
            save.setInt(3, Math.max(0, match.getInt("Proteklo")));
            save.setInt(4, matchId);
            save.setInt(5, request.getUserId());
            save.executeUpdate();

            PreparedStatement opponentPs = conn.prepareStatement(
                    "SELECT Korisnik_ID FROM mec_igrac WHERE Mec_ID=? AND Korisnik_ID<>?");
            opponentPs.setInt(1, matchId);
            opponentPs.setInt(2, request.getUserId());
            ResultSet opponentRs = opponentPs.executeQuery();
            if (!opponentRs.next()) {
                conn.rollback();
                return null;
            }
            int winnerId = opponentRs.getInt("Korisnik_ID");

            PreparedStatement finish = conn.prepareStatement(
                    "UPDATE mec SET Status='zavrsen', Pobjednik_ID=?, RazlogZavrsetka='predaja', Napustio_ID=?, Zavrsen=NOW() WHERE ID=? AND Status='aktivan'");
            finish.setInt(1, winnerId);
            finish.setInt(2, request.getUserId());
            finish.setInt(3, matchId);
            if (finish.executeUpdate() == 0) {
                conn.rollback();
                return buildFinishedResult(conn, matchId);
            }

            List<Map<String, Object>> players = getMatchPlayers(conn, matchId);
            updateStats(conn, players, winnerId);
            conn.commit();
            Map<String, Object> result = buildFinishedResult(conn, matchId);
            LiveSocketHandler.broadcast("match_finished", mapToJson(result));
            return result;
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    public List<Map<String, Object>> getChallengesForUser(int userId) {
        List<Map<String, Object>> result = new ArrayList<>();
        try (Connection conn = DBUtil.open()) {
            expireChallenges(conn);
            PreparedStatement ps = conn.prepareStatement(
                    "SELECT i.*, COALESCE(t.Naziv, i.CustomTema) AS TemaNaziv, k.KorisnickoIme AS IzazivacIme " +
                    "FROM izazov i LEFT JOIN tema t ON t.ID=i.Tema_ID JOIN korisnik k ON k.ID=i.Izazivac_ID " +
                    "WHERE i.Protivnik_ID=? AND i.Status='na_cekanju' ORDER BY i.Kreiran DESC");
            ps.setInt(1, userId);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) result.add(rowToMap(rs));
        } catch (Exception e) {
            System.out.println(e);
        }
        return result;
    }

    public List<Map<String, Object>> getOutgoingChallengesForUser(int userId) {
        List<Map<String, Object>> result = new ArrayList<>();
        try (Connection conn = DBUtil.open()) {
            expireChallenges(conn);
            PreparedStatement ps = conn.prepareStatement(
                    "SELECT i.*, COALESCE(t.Naziv, i.CustomTema) AS TemaNaziv, k.KorisnickoIme AS ProtivnikIme " +
                    "FROM izazov i LEFT JOIN tema t ON t.ID=i.Tema_ID JOIN korisnik k ON k.ID=i.Protivnik_ID " +
                    "WHERE i.Izazivac_ID=? AND i.Status='na_cekanju' ORDER BY i.Kreiran DESC");
            ps.setInt(1, userId);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) result.add(rowToMap(rs));
        } catch (Exception e) {
            System.out.println(e);
        }
        return result;
    }

    public Map<String, Object> getActiveMatchForUser(int userId) {
        try (Connection conn = DBUtil.open()) {
            PreparedStatement ps = conn.prepareStatement(
                    "SELECT m.*, i.Izazivac_ID, i.Protivnik_ID, COALESCE(t.Naziv, m.CustomTema) AS TemaNaziv, " +
                    "CASE WHEN i.Izazivac_ID=? THEN protivnik.KorisnickoIme ELSE izazivac.KorisnickoIme END AS ProtivnikIme, " +
                    "moj.PronadjeneRijeciJson AS MojeRijeciJson, moj.BrojPronadjenih AS MojBrojPronadjenih, " +
                    "drugi.BrojPronadjenih AS ProtivnikBrojPronadjenih, " +
                    "LEAST(m.VremenskoOgranicenjeSekundi, TIMESTAMPDIFF(SECOND, m.Zapocet, NOW())) AS ProtekloSekundi " +
                    "FROM mec m JOIN izazov i ON i.ID=m.Izazov_ID " +
                    "JOIN korisnik izazivac ON izazivac.ID=i.Izazivac_ID " +
                    "JOIN korisnik protivnik ON protivnik.ID=i.Protivnik_ID " +
                    "JOIN mec_igrac moj ON moj.Mec_ID=m.ID AND moj.Korisnik_ID=? " +
                    "JOIN mec_igrac drugi ON drugi.Mec_ID=m.ID AND drugi.Korisnik_ID<>? " +
                    "LEFT JOIN tema t ON t.ID=m.Tema_ID " +
                    "WHERE m.Status='aktivan' AND (i.Izazivac_ID=? OR i.Protivnik_ID=?) " +
                    "ORDER BY m.Zapocet DESC LIMIT 1");
            ps.setInt(1, userId);
            ps.setInt(2, userId);
            ps.setInt(3, userId);
            ps.setInt(4, userId);
            ps.setInt(5, userId);
            ResultSet rs = ps.executeQuery();
            return rs.next() ? rowToMap(rs) : null;
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    public Map<String, Object> getMatchResult(int matchId, int userId) {
        try (Connection conn = DBUtil.open()) {
            PreparedStatement allowed = conn.prepareStatement(
                    "SELECT 1 FROM mec_igrac WHERE Mec_ID=? AND Korisnik_ID=?");
            allowed.setInt(1, matchId);
            allowed.setInt(2, userId);
            if (!allowed.executeQuery().next()) return null;
            return buildFinishedResult(conn, matchId);
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    public List<Map<String, Object>> getHistoryForUser(int userId) {
        List<Map<String, Object>> result = new ArrayList<>();
        try (Connection conn = DBUtil.open()) {
            PreparedStatement ps = conn.prepareStatement(
                    "SELECT m.*, COALESCE(t.Naziv, m.CustomTema) AS TemaNaziv, mi.BrojPronadjenih, mi.VrijemeSekundi, " +
                    "p.KorisnickoIme AS PobjednikIme, " +
                    "CASE WHEN i.Izazivac_ID=? THEN protivnik.KorisnickoIme ELSE izazivac.KorisnickoIme END AS ProtivnikIme " +
                    "FROM mec m JOIN izazov i ON i.ID=m.Izazov_ID " +
                    "JOIN korisnik izazivac ON izazivac.ID=i.Izazivac_ID " +
                    "JOIN korisnik protivnik ON protivnik.ID=i.Protivnik_ID " +
                    "JOIN mec_igrac mi ON mi.Mec_ID=m.ID LEFT JOIN tema t ON t.ID=m.Tema_ID " +
                    "LEFT JOIN korisnik p ON p.ID=m.Pobjednik_ID " +
                    "WHERE mi.Korisnik_ID=? AND m.Status='zavrsen' ORDER BY m.Zavrsen DESC LIMIT 30");
            ps.setInt(1, userId);
            ps.setInt(2, userId);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) result.add(rowToMap(rs));
        } catch (Exception e) {
            System.out.println(e);
        }
        return result;
    }

    public Map<String, Object> achievementsForUser(int userId) {
        Map<String, Object> result = new HashMap<>();
        try (Connection conn = DBUtil.open()) {
            PreparedStatement stats = conn.prepareStatement(
                    "SELECT k.UkupnoPobjeda, k.UkupnoPoraza, COUNT(mi.ID) AS UkupnoMeceva, COALESCE(MAX(mi.BrojPronadjenih),0) AS NajviseRijeci " +
                    "FROM korisnik k LEFT JOIN mec_igrac mi ON mi.Korisnik_ID=k.ID WHERE k.ID=? GROUP BY k.ID");
            stats.setInt(1, userId);
            ResultSet rs = stats.executeQuery();
            int wins = 0, matches = 0, best = 0;
            if (rs.next()) {
                wins = rs.getInt("UkupnoPobjeda");
                matches = rs.getInt("UkupnoMeceva");
                best = rs.getInt("NajviseRijeci");
            }
            result.put("wins", wins);
            result.put("matches", matches);
            result.put("bestWords", best);
            result.put("achievements", List.of(
                    achievement("Prvi meč", matches >= 1, "Odigraj prvi multiplayer meč"),
                    achievement("Lovac na riječi", best >= 6, "Pronađi 6 riječi u jednom meču"),
                    achievement("Prva pobjeda", wins >= 1, "Pobijedi prijatelja"),
                    achievement("Serijski igrač", matches >= 5, "Odigraj 5 mečeva"),
                    achievement("Šampion", wins >= 10, "Skupi 10 pobjeda")
            ));
        } catch (Exception e) {
            System.out.println(e);
        }
        return result;
    }

    public Map<String, Object> submitTheme(ThemeSubmissionRequest request) {
        try (Connection conn = DBUtil.open()) {
            Set<String> words = cleanWords(request.getWords());
            PreparedStatement ps = conn.prepareStatement("INSERT INTO tema_predlog (Naziv, RijeciJson, PredlozioKorisnik_ID) VALUES (?, ?, ?)", Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, request.getLabel());
            ps.setString(2, toJson(words));
            ps.setInt(3, request.getUserId());
            ps.executeUpdate();
            return getById(conn, "tema_predlog", ps);
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    public List<Map<String, Object>> pendingThemeSubmissions() {
        List<Map<String, Object>> result = new ArrayList<>();
        try (Connection conn = DBUtil.open()) {
            PreparedStatement ps = conn.prepareStatement("SELECT tp.*, k.KorisnickoIme FROM tema_predlog tp JOIN korisnik k ON k.ID=tp.PredlozioKorisnik_ID WHERE tp.Status='na_cekanju' ORDER BY tp.Kreirana DESC");
            ResultSet rs = ps.executeQuery();
            while (rs.next()) result.add(rowToMap(rs));
        } catch (Exception e) {
            System.out.println(e);
        }
        return result;
    }

    public Map<String, Object> approveThemeSubmission(int id) {
        try (Connection conn = DBUtil.open()) {
            conn.setAutoCommit(false);
            PreparedStatement select = conn.prepareStatement("SELECT * FROM tema_predlog WHERE ID=? AND Status='na_cekanju'");
            select.setInt(1, id);
            ResultSet rs = select.executeQuery();
            if (!rs.next()) {
                conn.rollback();
                return null;
            }

            String label = rs.getString("Naziv");
            String themeId = label.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
            if (themeId.isBlank()) themeId = "tema-" + id;

            PreparedStatement insertTheme = conn.prepareStatement("INSERT INTO tema (ID, Naziv, Staticka, KreiraoKorisnik_ID) VALUES (?, ?, 0, ?) ON DUPLICATE KEY UPDATE Naziv=VALUES(Naziv)");
            insertTheme.setString(1, themeId);
            insertTheme.setString(2, label);
            insertTheme.setInt(3, rs.getInt("PredlozioKorisnik_ID"));
            insertTheme.executeUpdate();

            for (String word : parseSimpleJsonArray(rs.getString("RijeciJson"))) {
                PreparedStatement insertWord = conn.prepareStatement("INSERT IGNORE INTO tema_rijec (Tema_ID, Rijec) VALUES (?, ?)");
                insertWord.setString(1, themeId);
                insertWord.setString(2, word);
                insertWord.executeUpdate();
            }

            PreparedStatement update = conn.prepareStatement("UPDATE tema_predlog SET Status='odobrena', Odgovorena=NOW() WHERE ID=?");
            update.setInt(1, id);
            update.executeUpdate();
            conn.commit();
            Map<String, Object> result = new HashMap<>();
            result.put("themeId", themeId);
            result.put("label", label);
            return result;
        } catch (Exception e) {
            System.out.println(e);
        }
        return null;
    }

    private Map<String, Object> achievement(String title, boolean unlocked, String description) {
        Map<String, Object> map = new HashMap<>();
        map.put("title", title);
        map.put("unlocked", unlocked);
        map.put("description", description);
        return map;
    }

    private Set<String> cleanWords(List<String> rawWords) {
        Set<String> words = new LinkedHashSet<>();
        if (rawWords == null) return words;
        for (String word : rawWords) {
            String clean = word == null ? "" : word.toUpperCase().replaceAll("[^A-Z]", "");
            if (clean.length() >= 3 && clean.length() <= 16) words.add(clean);
        }
        return words;
    }

    private List<String> parseSimpleJsonArray(String json) {
        List<String> result = new ArrayList<>();
        if (json == null) return result;
        for (String part : json.replace("[", "").replace("]", "").replace("\"", "").split(",")) {
            String clean = part.trim().toUpperCase().replaceAll("[^A-Z]", "");
            if (!clean.isBlank()) result.add(clean);
        }
        return result;
    }

    private String mapToJson(Map<String, Object> map) {
        if (map == null) return "{}";
        List<String> pairs = new ArrayList<>();
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            Object value = entry.getValue();
            String jsonValue = value == null ? "null" : value instanceof Number || value instanceof Boolean
                    ? value.toString()
                    : "\"" + String.valueOf(value).replace("\"", "\\\"") + "\"";
            pairs.add("\"" + entry.getKey() + "\":" + jsonValue);
        }
        return "{" + String.join(",", pairs) + "}";
    }

    private void expireChallenges(Connection conn) throws Exception {
        PreparedStatement ps = conn.prepareStatement(
                "UPDATE izazov SET Status='istekao', Odgovoren=NOW() " +
                "WHERE Status='na_cekanju' AND Kreiran < NOW() - INTERVAL 10 SECOND");
        ps.executeUpdate();
    }

    private List<Map<String, Object>> getMatchPlayers(Connection conn, int matchId) throws Exception {
        List<Map<String, Object>> players = new ArrayList<>();
        PreparedStatement ps = conn.prepareStatement(
                "SELECT * FROM mec_igrac WHERE Mec_ID=? ORDER BY BrojPronadjenih DESC, VrijemeSekundi ASC, Korisnik_ID ASC");
        ps.setInt(1, matchId);
        ResultSet rs = ps.executeQuery();
        while (rs.next()) players.add(rowToMap(rs));
        return players;
    }

    private Map<String, Object> buildFinishedResult(Connection conn, int matchId) throws Exception {
        PreparedStatement matchPs = conn.prepareStatement(
                "SELECT m.ID, m.Pobjednik_ID, m.RazlogZavrsetka, m.Napustio_ID, m.Tezina, " +
                "COALESCE(t.Naziv, m.CustomTema) AS TemaNaziv, " +
                "izazivac.ID AS Izazivac_ID, izazivac.KorisnickoIme AS IzazivacIme, " +
                "protivnik.ID AS Protivnik_ID, protivnik.KorisnickoIme AS ProtivnikIme " +
                "FROM mec m JOIN izazov i ON i.ID=m.Izazov_ID " +
                "JOIN korisnik izazivac ON izazivac.ID=i.Izazivac_ID " +
                "JOIN korisnik protivnik ON protivnik.ID=i.Protivnik_ID " +
                "LEFT JOIN tema t ON t.ID=m.Tema_ID WHERE m.ID=? AND m.Status='zavrsen'");
        matchPs.setInt(1, matchId);
        ResultSet match = matchPs.executeQuery();
        if (!match.next()) return null;

        List<Map<String, Object>> players = getMatchPlayers(conn, matchId);
        Map<String, Object> result = new HashMap<>();
        result.put("matchId", matchId);
        result.put("winnerUserId", match.getObject("Pobjednik_ID"));
        result.put("reason", match.getString("RazlogZavrsetka"));
        result.put("forfeitedUserId", match.getObject("Napustio_ID"));
        result.put("difficultyId", match.getString("Tezina"));
        result.put("themeName", match.getString("TemaNaziv"));
        result.put("challengerUserId", match.getInt("Izazivac_ID"));
        result.put("challengerName", match.getString("IzazivacIme"));
        result.put("opponentUserId", match.getInt("Protivnik_ID"));
        result.put("opponentName", match.getString("ProtivnikIme"));
        result.put("players", players);
        if (!players.isEmpty()) {
            result.put("playerOneUserId", players.get(0).get("Korisnik_ID"));
            result.put("playerOneFoundCount", players.get(0).get("BrojPronadjenih"));
            result.put("playerOneElapsedSeconds", players.get(0).get("VrijemeSekundi"));
        }
        if (players.size() > 1) {
            result.put("playerTwoUserId", players.get(1).get("Korisnik_ID"));
            result.put("playerTwoFoundCount", players.get(1).get("BrojPronadjenih"));
            result.put("playerTwoElapsedSeconds", players.get(1).get("VrijemeSekundi"));
        }
        return result;
    }

    private boolean areFriends(Connection conn, int firstUserId, int secondUserId) throws Exception {
        PreparedStatement ps = conn.prepareStatement(
                "SELECT ID FROM prijateljstvo WHERE Status='prihvaceno' AND " +
                "((Posiljalac_ID=? AND Primalac_ID=?) OR (Posiljalac_ID=? AND Primalac_ID=?))");
        ps.setInt(1, firstUserId);
        ps.setInt(2, secondUserId);
        ps.setInt(3, secondUserId);
        ps.setInt(4, firstUserId);
        return ps.executeQuery().next();
    }

    private boolean hasActiveMatch(Connection conn, int userId) throws Exception {
        PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM mec m JOIN mec_igrac mi ON mi.Mec_ID=m.ID WHERE mi.Korisnik_ID=? AND m.Status='aktivan' LIMIT 1");
        ps.setInt(1, userId);
        return ps.executeQuery().next();
    }

    private void insertMatchPlayer(Connection conn, int matchId, int userId) throws Exception {
        PreparedStatement ps = conn.prepareStatement("INSERT INTO mec_igrac (Mec_ID, Korisnik_ID, PronadjeneRijeciJson) VALUES (?, ?, '[]')");
        ps.setInt(1, matchId);
        ps.setInt(2, userId);
        ps.executeUpdate();
    }

    private void updateStats(Connection conn, List<Map<String, Object>> players, Integer winner) throws Exception {
        if (winner == null) return;
        for (Map<String, Object> player : players) {
            int userId = ((Number) player.get("Korisnik_ID")).intValue();
            PreparedStatement ps = conn.prepareStatement(userId == winner
                    ? "UPDATE korisnik SET UkupnoPobjeda=UkupnoPobjeda+1 WHERE ID=?"
                    : "UPDATE korisnik SET UkupnoPoraza=UkupnoPoraza+1 WHERE ID=?");
            ps.setInt(1, userId);
            ps.executeUpdate();
        }
    }

    private Map<String, Object> getById(Connection conn, String table, PreparedStatement insertStatement) throws Exception {
        ResultSet keys = insertStatement.getGeneratedKeys();
        if (!keys.next()) return null;
        PreparedStatement select = conn.prepareStatement("SELECT * FROM " + table + " WHERE ID=?");
        select.setInt(1, keys.getInt(1));
        ResultSet rs = select.executeQuery();
        if (rs.next()) return rowToMap(rs);
        return null;
    }

    private Map<String, Object> rowToMap(ResultSet rs) throws Exception {
        Map<String, Object> map = new HashMap<>();
        int count = rs.getMetaData().getColumnCount();
        for (int i = 1; i <= count; i++) {
            map.put(rs.getMetaData().getColumnLabel(i), rs.getObject(i));
        }
        return map;
    }

    private String toJson(Set<String> words) {
        List<String> escaped = new ArrayList<>();
        for (String word : words) {
            escaped.add("\"" + word.replace("\"", "\\\"") + "\"");
        }
        return "[" + String.join(",", escaped) + "]";
    }
}
