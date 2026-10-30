USE ukrstene_reci;

ALTER TABLE korisnik
  ADD COLUMN IF NOT EXISTS Uloga VARCHAR(20) NOT NULL DEFAULT 'korisnik' AFTER LozinkaHash;

UPDATE korisnik
SET Uloga = 'korisnik'
WHERE Uloga IS NULL OR Uloga = '';

-- Admin nalog kreira backend pri pokretanju iz varijabli okruzenja
-- ADMIN_USERNAME, ADMIN_EMAIL i ADMIN_PASSWORD (lozinka se ne cuva u repozitorijumu).
