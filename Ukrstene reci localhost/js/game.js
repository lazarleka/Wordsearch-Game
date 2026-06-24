    function canPlace(word, r, c, dr, dc, n, grid) {
    for (let i = 0; i < word.length; i++) {
        const nr = r + dr * i;
        const nc = c + dc * i;

        if (nr < 0 || nr >= n || nc < 0 || nc >= n) return false;
        if (grid[nr][nc] && grid[nr][nc] !== word[i]) return false;
    }
    return true;
    }

    function buildGrid(words) {
    const n = G.diff.n;
    G.grid = Array.from({ length: n }, () => Array(n).fill(''));
    G.words = [];
    G.pinfo = [];

    for (const word of words) {
        let ok = false;

        for (let t = 0; t < 200 && !ok; t++) {
        const [dr, dc] = DIRS[Math.floor(Math.random() * 8)];
        const r = Math.floor(Math.random() * n);
        const c = Math.floor(Math.random() * n);

        if (canPlace(word, r, c, dr, dc, n, G.grid)) {
            for (let i = 0; i < word.length; i++) {
            G.grid[r + dr * i][c + dc * i] = word[i];
            }

            const col = PALETTE[G.words.length % PALETTE.length];
            G.pinfo.push({ word, r, c, dr, dc, col });
            G.words.push(word);
            ok = true;
        }
        }
    }

    const alpha = 'ABCDEFGHIJKLMNOPRSTUVWZ';

    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
        if (!G.grid[r][c]) {
            G.grid[r][c] = alpha[Math.floor(Math.random() * alpha.length)];
        }
        }
    }
    }

    function cell$(r, c) {
    return document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    }

    function clearPreview() {
    document.querySelectorAll('.cell.prev').forEach(el => el.classList.remove('prev'));
    }

    function startSel(r, c) {
    G.selStart = { r, c };
    G.selCells = [[r, c]];
    clearPreview();
    cell$(r, c)?.classList.add('prev');
    }

    function moveSel(r, c) {
    if (!G.selStart) return;

    const { r: sr, c: sc } = G.selStart;
    const dr = r - sr;
    const dc = c - sc;
    const adr = Math.abs(dr);
    const adc = Math.abs(dc);

    clearPreview();

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
        cell$(sr, sc)?.classList.add('prev');
        G.selCells = [[sr, sc]];
        return;
    }

    const len = Math.max(adr, adc);
    const cells = [];

    for (let i = 0; i <= len; i++) {
        cells.push([sr + ndr * i, sc + ndc * i]);
    }

    G.selCells = cells;
    cells.forEach(([rr, cc]) => cell$(rr, cc)?.classList.add('prev'));
    }
function endSel() {
  if (!G.selStart) return;

  const word = G.selCells.map(([r, c]) => G.grid[r][c]).join('');
  const rev = word.split('').reverse().join('');
  const match = G.words.find(w => (w === word || w === rev) && !G.found.includes(w));

  clearPreview();

  if (match) {
    playSuccessSound();

    const info = G.pinfo.find(p => p.word === match);

    G.selCells.forEach(([r, c]) => {
      const el = cell$(r, c);
      if (el) {
        el.classList.add('done');
        el.classList.remove('prev', 'sel');
        el.style.background = info?.col || 'var(--teal)';
        el.style.color = '#fff';
      }
    });

    G.found.push(match);
    document.getElementById('wt-' + match)?.classList.add('done');
    document.getElementById('fc').textContent = G.found.length;

    if (G.mode === 'duo') {
      stopTurnTimer();

      G.scores[G.cur]++;
      document.getElementById('pv' + (G.cur + 1)).textContent = G.scores[G.cur];

      if (G.found.length === G.words.length) {
        setTimeout(showWin, 500);
      } else {
        G.cur = 1 - G.cur;
        updateTurn();
        showTurnPopup('Pogođena reč!', `Sada igra: ${G.cur === 0 ? G.p1 : G.p2}`);
        startTurnTimer();
      }
    } else {
      if (G.found.length === G.words.length) {
        setTimeout(showWin, 500);
      }
    }
  } else {
    if (G.selCells.length > 1) {
      playFailSound();
    }
  }

  G.selStart = null;
  G.selCells = [];
}
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone({ frequency = 440, duration = 0.12, type = 'sine', volume = 0.03, sweepTo = null } = {}) {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    if (sweepTo) {
      osc.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    console.warn('Sound error:', err);
  }
}

function playSuccessSound() {
  playTone({ frequency: 523.25, duration: 0.09, type: 'sine', volume: 0.025 });

  setTimeout(() => {
    playTone({ frequency: 659.25, duration: 0.11, type: 'sine', volume: 0.02 });
  }, 70);
}

function playFailSound() {
  playTone({ frequency: 220, duration: 0.08, type: 'triangle', volume: 0.015, sweepTo: 180 });
}