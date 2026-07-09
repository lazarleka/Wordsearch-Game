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

INSERT INTO korisnik (
  KorisnickoIme,
  Ime,
  Prezime,
  Email,
  LozinkaHash,
  Uloga,
  AvatarBoja
) VALUES (
  'admin',
  'Admin',
  'Panel',
  'admin@ukrstene.local',
  '+4M6Cr6E70Z2NYRiodHb6A==:2+wiY1loYu2n83aZKcHJBfADwzJwefu2/NxFZ4j8mS4=',
  'admin',
  '#ffc845'
) ON DUPLICATE KEY UPDATE
  Ime = 'Admin',
  Prezime = 'Panel',
  LozinkaHash = VALUES(LozinkaHash),
  Uloga = 'admin',
  AvatarBoja = '#ffc845';

-- Login:
-- email: admin@ukrstene.local
-- lozinka: Admin123!
