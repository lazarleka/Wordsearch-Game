USE ukrstene_reci;

SET @has_uloga := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'korisnik'
    AND COLUMN_NAME = 'Uloga'
);

SET @add_uloga_sql := IF(
  @has_uloga = 0,
  'ALTER TABLE korisnik ADD COLUMN Uloga VARCHAR(20) NOT NULL DEFAULT ''korisnik'' AFTER LozinkaHash',
  'SELECT 1'
);

PREPARE add_uloga_stmt FROM @add_uloga_sql;
EXECUTE add_uloga_stmt;
DEALLOCATE PREPARE add_uloga_stmt;

UPDATE korisnik
SET Uloga = 'korisnik'
WHERE Uloga IS NULL OR Uloga = '';

-- Admin nalog kreira backend pri pokretanju iz varijabli okruzenja
-- ADMIN_USERNAME, ADMIN_EMAIL i ADMIN_PASSWORD (lozinka se ne cuva u repozitorijumu).
