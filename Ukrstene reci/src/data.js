export const DEMO_WORDS = {
  zivotinje: ['MEDVED', 'LISICA', 'VRABAC', 'ZMIJA', 'JELEN', 'ZEKO', 'TIGAR', 'ORAO', 'RIBA', 'VUK', 'KONJ', 'BISON', 'PTICA', 'LASTA', 'PANDA'],
  sport: ['FUDBAL', 'KOSARKA', 'TENIS', 'PLIVANJE', 'ATLETIKA', 'BOKS', 'HOKEJ', 'ODBOJKA', 'RUKOMET', 'GOLF', 'TRKA', 'BICIKL', 'MARATON', 'SKIJANJE'],
  hrana: ['BUREK', 'CEVAP', 'SARMA', 'KAJMAK', 'AJVAR', 'PITA', 'PAPRIKA', 'PARADAJZ', 'KROMPIR', 'SIR', 'HLEB', 'MESO', 'TORTA', 'SUPA', 'CORBA'],
  geografija: ['BEOGRAD', 'DUNAV', 'SRBIJA', 'PLANINA', 'JEZERO', 'RIJEKA', 'TISA', 'BALKAN', 'DOLINA', 'MORE', 'GRAD', 'SAVA', 'OKEAN', 'OSTRVO'],
  nauka: ['ATOM', 'LASER', 'MAGNET', 'ENERGIJA', 'ELEKTRON', 'MOLEKUL', 'FIZIKA', 'BIOLOGIJA', 'HEMIJA', 'SILA', 'TEORIJA', 'GENETIKA', 'SVEMIR', 'CELIJA'],
  muzika: ['GITARA', 'KLAVIR', 'VIOLINA', 'BUBANJ', 'FLAUTA', 'NOTA', 'MELODIJA', 'RITAM', 'JAZZ', 'OPERA', 'PJESMA', 'HOR', 'TRUBA', 'KONCERT', 'REFREN'],
  filmovi: ['DRAMA', 'KOMEDIJA', 'AKCIJA', 'HOROR', 'ANIMACIJA', 'SCENA', 'GLUMA', 'FESTIVAL', 'NAGRADA', 'REZISER', 'KAMERA', 'BIOSKOP', 'GLUMAC', 'TRAILER'],
  istorija: ['ANTIKA', 'ARHEOLOGIJA', 'CARSTVO', 'CIVILIZACIJA', 'DINASTIJA', 'DOKUMENT', 'EPOHA', 'HRONOLOGIJA', 'IMPERIJA', 'KRALJEVSTVO', 'MUZEJ', 'POVELJA', 'RENESANSA', 'REVOLUCIJA'],
  tehnologija: ['KOMPJUTER', 'INTERNET', 'SOFTVER', 'ROBOT', 'SERVER', 'MREZA', 'APLIKACIJA', 'PROGRAMER', 'BAJT', 'FAJL', 'EKRAN', 'OBLAK', 'PODACI', 'KABEL'],
};

export const THEMES = [
  { id: 'zivotinje', label: 'Životinje' },
  { id: 'sport', label: 'Sport' },
  { id: 'hrana', label: 'Hrana' },
  { id: 'geografija', label: 'Geografija' },
  { id: 'nauka', label: 'Nauka' },
  { id: 'muzika', label: 'Muzika' },
  { id: 'filmovi', label: 'Filmovi' },
  { id: 'istorija', label: 'Istorija' },
  { id: 'tehnologija', label: 'Tehnologija' },
];

export const DIFFICULTIES = [
  { id: 'easy', label: 'Lako', n: 8, wc: 6, sub: '8x8 - 6 riječi' },
  { id: 'med', label: 'Srednje', n: 12, wc: 10, sub: '12x12 - 10 riječi' },
  { id: 'hard', label: 'Teško', n: 15, wc: 14, sub: '15x15 - 14 riječi' },
];

export const DIRS = [
  [0, 1], [1, 0], [0, -1], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export const PALETTE = [
  '#ff4b6e', '#00e5b4', '#9b5de5', '#ffc845',
  '#f97316', '#22d3ee', '#a3e635', '#f472b6',
  '#fb923c', '#4ade80', '#c084fc', '#38bdf8',
];
