import { fetchThemeWordsFromDatabase } from './api.js';

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
        const cells = Array.from({ length: word.length }, (_, i) => [r + dr * i, c + dc * i]);
        placements.push({ word, r, c, dr, dc, cells, color });
        placed.push(word);
        ok = true;
      }
    }
    if (!ok) return null;
  }

  const alpha = 'ABCDEFGHIJKLMNOPRSTUVZ';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!grid[r][c]) {
        grid[r][c] = alpha[Math.floor(random() * alpha.length)];
      }
    }
  }

  return { grid, words: words.filter((word) => placed.includes(word)), placements };
}

function shuffled(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function findSnakePath(word, n, grid, random) {
  const starts = shuffled(Array.from({ length: n * n }, (_, index) => [Math.floor(index / n), index % n]), random);

  function walk(index, r, c, path, used) {
    if (index === word.length) return path;
    const neighbors = shuffled(DIRS, random);
    for (const [dr, dc] of neighbors) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr}-${nc}`;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n || used.has(key) || grid[nr][nc]) continue;
      used.add(key);
      const result = walk(index + 1, nr, nc, [...path, [nr, nc]], used);
      if (result) return result;
      used.delete(key);
    }
    return null;
  }

  for (const [r, c] of starts) {
    if (grid[r][c]) continue;
    const result = walk(1, r, c, [[r, c]], new Set([`${r}-${c}`]));
    if (result) return result;
  }
  return null;
}

function snakePathKey(cells) {
  const forward = cells.map(([r, c]) => `${r}-${c}`).join('|');
  const backward = [...cells].reverse().map(([r, c]) => `${r}-${c}`).join('|');
  return forward < backward ? forward : backward;
}

function findSnakeOccurrenceKeys(word, grid, limit = 2) {
  const n = grid.length;
  const occurrences = new Map();

  function walk(index, r, c, path, used) {
    if (occurrences.size >= limit) return;
    if (index === word.length) {
      occurrences.set(snakePathKey(path), path);
      return;
    }

    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr}-${nc}`;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n || used.has(key) || grid[nr][nc] !== word[index]) continue;
      used.add(key);
      walk(index + 1, nr, nc, [...path, [nr, nc]], used);
      used.delete(key);
      if (occurrences.size >= limit) return;
    }
  }

  for (let r = 0; r < n && occurrences.size < limit; r++) {
    for (let c = 0; c < n && occurrences.size < limit; c++) {
      if (grid[r][c] !== word[0]) continue;
      walk(1, r, c, [[r, c]], new Set([`${r}-${c}`]));
    }
  }

  return occurrences;
}

function hasUniqueSnakePlacements(grid, placements) {
  return placements.every(({ word, cells }) => {
    const occurrences = findSnakeOccurrenceKeys(word, grid);
    return occurrences.size === 1 && occurrences.has(snakePathKey(cells));
  });
}

function findExtraSnakePath(grid, placements) {
  for (const { word, cells } of placements) {
    const intendedKey = snakePathKey(cells);
    const occurrences = findSnakeOccurrenceKeys(word, grid, 3);
    for (const [key, path] of occurrences) {
      if (key !== intendedKey) return path;
    }
  }
  return null;
}

function placementSpellsWord(grid, placement) {
  if (!placement?.word || !Array.isArray(placement.cells)) return false;
  if (placement.cells.length !== placement.word.length) return false;
  for (let index = 0; index < placement.cells.length; index++) {
    const [r, c] = placement.cells[index];
    if (grid[r]?.[c] !== placement.word[index]) return false;
    if (index === 0) continue;
    const [prevR, prevC] = placement.cells[index - 1];
    if (Math.max(Math.abs(prevR - r), Math.abs(prevC - c)) !== 1) return false;
  }
  return true;
}

function validateSnakeGridResult(result, expectedWords) {
  if (!result?.grid?.length || !Array.isArray(result.placements)) return false;
  const expected = new Set(expectedWords);
  const placed = new Set(result.placements.map((placement) => placement.word));
  if (placed.size !== expected.size) return false;
  for (const word of expected) {
    if (!placed.has(word)) return false;
  }
  return result.placements.every((placement) => placementSpellsWord(result.grid, placement));
}

function buildSnakeGridAttempt(words, n, random) {
  const grid = Array.from({ length: n }, () => Array(n).fill(''));
  const placements = [];

  for (const word of [...words].sort((a, b) => b.length - a.length)) {
    let acceptedPlacement = null;
    for (let pathAttempt = 0; pathAttempt < 2500 && !acceptedPlacement; pathAttempt++) {
      const cells = findSnakePath(word, n, grid, random);
      if (!cells) break;
      cells.forEach(([r, c], index) => { grid[r][c] = word[index]; });
      const candidate = { word, r: cells[0][0], c: cells[0][1], cells, color: PALETTE[placements.length % PALETTE.length] };
      if (hasUniqueSnakePlacements(grid, [...placements, candidate])) acceptedPlacement = candidate;
      else cells.forEach(([r, c]) => { grid[r][c] = ''; });
    }
    if (!acceptedPlacement) return null;
    placements.push(acceptedPlacement);
  }

  // Fill naturally, then break only accidental paths by changing their filler cells.
  const naturalAlphabet = 'AAAAABCDEEEEEFGHIIIIJKLLLMMMNNNNOOOOPRRRRSSSSTTTTUVVZ';
  const occupied = new Set(placements.flatMap(({ cells }) => cells.map(([r, c]) => `${r}-${c}`)));
  for (let fillerAttempt = 0; fillerAttempt < 28; fillerAttempt++) {
    const filledGrid = grid.map((row) => [...row]);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!filledGrid[r][c]) filledGrid[r][c] = naturalAlphabet[Math.floor(random() * naturalAlphabet.length)];
      }
    }

    for (let repair = 0; repair < 3200; repair++) {
      const extraPath = findExtraSnakePath(filledGrid, placements);
      if (!extraPath) {
        const result = { grid: filledGrid, words, placements };
        return validateSnakeGridResult(result, words) ? result : null;
      }
      const editableCells = extraPath.filter(([r, c]) => !occupied.has(`${r}-${c}`));
      if (editableCells.length === 0) break;
      const [r, c] = editableCells[Math.floor(random() * editableCells.length)];
      const oldLetter = filledGrid[r][c];
      let nextLetter = oldLetter;
      while (nextLetter === oldLetter) nextLetter = naturalAlphabet[Math.floor(random() * naturalAlphabet.length)];
      filledGrid[r][c] = nextLetter;
    }
  }
  return null;
}

function snakeBoardPath(n, random) {
  const variants = [
    Array.from({ length: n * n }, (_, index) => {
      const r = Math.floor(index / n);
      const offset = index % n;
      return [r, r % 2 === 0 ? offset : n - 1 - offset];
    }),
    Array.from({ length: n * n }, (_, index) => {
      const c = Math.floor(index / n);
      const offset = index % n;
      return [c % 2 === 0 ? offset : n - 1 - offset, c];
    }),
  ];
  const path = variants[Math.floor(random() * variants.length)];
  if (random() > 0.5) path.reverse();
  return path;
}

function buildGuaranteedSnakeGrid(words, n, random) {
  const totalLetters = words.reduce((sum, word) => sum + word.length, 0);
  const size = Math.max(n, Math.ceil(Math.sqrt(totalLetters)));

  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const path = snakeBoardPath(size, random);
  const placements = [];
  const sortedWords = [...words].sort((a, b) => b.length - a.length);
  const totalGap = path.length - totalLetters;
  const gapSlots = sortedWords.length + 1;
  const baseGap = Math.floor(totalGap / gapSlots);
  let extraGap = totalGap % gapSlots;
  let cursor = baseGap + (extraGap > 0 ? 1 : 0);
  if (extraGap > 0) extraGap -= 1;

  for (const word of sortedWords) {
    const cells = path.slice(cursor, cursor + word.length);
    if (cells.length < word.length) return null;
    cells.forEach(([r, c], index) => { grid[r][c] = word[index]; });
    placements.push({
      word,
      r: cells[0][0],
      c: cells[0][1],
      cells,
      color: PALETTE[placements.length % PALETTE.length],
    });
    cursor += word.length;
    cursor += baseGap;
    if (extraGap > 0) {
      cursor += 1;
      extraGap -= 1;
    }
  }

  const fillerAlphabet = 'BCDFGHJKLMNPRSTVZ';
  for (let i = 0; i < path.length; i++) {
    const [r, c] = path[i];
    if (!grid[r][c]) grid[r][c] = fillerAlphabet[Math.floor(random() * fillerAlphabet.length)];
  }

  const result = { grid, words, placements };
  return validateSnakeGridResult(result, words) ? result : null;
}

export function buildGrid(words, n, seed) {
  const maxWordLength = Math.min(n, 12);
  const normalized = [...new Set(words
    .map((word) => String(word).toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((word) => !/[QWX]/.test(word))
    .filter((word) => word.length >= 4 && word.length <= maxWordLength))];

  if (normalized.length === 0) {
    throw new Error('Nema validnih riječi za ovu tablu.');
  }
  for (let attempt = 0; attempt < 80; attempt++) {
    const attemptSeed = seed === undefined || seed === null ? undefined : Number(seed) * 97 + attempt;
    const result = buildGridAttempt(normalized, n, createRandom(attemptSeed));
    if (result) return result;
  }

  throw new Error('Nije moguće smjestiti sve riječi na tablu. Izaberi drugu temu ili veću težinu.');
}

export function buildSnakeGrid(words, n, seed) {
  const maxWordLength = Math.min(n * n, 12);
  const normalized = [...new Set(words
    .map((word) => String(word).toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((word) => !/[QWX]/.test(word))
    .filter((word) => word.length >= 4 && word.length <= maxWordLength))];

  if (normalized.length === 0) throw new Error('Nema validnih riječi za ovu tablu.');
  const totalLetters = normalized.reduce((sum, word) => sum + word.length, 0);
  for (let attempt = 0; attempt < 500; attempt++) {
    const attemptSeed = seed === undefined || seed === null ? undefined : Number(seed) * 97 + attempt;
    if (totalLetters > n * n) break;
    const result = buildSnakeGridAttempt(normalized, n, createRandom(attemptSeed));
    if (validateSnakeGridResult(result, normalized)) return result;
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const attemptSeed = seed === undefined || seed === null ? undefined : Number(seed) * 7919 + attempt;
    const result = buildGuaranteedSnakeGrid(normalized, n, createRandom(attemptSeed));
    if (validateSnakeGridResult(result, normalized)) {
      console.warn('[Osmosmerka] Koristi se garantovani fallback za Zmijicu.', {
        attempt,
        gridSize: n,
        words: normalized,
      });
      return result;
    }
  }
  throw new Error('Nije moguće napraviti putanje Zmijice. Izaberi drugu temu ili veću težinu.');
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
    .filter((word) => !/[QWX]/.test(word))
    .filter((word) => word.length >= 4 && word.length <= maxLength))]
    .slice(0, count);
}

function fitWordsToBudget(words, count, maxLength, maxTotalLetters = Infinity) {
  const normalized = [...new Set(words
    .map((word) => String(word).toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((word) => !/[QWX]/.test(word))
    .filter((word) => word.length >= 4 && word.length <= maxLength))];
  if (!Number.isFinite(maxTotalLetters)) return normalized.slice(0, count);

  let best = null;
  function search(start, selected, total) {
    if (selected.length === count) {
      if (!best || total > best.total) best = { words: selected, total };
      return;
    }
    const needed = count - selected.length;
    if (normalized.length - start < needed) return;

    for (let index = start; index <= normalized.length - needed; index++) {
      const word = normalized[index];
      const nextTotal = total + word.length;
      if (nextTotal > maxTotalLetters) continue;
      search(index + 1, [...selected, word], nextTotal);
    }
  }

  search(0, [], 0);
  return best ? best.words : [];
}

const AI_WORD_ATTEMPTS = 5;
const AI_GENERATION_ERROR = 'Nije uspjelo da se generišu riječi preko AI-a. Probajte ponovo.';

async function fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi = false, maxLength = 15, attempt = 1, options = {}) {
  const maxTotalLetters = options.maxTotalLetters ?? Infinity;
  if (!preferApi) {
    let validWords = [];
    try {
      const dbWords = await fetchThemeWordsFromDatabase(themeId, Math.max(count * 4, 30));
      validWords = Array.isArray(dbWords) ? fitWordsToBudget(dbWords, count, maxLength, maxTotalLetters) : [];
      if (validWords.length === count) {
        return validWords;
      }
    } catch {
      throw new Error('Rijeci za predlozenu temu moraju doci iz baze. Provjerite da li je backend pokrenut.');
    }

    throw new Error(`Tema "${themeLabel}" nema dovoljno rijeci u bazi za ovu tezinu.`);
  }

  if (!apiKey) {
    throw new Error('API kljuc nije podesen za temu po izboru.');
  }

 const prompt = `Ti si generator riječi za igru osmosmjerke. Generiši najmanje ${count * 2} riječi na srpskom jeziku (latinica) na temu "${themeLabel}".

Pravila:
- Svaka riječ mora biti JEDNA riječ (bez razmaka i crtice)
- Ukoliko je, na primjer, u pitanju tema film i naziv filma se sastoji iz više riječi, nemoj da ga šalješ. Jedan pojam mora biti samostalna riječ i ne smije se sastojati iz više riječi.
- Dobro obradi temu u riječima i nemoj generisati riječi koje nisu relevantne za temu.
- Dužina: 4 do ${maxLength} slova
- Samo slova A-Z (bez dijakritika: š->S, č->C, č->C, đ->D, ž->Z)
- Sve re?i velikim slovima
- Re?i moraju biti relevantne za temu
- Bez duplikata
${Number.isFinite(maxTotalLetters) ? `- Za Zmijica mod ukupno slova u izabranih ${count} rijeci mora biti najvise ${maxTotalLetters}. Biraj krace pojmove da tabla ima dovoljno prostora za razdvojene zmijaste putanje.` : ''}
${Number.isFinite(maxTotalLetters) ? '- Nemoj birati samo rijeci od 4 slova. Napravi prirodnu kombinaciju kracih i srednjih rijeci, dok ukupno slova ostaje u ogranicenju.' : ''}
- Prije slanja obavezno provjeri da li su sva pravila ispoštovana. Ako nisu, generiši ponovo dok ne budu ispoštovana sva pravila.



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
      return fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength, attempt + 1, options);
    }
    throw new Error(AI_GENERATION_ERROR);
  }


  if (!response.ok) {
    if (attempt < AI_WORD_ATTEMPTS) {
      return fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength, attempt + 1, options);
    }
    throw new Error(AI_GENERATION_ERROR);
    throw new Error(data?.error?.message || 'Greška pri pozivu AI-a');
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    if (attempt < AI_WORD_ATTEMPTS) {
      return fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength, attempt + 1, options);
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
      return fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength, attempt + 1, options);
    }
    throw new Error(AI_GENERATION_ERROR);
    throw new Error('AI nije vratio ispravne podatke. Pokušajte ponovo.');
  }

  if (!Array.isArray(words) || words.length === 0) {
    if (attempt < AI_WORD_ATTEMPTS) {
      return fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength, attempt + 1, options);
    }
    throw new Error(AI_GENERATION_ERROR);
    throw new Error('AI nije vratio nijednu riječ.');
  }

  const validWords = fitWordsToBudget(words, count, maxLength, maxTotalLetters);
  if (validWords.length < count) {
    if (attempt < AI_WORD_ATTEMPTS) {
      return fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength, attempt + 1, options);
    }
    throw new Error(AI_GENERATION_ERROR);
    throw new Error(`AI nije vratio dovoljno riječi do ${maxLength} slova. Pokušaj ponovo.`);
  }
  return validWords;
}

export async function fetchWords(themeLabel, themeId, count, apiKey, preferApi = false, maxLength = 15, options = {}) {
  try {
    return await fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength, 1, options);
  } catch (firstError) {
    const retryable = String(firstError?.message || '').toLowerCase();
    if (apiKey && (retryable.includes('high demand') || retryable.includes('temporar') || retryable.includes('quota'))) {
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      try {
        return await fetchWordsFromSource(themeLabel, themeId, count, apiKey, preferApi, maxLength, 1, options);
      } catch (secondError) {
        throw secondError;
      }
    }

    throw firstError;
  }
}

