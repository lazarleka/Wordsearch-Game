package com.example.ukrstenereci;

import com.example.ukrstenereci.services.PasswordUtil;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Properties;

public class DBUtil {
    private static final Properties LOCAL_ENV = loadLocalEnv();
    private static final Properties APPLICATION_PROPERTIES = loadApplicationProperties();
    private static final String HOST = setting("DB_HOST", "app.db.host", "localhost");
    private static final String PORT = setting("DB_PORT", "app.db.port", "3306");
    private static final String DB_NAME = setting("DB_NAME", "app.db.name", "ukrstene_reci");
    private static final String USERNAME = setting("DB_USERNAME", "app.db.username", "root");
    private static final String PASSWORD = setting("DB_PASSWORD", "app.db.password", "lazar2004");
    private static final String ADMIN_USERNAME = setting("ADMIN_USERNAME", "app.admin.username", "admin");
    private static final String ADMIN_EMAIL = setting("ADMIN_EMAIL", "app.admin.email", "admin@ukrstene.local");
    private static final String ADMIN_PASSWORD = setting("ADMIN_PASSWORD", "app.admin.password", "Admin123!");
    private static final String SSL_MODE = setting(
            "DB_SSL_MODE",
            "app.db.ssl-mode",
            "DISABLED");
    private static volatile HikariDataSource dataSource;
    private static boolean schemaChecked = false;

    public static Connection open() throws SQLException {
        Connection conn = dataSource().getConnection();
        ensureSchema(conn);
        return conn;
    }

    private static String jdbcUrl(String database) {
        return "jdbc:mysql://" + HOST + ":" + PORT + "/" + database
                + "?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC"
                + "&sslMode=" + SSL_MODE
                + "&connectTimeout=10000&socketTimeout=30000";
    }

    private static String setting(String environmentName, String propertyName, String fallback) {
        String environmentValue = System.getenv(environmentName);
        if (environmentValue != null && !environmentValue.isBlank()) return environmentValue.trim();
        String systemValue = System.getProperty(propertyName);
        if (systemValue != null && !systemValue.isBlank()) return systemValue.trim();
        String localValue = LOCAL_ENV.getProperty(environmentName);
        if (localValue != null && !localValue.isBlank()) return localValue.trim();
        return resolvePlaceholders(APPLICATION_PROPERTIES.getProperty(propertyName), fallback);
    }

    private static String resolvePlaceholders(String value, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        String trimmed = value.trim();
        if (trimmed.startsWith("${") && trimmed.endsWith("}")) {
            String expression = trimmed.substring(2, trimmed.length() - 1);
            int separator = expression.indexOf(':');
            String environmentName = separator >= 0 ? expression.substring(0, separator) : expression;
            String defaultValue = separator >= 0 ? expression.substring(separator + 1) : fallback;
            String environmentValue = System.getenv(environmentName);
            if (environmentValue != null && !environmentValue.isBlank()) return environmentValue.trim();
            return defaultValue;
        }
        return trimmed;
    }

    private static Properties loadApplicationProperties() {
        Properties properties = new Properties();
        try (InputStream in = DBUtil.class.getClassLoader().getResourceAsStream("application.properties")) {
            if (in != null) properties.load(in);
        } catch (IOException ignored) {
            // Environment variables and hard-coded fallbacks are still available if the file is missing.
        }
        return properties;
    }

    private static Properties loadLocalEnv() {
        Properties properties = new Properties();
        loadEnvFile(properties, Path.of(".env.local"));
        loadEnvFile(properties, Path.of(".env"));
        loadEnvFile(properties, Path.of("backend", ".env.local"));
        loadEnvFile(properties, Path.of("backend", ".env"));
        return properties;
    }

    private static void loadEnvFile(Properties properties, Path path) {
        if (!Files.isRegularFile(path)) return;
        try {
            for (String line : Files.readAllLines(path)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) continue;
                int separator = trimmed.indexOf('=');
                if (separator <= 0) continue;
                String key = trimmed.substring(0, separator).trim();
                String value = trimmed.substring(separator + 1).trim();
                if ((value.startsWith("\"") && value.endsWith("\""))
                        || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.substring(1, value.length() - 1);
                }
                properties.setProperty(key, value);
            }
        } catch (IOException ignored) {
            // Missing local config should not prevent production env vars from working.
        }
    }

    private static HikariDataSource dataSource() throws SQLException {
        HikariDataSource existing = dataSource;
        if (existing != null) return existing;
        synchronized (DBUtil.class) {
            if (dataSource != null) return dataSource;
            try {
                dataSource = createDataSource();
                return dataSource;
            } catch (RuntimeException e) {
                throw new SQLException("Ne mogu da se povezem na MySQL bazu " + HOST + ":" + PORT + "/" + DB_NAME
                        + " kao korisnik '" + USERNAME + "'. Provjeri DB_HOST, DB_PORT, DB_NAME, DB_USERNAME i DB_PASSWORD.", e);
            }
        }
    }

    private static HikariDataSource createDataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(jdbcUrl(DB_NAME));
        config.setUsername(USERNAME);
        config.setPassword(PASSWORD);
        config.setPoolName("ukrstene-pool");
        config.setMaximumPoolSize(Integer.parseInt(setting("DB_POOL_SIZE", "app.db.pool-size", "5")));
        config.setMinimumIdle(1);
        config.setConnectionTimeout(15000);
        config.setValidationTimeout(5000);
        config.setIdleTimeout(300000);
        config.setMaxLifetime(1200000);
        return new HikariDataSource(config);
    }

    private static synchronized void ensureSchema(Connection conn) {
        if (schemaChecked) return;
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE IF NOT EXISTS korisnik (ID INT PRIMARY KEY AUTO_INCREMENT, KorisnickoIme VARCHAR(60) NOT NULL UNIQUE, Ime VARCHAR(80) NOT NULL, Prezime VARCHAR(80) NULL, Email VARCHAR(120) NOT NULL UNIQUE, LozinkaHash VARCHAR(220) NOT NULL, Uloga VARCHAR(20) NOT NULL DEFAULT 'korisnik', AvatarBoja VARCHAR(20) NOT NULL DEFAULT '#00e5b4', UkupnoPobjeda INT NOT NULL DEFAULT 0, UkupnoPoraza INT NOT NULL DEFAULT 0, Kreiran DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)");
            st.execute("CREATE TABLE IF NOT EXISTS tema (ID VARCHAR(60) PRIMARY KEY, Naziv VARCHAR(100) NOT NULL, Staticka TINYINT(1) NOT NULL DEFAULT 1, KreiraoKorisnik_ID INT NULL, Kreirana DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT fk_tema_korisnik FOREIGN KEY (KreiraoKorisnik_ID) REFERENCES korisnik(ID) ON DELETE SET NULL)");
            st.execute("CREATE TABLE IF NOT EXISTS tema_rijec (ID INT PRIMARY KEY AUTO_INCREMENT, Tema_ID VARCHAR(60) NOT NULL, Rijec VARCHAR(30) NOT NULL, Tezina VARCHAR(20) NOT NULL DEFAULT 'sve', Kreirana DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_tema_rijec (Tema_ID, Rijec), CONSTRAINT fk_rijec_tema FOREIGN KEY (Tema_ID) REFERENCES tema(ID) ON DELETE CASCADE)");
            st.execute("CREATE TABLE IF NOT EXISTS prijateljstvo (ID INT PRIMARY KEY AUTO_INCREMENT, Posiljalac_ID INT NOT NULL, Primalac_ID INT NOT NULL, Status ENUM('na_cekanju','prihvaceno','odbijeno','blokirano') NOT NULL DEFAULT 'na_cekanju', Kreirano DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, Azurirano DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uq_prijateljstvo (Posiljalac_ID, Primalac_ID), CONSTRAINT fk_prijatelj_posiljalac FOREIGN KEY (Posiljalac_ID) REFERENCES korisnik(ID) ON DELETE CASCADE, CONSTRAINT fk_prijatelj_primalac FOREIGN KEY (Primalac_ID) REFERENCES korisnik(ID) ON DELETE CASCADE)");
            st.execute("CREATE TABLE IF NOT EXISTS izazov (ID INT PRIMARY KEY AUTO_INCREMENT, Izazivac_ID INT NOT NULL, Protivnik_ID INT NOT NULL, Tema_ID VARCHAR(60) NULL, CustomTema VARCHAR(120) NULL, RijeciJson JSON NULL, VrstaIgre VARCHAR(20) NOT NULL DEFAULT 'obican', ModMeca VARCHAR(20) NOT NULL DEFAULT 'versus', Tezina VARCHAR(20) NOT NULL, BrojRijeci INT NOT NULL, VelicinaMatrice INT NOT NULL, VremenskoOgranicenjeSekundi INT NOT NULL DEFAULT 300, Status ENUM('na_cekanju','prihvacen','odbijen','otkazan','istekao') NOT NULL DEFAULT 'na_cekanju', Kreiran DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, Odgovoren DATETIME NULL, CONSTRAINT fk_izazov_izazivac FOREIGN KEY (Izazivac_ID) REFERENCES korisnik(ID) ON DELETE CASCADE, CONSTRAINT fk_izazov_protivnik FOREIGN KEY (Protivnik_ID) REFERENCES korisnik(ID) ON DELETE CASCADE, CONSTRAINT fk_izazov_tema FOREIGN KEY (Tema_ID) REFERENCES tema(ID))");
            st.execute("CREATE TABLE IF NOT EXISTS mec (ID INT PRIMARY KEY AUTO_INCREMENT, Izazov_ID INT NOT NULL UNIQUE, Tema_ID VARCHAR(60) NULL, CustomTema VARCHAR(120) NULL, RijeciJson JSON NULL, VrstaIgre VARCHAR(20) NOT NULL DEFAULT 'obican', ModMeca VARCHAR(20) NOT NULL DEFAULT 'versus', OsvojeneRijeciJson JSON NULL, Tezina VARCHAR(20) NOT NULL, BrojRijeci INT NOT NULL, VelicinaMatrice INT NOT NULL, VremenskoOgranicenjeSekundi INT NOT NULL, Status ENUM('spreman','aktivan','zavrsen') NOT NULL DEFAULT 'aktivan', Pobjednik_ID INT NULL, RazlogZavrsetka VARCHAR(30) NULL, Napustio_ID INT NULL, Zapocet DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, Zavrsen DATETIME NULL, CONSTRAINT fk_mec_izazov FOREIGN KEY (Izazov_ID) REFERENCES izazov(ID) ON DELETE CASCADE, CONSTRAINT fk_mec_tema FOREIGN KEY (Tema_ID) REFERENCES tema(ID), CONSTRAINT fk_mec_pobjednik FOREIGN KEY (Pobjednik_ID) REFERENCES korisnik(ID) ON DELETE SET NULL)");
            st.execute("CREATE TABLE IF NOT EXISTS mec_igrac (ID INT PRIMARY KEY AUTO_INCREMENT, Mec_ID INT NOT NULL, Korisnik_ID INT NOT NULL, PronadjeneRijeciJson JSON NOT NULL, BrojPronadjenih INT NOT NULL DEFAULT 0, VrijemeSekundi INT NOT NULL DEFAULT 0, Zavrsio TINYINT(1) NOT NULL DEFAULT 0, Azurirano DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uq_mec_igrac (Mec_ID, Korisnik_ID), CONSTRAINT fk_mec_igrac_mec FOREIGN KEY (Mec_ID) REFERENCES mec(ID) ON DELETE CASCADE, CONSTRAINT fk_mec_igrac_korisnik FOREIGN KEY (Korisnik_ID) REFERENCES korisnik(ID) ON DELETE CASCADE)");
            st.execute("CREATE TABLE IF NOT EXISTS tema_predlog (ID INT PRIMARY KEY AUTO_INCREMENT, Naziv VARCHAR(100) NOT NULL, RijeciJson JSON NOT NULL, PredlozioKorisnik_ID INT NOT NULL, Status ENUM('na_cekanju','odobrena','odbijena') NOT NULL DEFAULT 'na_cekanju', Kreirana DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, Odgovorena DATETIME NULL, CONSTRAINT fk_tema_predlog_korisnik FOREIGN KEY (PredlozioKorisnik_ID) REFERENCES korisnik(ID) ON DELETE CASCADE)");
            st.execute("CREATE TABLE IF NOT EXISTS solo_rezultat (ID INT PRIMARY KEY AUTO_INCREMENT, Korisnik_ID INT NOT NULL, TemaNaziv VARCHAR(120) NOT NULL, Tezina VARCHAR(20) NOT NULL, BrojPronadjenih INT NOT NULL DEFAULT 0, UkupnoRijeci INT NOT NULL DEFAULT 0, VrijemeSekundi INT NOT NULL DEFAULT 0, PowerUpKazna INT NOT NULL DEFAULT 0, Bodovi INT NOT NULL DEFAULT 0, Kreiran DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT fk_solo_korisnik FOREIGN KEY (Korisnik_ID) REFERENCES korisnik(ID) ON DELETE CASCADE)");
            migrateAdminColumns(conn);
            seedAdminUser(conn);
            migrateVersusColumns(conn);
            seedThemes(conn);
            schemaChecked = true;
        } catch (Exception e) {
            System.out.println(e);
        }
    }

    private static void seedThemes(Connection conn) throws SQLException {
        seedTheme(conn, "zivotinje", "Životinje", new String[]{"MEDVED", "LISICA", "VRABAC", "ZMIJA", "JELEN", "ZEKO", "TIGAR", "ORAO", "RIBA", "VUK", "KONJ", "BISON", "PTICA", "LASTA", "PANDA"});
        seedTheme(conn, "sport", "Sport", new String[]{"FUDBAL", "KOSARKA", "TENIS", "PLIVANJE", "ATLETIKA", "BOKS", "HOKEJ", "ODBOJKA", "RUKOMET", "GOLF", "TRKA", "BICIKL", "MARATON", "SKIJANJE"});
        seedTheme(conn, "hrana", "Hrana", new String[]{"BUREK", "CEVAP", "SARMA", "KAJMAK", "AJVAR", "PITA", "PAPRIKA", "PARADAJZ", "KROMPIR", "SIR", "HLEB", "MESO", "TORTA", "SUPA", "CORBA"});
        seedTheme(conn, "geografija", "Geografija", new String[]{"BEOGRAD", "DUNAV", "SRBIJA", "PLANINA", "JEZERO", "RIJEKA", "TISA", "BALKAN", "DOLINA", "MORE", "GRAD", "SAVA", "OKEAN", "OSTRVO"});
        seedTheme(conn, "nauka", "Nauka", new String[]{"ATOM", "LASER", "MAGNET", "ENERGIJA", "ELEKTRON", "MOLEKUL", "FIZIKA", "BIOLOGIJA", "HEMIJA", "SILA", "TEORIJA", "GENETIKA", "SVEMIR", "CELIJA"});
        seedTheme(conn, "muzika", "Muzika", new String[]{"GITARA", "KLAVIR", "VIOLINA", "BUBANJ", "FLAUTA", "NOTA", "MELODIJA", "RITAM", "JAZZ", "OPERA", "PJESMA", "HOR", "TRUBA", "KONCERT", "REFREN"});
        seedTheme(conn, "filmovi", "Filmovi", new String[]{"DRAMA", "KOMEDIJA", "AKCIJA", "HOROR", "ANIMACIJA", "SCENA", "GLUMA", "FESTIVAL", "NAGRADA", "REZISER", "KAMERA", "BIOSKOP", "GLUMAC", "TRAILER"});
        replaceThemeWords(conn, "istorija", "Istorija", new String[]{"ANTIKA", "ARHEOLOGIJA", "CARSTVO", "CIVILIZACIJA", "DINASTIJA", "DOKUMENT", "EPOHA", "HRONOLOGIJA", "IMPERIJA", "KRALJEVSTVO", "MUZEJ", "POVELJA", "RENESANSA", "REVOLUCIJA"});
        seedTheme(conn, "tehnologija", "Tehnologija", new String[]{"KOMPJUTER", "INTERNET", "SOFTVER", "ROBOT", "SERVER", "MREZA", "APLIKACIJA", "PROGRAMER", "BAJT", "FAJL", "EKRAN", "OBLAK", "PODACI", "KABEL"});
    }

    private static void seedTheme(Connection conn, String id, String label, String[] words) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("INSERT INTO tema (ID, Naziv, Staticka) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE Naziv=VALUES(Naziv), Staticka=1")) {
            ps.setString(1, id);
            ps.setString(2, label);
            ps.executeUpdate();
        }
        try (PreparedStatement ps = conn.prepareStatement("INSERT IGNORE INTO tema_rijec (Tema_ID, Rijec) VALUES (?, ?)")) {
            for (String word : words) {
                ps.setString(1, id);
                ps.setString(2, word);
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    private static void replaceThemeWords(Connection conn, String id, String label, String[] words) throws SQLException {
        seedTheme(conn, id, label, new String[]{});
        try (PreparedStatement delete = conn.prepareStatement("DELETE FROM tema_rijec WHERE Tema_ID=?")) {
            delete.setString(1, id);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement("INSERT INTO tema_rijec (Tema_ID, Rijec) VALUES (?, ?)")) {
            for (String word : words) {
                insert.setString(1, id);
                insert.setString(2, word);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void migrateVersusColumns(Connection conn) {
        executeQuietly(conn, "ALTER TABLE izazov MODIFY COLUMN Tema_ID VARCHAR(60) NULL");
        executeQuietly(conn, "ALTER TABLE izazov ADD COLUMN CustomTema VARCHAR(120) NULL AFTER Tema_ID");
        executeQuietly(conn, "ALTER TABLE izazov ADD COLUMN RijeciJson JSON NULL AFTER CustomTema");
        executeQuietly(conn, "ALTER TABLE izazov ALTER COLUMN VremenskoOgranicenjeSekundi SET DEFAULT 300");
        executeQuietly(conn, "ALTER TABLE mec MODIFY COLUMN Tema_ID VARCHAR(60) NULL");
        executeQuietly(conn, "ALTER TABLE mec ADD COLUMN CustomTema VARCHAR(120) NULL AFTER Tema_ID");
        executeQuietly(conn, "ALTER TABLE mec ADD COLUMN RijeciJson JSON NULL AFTER CustomTema");
        executeQuietly(conn, "ALTER TABLE izazov ADD COLUMN VrstaIgre VARCHAR(20) NOT NULL DEFAULT 'obican' AFTER RijeciJson");
        executeQuietly(conn, "ALTER TABLE mec ADD COLUMN VrstaIgre VARCHAR(20) NOT NULL DEFAULT 'obican' AFTER RijeciJson");
        executeQuietly(conn, "ALTER TABLE izazov ADD COLUMN ModMeca VARCHAR(20) NOT NULL DEFAULT 'versus' AFTER VrstaIgre");
        executeQuietly(conn, "ALTER TABLE mec ADD COLUMN ModMeca VARCHAR(20) NOT NULL DEFAULT 'versus' AFTER VrstaIgre");
        executeQuietly(conn, "ALTER TABLE mec ADD COLUMN OsvojeneRijeciJson JSON NULL AFTER ModMeca");
        executeQuietly(conn, "ALTER TABLE mec ADD COLUMN RazlogZavrsetka VARCHAR(30) NULL AFTER Pobjednik_ID");
        executeQuietly(conn, "ALTER TABLE mec ADD COLUMN Napustio_ID INT NULL AFTER RazlogZavrsetka");
        executeQuietly(conn, "ALTER TABLE izazov ADD INDEX idx_izazov_primalac_status (Protivnik_ID, Status, Kreiran)");
        executeQuietly(conn, "ALTER TABLE izazov ADD INDEX idx_izazov_posiljalac_status (Izazivac_ID, Status, Kreiran)");
        executeQuietly(conn, "ALTER TABLE mec ADD INDEX idx_mec_status_zapocet (Status, Zapocet)");
        executeQuietly(conn, "ALTER TABLE mec_igrac ADD INDEX idx_mec_igrac_korisnik (Korisnik_ID, Mec_ID)");
        executeQuietly(conn, "ALTER TABLE mec_igrac ADD COLUMN Bodovi INT NOT NULL DEFAULT 0 AFTER Zavrsio");
        executeQuietly(conn, "ALTER TABLE mec_igrac ADD COLUMN PowerUpKazna INT NOT NULL DEFAULT 0 AFTER Bodovi");
        executeQuietly(conn, "UPDATE mec_igrac SET Bodovi=BrojPronadjenih*100 WHERE Bodovi=0 AND BrojPronadjenih>0");
        executeQuietly(conn, "ALTER TABLE solo_rezultat ADD INDEX idx_solo_korisnik (Korisnik_ID, Kreiran)");
    }

    private static void migrateAdminColumns(Connection conn) {
        executeQuietly(conn, "ALTER TABLE korisnik ADD COLUMN Uloga VARCHAR(20) NOT NULL DEFAULT 'korisnik' AFTER LozinkaHash");
        executeQuietly(conn, "UPDATE korisnik SET Uloga='korisnik' WHERE Uloga IS NULL OR Uloga=''");
    }

    private static void seedAdminUser(Connection conn) {
        try (PreparedStatement updateExisting = conn.prepareStatement(
                "UPDATE korisnik SET KorisnickoIme=?, Ime='Admin', Prezime='Panel', LozinkaHash=?, Uloga='admin', AvatarBoja='#ffc845' WHERE Email=?")) {
            updateExisting.setString(1, ADMIN_USERNAME.trim().toLowerCase());
            updateExisting.setString(2, PasswordUtil.hash(ADMIN_PASSWORD));
            updateExisting.setString(3, ADMIN_EMAIL.trim().toLowerCase());
            if (updateExisting.executeUpdate() > 0) return;
        } catch (Exception ignored) {
            // Existing data wins if a username/email collision is already present.
        }

        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO korisnik (KorisnickoIme, Ime, Prezime, Email, LozinkaHash, Uloga, AvatarBoja) " +
                        "VALUES (?, 'Admin', 'Panel', ?, ?, 'admin', '#ffc845')")) {
            ps.setString(1, ADMIN_USERNAME.trim().toLowerCase());
            ps.setString(2, ADMIN_EMAIL.trim().toLowerCase());
            ps.setString(3, PasswordUtil.hash(ADMIN_PASSWORD));
            ps.executeUpdate();
        } catch (Exception ignored) {
            // Admin may already exist under a custom username/email.
        }
    }

    private static void executeQuietly(Connection conn, String sql) {
        try (Statement st = conn.createStatement()) {
            st.execute(sql);
        } catch (Exception ignored) {
            // The migration is idempotent; duplicate-column errors are expected after the first run.
        }
    }
}
