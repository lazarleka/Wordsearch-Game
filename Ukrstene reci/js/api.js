function getFallbackWords(theme, count) {
  const base = DEMO[theme] || (() => {
    const all = Object.values(DEMO).flat();
    return all.filter((_, i) => i % 4 === 0);
  })();

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
- Dužina: 4 do 10 slova
- Samo slova A-Z (bez dijakritika: š->S, č->C, ć->C, đ->D, ž->Z)
- Sve reči velikim slovima
- Reči moraju biti relevantne za temu
- Bez duplikata

Vrati ISKLJUČIVO JSON niz.
Bez markdown-a.
Bez objašnjenja.
Bez uvodnog teksta.
Format odgovora mora biti tačno ovakav:
["REC1","REC2","REC3"]`;

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
      console.warn('Gemini API greška, koristim fallback reči:', err);
      return getFallbackWords(theme, count);
    }

    const data = await res.json();
    console.log('Gemini odgovor:', data);

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!raw) {
      console.warn('Gemini nije vratio tekst, koristim fallback.');
      return getFallbackWords(theme, count);
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
          console.warn('Neuspešan parse izdvojenog JSON-a, koristim fallback.');
          return getFallbackWords(theme, count);
        }
      } else {
        console.warn('Gemini nije vratio validan JSON niz, koristim fallback.');
        return getFallbackWords(theme, count);
      }
    }

    if (!Array.isArray(arr)) {
      console.warn('Gemini odgovor nije niz, koristim fallback.');
      return getFallbackWords(theme, count);
    }

    arr = arr
      .map(w => String(w).toUpperCase().replace(/[^A-Z]/g, ''))
      .filter(w => w.length >= 4 && w.length <= 10);

    arr = [...new Set(arr)];

    if (arr.length < 3) {
      console.warn('Premalo validnih reči od Gemini-ja, koristim fallback.');
      return getFallbackWords(theme, count);
    }

    while (arr.length < count) {
      const fallback = getFallbackWords(theme, count);
      for (const word of fallback) {
        if (!arr.includes(word)) {
          arr.push(word);
        }
        if (arr.length === count) break;
      }
    }

    return arr.slice(0, count);

  } catch (error) {
    console.warn('Greška u fetchWords(), koristim fallback reči:', error);
    return getFallbackWords(theme, count);
  }
}