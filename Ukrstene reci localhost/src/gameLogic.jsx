import { fetchThemeWordsFromDatabase } from './api.js';
import { DEMO_WORDS } from './data.js';

const DIRS = [
  [0, 1], [0, -1], [1, 0], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

const PALETTE = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63',
  '#00bcd4', '#8bc34a', '#ff5722', '#607d8b',
];

function canPlace(word, r, c, dr, dc, n, grid) {
  for (let i = 0; i < word.length; i++) {
    const nr = r + dr * i;
    const nc = c + dc * i;
    if (nr < 0 || nr >= n || nc < 0 || nc >= n) return false;
    if (grid[nr][nc] && grid[nr][nc] !== word[i]) return false;
  }
  return true;
}

function createRandom(seed) {
  if (seed === undefined || seed === null) return Math.random;
  let state = Number(seed) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function buildGridAttempt(words, n, random) {
  const grid = Array.from({ length: n }, () => Array(n).fill(''));
  const placed = [];
  const placements = [];

  for (const word of [...words].sort((a, b) => b.length - a.length)) {
    let ok = false;
    for (let t = 0; t < 1200 && !ok; t++) {
      const [dr, dc] = DIRS[Math.floor(random() * DIRS.length)];
      const r = Math.floor(random() * n);
      const c = Math.floor(random() * n);
      if (canPlace(word, r, c, dr, dc, n, grid)) {
        for (let i = 0; i < word.length; i++) {
          grid[r + dr * i][c + dc * i] = word[i];
        }
        const color = PALETTE[placed.length % PALETTE.length];
        placements.push({ word, r, c, dr, dc, color });
        placed.push(word);
        ok = true;
      }
    }
    if (!ok) return null;
  }

  const alpha = 'ABCDEFGHIJKLMNOPRSTUVWZ';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!grid[r][c]) {
        grid[r][c] = alpha[Math.floor(random() * alpha.length)];
      }
    }
  }

  return { grid, words: words.filter((word) => placed.includes(word)), placements };
}

export function buildGrid(words, n, seed) {
  const maxWordLength = Math.min(n, 12);
  const normalized = [...new Set(words
    .map((word) => String(word).toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((word) => word.length >= 4 && word.length <= maxWordLength))];

  if (normalized.length === 0) {
    throw new Error('Nema validnih rijeci za ovu tablu.');
  }
  for (let attempt = 0; attempt < 80; attempt++) {
    const attemptSeed = seed === undefined || seed === null ? undefined : Number(seed) * 97 + attempt;
    const result = buildGridAttempt(normalized, n, createRandom(attemptSeed));
    if (result) return result;
  }

  throw new Error('Nije moguće smjestiti sve riječi na tablu. Izaberi drugu temu ili veću težinu.');
}

export function cellsForSelection(start, end) {
  const dr = end.r - start.r;
  const dc = end.c - start.c;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);

  let ndr = 0;
  let ndc = 0;

  if (adr === 0 && adc > 0) {
    ndc = dc > 0 ? 1 : -1;
  } else if (adc === 0 && adr > 0) {
    ndr = dr > 0 ? 1 : -1;
  } else if (adr === adc && adr > 0) {
    ndr = dr > 0 ? 1 : -1;
    ndc = dc > 0 ? 1 : -1;
  } else {
    return [[start.r, start.c]];
  }

  const len = Math.max(adr, adc);
  const cells = [];
  for (let i = 0; i <= len; i++) {
    cells.push([start.r + ndr * i, start.c + ndc * i]);
  }
  return cells;
}

export function getSelectedWord(grid, cells) {
  return cells.map(([r, c]) => grid[r]?.[c] ?? '').join('');
}

function normalizeWords(words, count, maxLength) {
  return [...new Set(words
    .map((word) => String(word).toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((word) => word.length >= 4 && word.length <= maxLength))]
    .slice(0, count);
}

const AI_WORD_ATTEMPTS = 5;
const AI_GENERATION_ERROR = 'Nije uspjelo da se generisu rijeci preko AI-a. Probajte ponovo.';

async function fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi = false, maxLength = 15, attempt = 1) {
  if (!preferApi) {
    try {
      const dbWords = await fetchThemeWordsFromDatabase(themeId, Math.max(count * 4, 30));
      const validWords = Array.isArray(dbWords) ? normalizeWords(dbWords, count, maxLength) : [];
      if (validWords.length === count) {
        return validWords;
      }
    } catch {
      // The frontend can still run without the local backend.
    }
  }

  if (!apiKey) {
    if (preferApi) {
      throw new Error('API kljuc nije podesen za temu po izboru.');
    }
    const fallback = DEMO_WORDS[themeId];
    if (!fallback) throw new Error('Tema nema pripremljene rijeci. Izaberite drugu temu ili probajte ponovo.');
    const validWords = normalizeWords(fallback, count, maxLength);
    if (validWords.length < count) throw new Error(`Tema nema dovoljno riječi do ${maxLength} slova za ovu tablu.`);
    return validWords;
  }

 const prompt = `Ti si generator reči za igru osmosmerke. Generiši najmanje ${count * 2} reči na srpskom jeziku (latinica) na temu "${themeLabel}".

Pravila:
- Svaka reč mora biti JEDNA reč (bez razmaka i crtice)
- Ukoliko je na primer u pitanju tema film i ukoliko se film sastoji iz vise reci,nemoj da ga saljes,hocu da je jedan pojam samostalna rec i da se ne sastoji iz vise reci.
- Dobro obraziti temu u rečima i nemojte generisati reči koje nisu relevantne za temu
- Duzina: 4 do ${maxLength} slova
- Samo slova A-Z (bez dijakritika: š->S, č->C, ć->C, đ->D, ž->Z)
- Sve reči velikim slovima
- Reči moraju biti relevantne za temu
- Bez duplikata
- Prija slanja obavezno proveri da li su sva pravila ispoštovana, ako nisu, generiši ponovo dok ne budu ispoštovana sva pravila



Vrati ISKLJUČIVO JSON niz.
Bez markdown-a.
Bez objašnjenja.
Bez uvodnog teksta.
Format odgovora mora biti tačno ovakav:
["REC1","REC2","REC3"]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;

  let response;
  let data;
  try {
    response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'array',
          items: { type: 'string' },
          minItems: count,
          maxItems: Math.max(count * 3, count),
        },
      },
    }),
    });
    data = await response.json().catch(() => ({}));
  } catch {
    if (attempt < AI_WORD_ATTEMPTS) {
      return fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength, attempt + 1);
    }
    throw new Error(AI_GENERATION_ERROR);
  }


  if (!response.ok) {
    if (attempt < AI_WORD_ATTEMPTS) {
      return fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength, attempt + 1);
    }
    throw new Error(AI_GENERATION_ERROR);
    throw new Error(data?.error?.message || 'Greška pri pozivu AI-a');
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    if (attempt < AI_WORD_ATTEMPTS) {
      return fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength, attempt + 1);
    }
    throw new Error(AI_GENERATION_ERROR);
    throw new Error('AI nije vratio nikakav odgovor.');
  }

  // Strip markdown fences if present
  const clean = text.replace(/```[\w]*\n?/g, '').trim();
  const match = clean.match(/\[[\s\S]*\]/);
  const jsonStr = match ? match[0] : clean;

  let words;
  try {
    words = JSON.parse(jsonStr);
  } catch {
    if (attempt < AI_WORD_ATTEMPTS) {
      return fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength, attempt + 1);
    }
    throw new Error(AI_GENERATION_ERROR);
    throw new Error('AI nije vratio ispravne podatke. Pokušajte ponovo.');
  }

  if (!Array.isArray(words) || words.length === 0) {
    if (attempt < AI_WORD_ATTEMPTS) {
      return fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength, attempt + 1);
    }
    throw new Error(AI_GENERATION_ERROR);
    throw new Error('AI nije vratio nijednu riječ.');
  }

  const validWords = normalizeWords(words, count, maxLength);
  if (validWords.length < count) {
    if (attempt < AI_WORD_ATTEMPTS) {
      return fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength, attempt + 1);
    }
    throw new Error(AI_GENERATION_ERROR);
    throw new Error(`AI nije vratio dovoljno riječi do ${maxLength} slova. Pokušaj ponovo.`);
  }
  return validWords;
}

export async function fetchWords(themeLabel, themeId, count, apiKey, preferApi = false, maxLength = 15) {
  try {
    return await fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength);
  } catch (firstError) {
    const retryable = String(firstError?.message || '').toLowerCase();
    if (apiKey && (retryable.includes('high demand') || retryable.includes('temporar') || retryable.includes('quota'))) {
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      try {
        return await fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength);
      } catch (secondError) {
        throw secondError;
      }
    }

    throw firstError;
  }
}
