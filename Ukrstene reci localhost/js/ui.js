function renderGame() {
  const n = G.diff.n;
  const mw = Math.min(window.innerWidth - 24, 580);
  const cs = Math.floor(mw / n);

  const gc = document.getElementById('grid');
  gc.style.gridTemplateColumns = `repeat(${n},${cs}px)`;
  gc.innerHTML = '';

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const el = document.createElement('div');
      el.className = 'cell';
      el.style.width = cs + 'px';
      el.style.height = cs + 'px';
      el.style.fontSize = Math.max(10, Math.min(cs * 0.52, 22)) + 'px';
      el.textContent = G.grid[r][c];
      el.dataset.r = r;
      el.dataset.c = c;

      el.addEventListener('mousedown', e => {
        e.preventDefault();
        startSel(r, c);
      });

      el.addEventListener('mouseover', () => moveSel(r, c));

      el.addEventListener('touchstart', e => {
        e.preventDefault();
        startSel(r, c);
      }, { passive: false });

      el.addEventListener('touchmove', e => {
        e.preventDefault();
        const t = e.touches[0];
        const hit = document.elementFromPoint(t.clientX, t.clientY);
        if (hit?.dataset?.r !== undefined) {
          moveSel(+hit.dataset.r, +hit.dataset.c);
        }
      }, { passive: false });

      gc.appendChild(el);
    }
  }

  document.addEventListener('mouseup', endSel, { once: false });
  document.addEventListener('touchend', endSel, { once: false });

  document.getElementById('g-theme').textContent = '📚 ' + G.theme;
  document.getElementById('fc').textContent = 0;
  document.getElementById('tc').textContent = G.words.length;

  const soloH = document.getElementById('solo-hdr');
  const duoH = document.getElementById('duo-hdr');
  const ctL = document.getElementById('cur-turn-label');
  const turnTimer = document.getElementById('turn-timer');

  if (G.mode === 'solo') {
    soloH.classList.remove('hidden');
    duoH.classList.add('hidden');
    ctL.classList.add('hidden');
    turnTimer?.classList.add('hidden');
    stopTurnTimer();
  } else {
    soloH.classList.add('hidden');
    duoH.classList.remove('hidden');
    ctL.classList.remove('hidden');
    turnTimer?.classList.remove('hidden');

    document.getElementById('pn1').textContent = G.p1;
    document.getElementById('pn2').textContent = G.p2;
    document.getElementById('pv1').textContent = 0;
    document.getElementById('pv2').textContent = 0;

    G.cur = 0;
    updateTurn();
    showTurnPopup('Početak igre', `Prvi igra: ${G.p1}`);
    startTurnTimer();
  }

  const wl = document.getElementById('wlist');
  wl.innerHTML = G.words.map(w => `<div class="wtag" id="wt-${w}">${w}</div>`).join('');
}

function updateTurn() {
  const l = document.getElementById('cur-turn-label');
  l.textContent = 'Na potezu: ' + (G.cur === 0 ? G.p1 : G.p2);

  document.getElementById('psc1').classList.toggle('cur', G.cur === 0);
  document.getElementById('psc2').classList.toggle('cur', G.cur === 1);
}

function startTimer() {
  clearInterval(G.tint);
  G.elapsed = 0;

  G.tint = setInterval(() => {
    G.elapsed++;
    const m = String(Math.floor(G.elapsed / 60)).padStart(2, '0');
    const s = String(G.elapsed % 60).padStart(2, '0');
    document.getElementById('timer').textContent = m + ':' + s;
  }, 1000);
}

function fmtTime() {
  const m = String(Math.floor(G.elapsed / 60)).padStart(2, '0');
  const s = String(G.elapsed % 60).padStart(2, '0');
  return m + ':' + s;
}

function startTurnTimer() {
  clearInterval(G.turnTint);
  G.turnLeft = G.turnTime;

  const turnTimer = document.getElementById('turn-timer');
  const turnLeft = document.getElementById('turn-left');

  if (turnTimer) turnTimer.classList.remove('hidden');
  if (turnLeft) turnLeft.textContent = G.turnLeft;

  G.turnTint = setInterval(() => {
    G.turnLeft--;

    if (turnLeft) {
      turnLeft.textContent = G.turnLeft;
    }

    if (G.turnLeft <= 0) {
      clearInterval(G.turnTint);
      handleTurnTimeout();
    }
  }, 1000);
}

function stopTurnTimer() {
  clearInterval(G.turnTint);
}

function handleTurnTimeout() {
  G.selStart = null;
  G.selCells = [];
  clearPreview();

  playFailSound();

  G.cur = 1 - G.cur;
  updateTurn();
  showTurnPopup('Vreme je isteklo!', `Na redu je sada: ${G.cur === 0 ? G.p1 : G.p2}`);
  startTurnTimer();
}

function showTurnPopup(title, msg) {
  const popup = document.getElementById('turn-popup');
  const titleEl = document.getElementById('turn-popup-title');
  const msgEl = document.getElementById('turn-popup-msg');

  if (!popup || !titleEl || !msgEl) return;

  titleEl.textContent = title;
  msgEl.textContent = msg;
  popup.classList.remove('hidden');

  setTimeout(() => {
    popup.classList.add('hidden');
  }, 1500);
}

function endGame() {
  clearInterval(G.tint);
  stopTurnTimer();
  showWin();
}

function showWin() {
  stopTurnTimer();
  clearInterval(G.tint);
  playWinSound();

  const modal = document.getElementById('modal');
  modal.classList.remove('hidden');

  if (G.mode === 'solo') {
    const pct = Math.round(G.found.length / G.words.length * 100);
    document.getElementById('m-icon').textContent = G.found.length === G.words.length ? '🏆' : '⏱️';
    document.getElementById('m-title').textContent = 'Bravo, ' + G.p1 + '!';
    document.getElementById('m-score').textContent = fmtTime();
    document.getElementById('m-msg').textContent =
      `Pronašao/la si ${G.found.length} od ${G.words.length} reči (${pct}%) za ${fmtTime()}.`;
  } else {
    const w = G.scores[0] > G.scores[1]
      ? G.p1
      : G.scores[1] > G.scores[0]
        ? G.p2
        : null;

    document.getElementById('m-icon').textContent = w ? '🏆' : '🤝';
    document.getElementById('m-title').textContent = w ? ('Pobedio/la ' + w + '!') : 'Nerešeno!';
    document.getElementById('m-score').textContent = G.scores[0] + ' – ' + G.scores[1];
    document.getElementById('m-msg').textContent =
      `${G.p1}: ${G.scores[0]} bod. | ${G.p2}: ${G.scores[1]} bod.\nVreme: ${fmtTime()}`;
  }
}

function replay() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('turn-popup')?.classList.add('hidden');
  stopTurnTimer();
  goNext('s-diff');
}

document.addEventListener('click', initSound, { once: true });
document.addEventListener('touchstart', initSound, { once: true });