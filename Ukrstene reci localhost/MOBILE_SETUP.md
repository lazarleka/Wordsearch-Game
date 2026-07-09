# Android aplikacija

## Lokalni backend

Telefon i računar moraju biti na istoj Wi-Fi mreži. Mobilni build trenutno koristi:

```text
http://192.168.1.108:8082
```

Ako se IP adresa računara promijeni, izmijeni `VITE_BACKEND_URL`, `VITE_API_URL`, `VITE_AUTH_URL` i `VITE_WS_URL` u `.env.mobile`.

Backend pokreni na svim mrežnim interfejsima komandom:

```powershell
npm run dev:backend
```

Windows Firewall mora dozvoliti Javi dolazne konekcije na portu `8082`.

## APK

Za novi debug APK:

```powershell
npm run mobile:apk
```

APK se nalazi u:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Za sinhronizaciju web izmjena bez pravljenja APK-a:

```powershell
npm run mobile:sync
```

Za otvaranje projekta u Android Studiju:

```powershell
npm run mobile:open
```

## Notifikacije

Aplikacija traži Android dozvolu za notifikacije nakon prijave. Dok je aktivna, provjerava nove izazove na svakih pet sekundi. Pri povratku iz pozadine odmah ponavlja provjeru. Dodir na notifikaciju otvara karticu `Izazovi`.
