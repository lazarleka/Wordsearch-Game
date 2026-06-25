function getFallbackWords(theme, count) {
  const base = DEMO[theme];
  if (!base) {
    throw new Error('Tema nema pripremljene rijeci. Izaberite drugu temu ili probajte ponovo.');
  }

  return [...base]
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map(w => w.toUpperCase());
}


async function fetchWords(theme, count, key) {
  if (!key) {
    console.log('Nema API ključa, koristim fallback reči.');
    return getFallbackWords(theme, count);
  }

  const prompt = `Ti si generator reči za igru osmosmerke. Generiši tačno ${count} reči na srpskom jeziku (latinica) na temu "${theme}".

Pravila:
- Svaka reč mora biti JEDNA reč (bez razmaka i crtice)
- Ukoliko je na primer u pitanju tema film i ukoliko se film sastoji iz vise reci,nemoj da ga saljes,hocu da je jedan pojam samostalna rec i da se ne sastoji iz vise reci.
- Dobro obraziti temu u rečima i nemojte generisati reči koje nisu relevantne za temu
- Dužina: 4 do 10 slova
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

  const aiError = new Error('Nije uspjelo da se generisu rijeci preko AI-a. Probajte ponovo.');

  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 400,
            topP: 0.95
          }
        })
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('Gemini API greska:', err);
      throw aiError;
    }

    const data = await res.json();
    console.log('Gemini odgovor:', data);

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!raw) {
      throw aiError;
    }

    let arr = null;

    try {
      arr = JSON.parse(raw);
    } catch {
      const m = raw.match(/\[[\s\S]*?\]/);
      if (m) {
        try {
          arr = JSON.parse(m[0]);
        } catch {
          throw aiError;
        }
      } else {
        throw aiError;
      }
    }

    if (!Array.isArray(arr)) {
      throw aiError;
    }

    arr = arr
      .map(w => String(w).toUpperCase().replace(/[^A-Z]/g, ''))
      .filter(w => w.length >= 4 && w.length <= 10);

    arr = [...new Set(arr)];

    if (arr.length < 3) {
      throw aiError;
    }

    if (arr.length < count) throw aiError;

    return arr.slice(0, count);

  } catch (error) {
    console.warn('Greska u fetchWords():', error);
    throw aiError;
  }
}
