function goNext(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function setMode(m) {
  G.mode = m;

  ['solo', 'duo'].forEach(x => {
    document.getElementById('tab-' + x).classList.toggle('active', x === m);
  });

  document.getElementById('solo-sec').classList.toggle('hidden', m === 'duo');
  document.getElementById('duo-sec').classList.toggle('hidden', m === 'solo');
}

function setDiff(id, n, wc) {
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('sel'));
  document.getElementById('d-' + id).classList.add('sel');
  G.diff = { n, wc };
}

function pickTheme(el, t) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  G.theme = t;
  document.getElementById('custom').value = '';
}

function showErr(msg) {
  const e = document.getElementById('err');
  e.textContent = msg;
  e.classList.remove('hidden');
  setTimeout(() => e.classList.add('hidden'), 5000);
}

async function launch() {
  const custom = document.getElementById('custom').value.trim();

  if (custom) {
    G.theme = custom;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
  }

  G.p1 = G.mode === 'solo'
    ? (document.getElementById('name-solo').value || 'Igrač')
    : (document.getElementById('name-p1').value || 'Igrač 1');

  G.p2 = document.getElementById('name-p2').value || 'Igrač 2';
  G.scores = [0, 0];
  G.cur = 0;
  G.found = [];
  G.elapsed = 0;

  goNext('s-load');
  document.getElementById('load-msg').textContent =
    G.apiKey
      ? 'Gemini AI generiše tematske reči...'
      : 'Pripremam demo reči za temu: ' + G.theme + '...';

  try {
    const words = await fetchWords(G.theme, G.diff.wc, G.apiKey);
    buildGrid(words);
    renderGame();
    goNext('s-game');
    startTimer();
  } catch (e) {
    showErr('Greška: ' + e.message);
    goNext('s-diff');
  }
}
function goHome() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('turn-popup')?.classList.add('hidden');
  stopTurnTimer();
  goNext('s-mode');
}