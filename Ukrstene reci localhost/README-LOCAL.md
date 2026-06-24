# Ukrstene reci - lokalna kopija

Ova kopija koristi lokalne servise:

- frontend: http://localhost:5173
- backend: http://localhost:8081
- MySQL: localhost:3306
- baza: ukrstene_reci
- MySQL korisnik: root

## Pokretanje svega

Pokreni MySQL servis, pa iz ovog foldera pokreni:

`powershell -ExecutionPolicy Bypass -File .\start-local.ps1`

Skripta ce skriveno traziti MySQL lozinku, automatski kreirati/azurirati bazu iz
`backend/database/schema.sql`, instalirati frontend pakete ako nedostaju i
pokrenuti backend i Vite frontend.

Isto mozes pokrenuti sa `npm run dev:full`. Skripta nece pokrenuti backend
ako MySQL lozinka nije ispravna.

Samo backend pokreces sa `npm run dev:backend`.

Ako koristis drugog MySQL korisnika:

`powershell -ExecutionPolicy Bypass -File .\start-local.ps1 -DbUsername korisnik`

## Rucna priprema baze

Ako skripta ne pronadje `mysql.exe`, u MySQL Workbench-u otvori i izvrsi:

`backend/database/schema.sql`

Gemini generisanje rijeci i dalje koristi Google API preko interneta. Frontend, backend i MySQL baza rade lokalno.
