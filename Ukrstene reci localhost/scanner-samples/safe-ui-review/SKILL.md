---
name: safe-ui-review
description: Pomaze Codexu da bezbjedno popravlja konkretne probleme u web ili mobilnoj igrici Osmosmerka: mobilni raspored elemenata, velicinu dugmadi i informacija, centriranje prozora poslije zavrsetka igre, prevlacenje dijagonalno u zmijica modu i jasnije indeksiranje slova pronadjenih rijeci. Koristi se kada treba napraviti male, fokusirane UI i input popravke bez diranja nepovezanog koda.
---

# Osmosmerka UI Popravke

Koristi ovaj skill kada radis na igrici Osmosmerka i treba popraviti ono sto korisnik vidi ili dodiruje, posebno na telefonu. Cilj je da se problem rijesi direktno, bez velikog refaktorisanja i bez mijenjanja dijelova igre koji nisu povezani sa zahtjevom.

## Pravila rada

1. Prvo pronadji fajlove koji stvarno upravljaju trazenim ekranom ili ponasanjem. Koristi `rg`, `rg --files` i postojece nazive komponenti.
2. Procitaj komponentu i CSS prije izmjene. Zadrzi postojece boje, klase, helper funkcije i stil pisanja koda.
3. Mijenjaj samo ono sto je potrebno za trazeni problem.
4. Poslije izmjene provjeri i mobilni i desktop raspored kad god se dira UI.
5. Ako se dira prevlacenje, dodir ili zmijica mod, provjeri logiku smjera i pragove za izbor sledeceg slova.
6. Na kraju pokreni najblizu dostupnu provjeru u projektu, na primjer build, lint ili lokalni test.

## Tipicne popravke

### Mobilni raspored

- Elementi u vrhu igre, kao sto su nadjeno, bodovi, muzika i izadji, treba da budu citljivi i dovoljno veliki za dodir.
- Dugme za izlaz ne smije da padne u novi red ako korisnik trazi da bude poravnato sa ostalim elementima.
- Hint kartice mogu dijeliti isti red i zauzimati po pola sirine ekrana ako za to ima mjesta.
- Nemoj smanjivati cijelu tablu samo da bi se sakrio problem u headeru.

### Prozor na kraju igre

- Modal poslije zavrsetka igre treba da stoji po sredini vidljivog ekrana.
- Pozicioniranje modala ne smije zavisiti od visine sadrzaja igre ili od toga koliko je korisnik skrolovao.
- Overlay treba da ostane stabilan na telefonu i desktopu.

### Zmijica mod

- Kada korisnik vuce dijagonalno, izbor sledeceg slova treba da prepozna namjeru bez kruzenja oko susjednih polja.
- Ako su horizontalni, vertikalni i dijagonalni kandidati blizu, favorizuj smjer koji najbolje prati pokret prsta.
- Ne uvodi promjene koje kvare normalno prevlacenje gore, dolje, lijevo i desno.

### Indeksiranje slova

- Kada se rijec nadje u zmijica modu, indeks slova treba da pokazuje kojoj rijeci pripada.
- Koristi oblik `1.1`, `1.2`, `1.3` za prvu rijec, `2.1`, `2.2`, `2.3` za drugu rijec i tako dalje.
- Indeks treba da bude citljiv, ali da ne sakriva slovo.

## Sta ne raditi

- Ne dodavati nove biblioteke ako problem moze da se rijesi postojecim kodom.
- Ne dirati backend, bazu, autentifikaciju, deploy podesavanja ili dokumentaciju ako zahtjev nije o tome.
- Ne dodavati mrezu, tajne kljuceve, brisanje fajlova, pokretanje spoljasnjih komandi ili automatizacije u ovaj skill.
- Ne prepisivati cijelu igru zbog jedne UI greske.

## Izvjestaj na kraju

U odgovoru kratko navedi:

- koji fajlovi su promijenjeni;
- sta se sada drugacije vidi ili ponasa;
- koju provjeru si pokrenuo;
- ako nesto nije moglo da se provjeri.
