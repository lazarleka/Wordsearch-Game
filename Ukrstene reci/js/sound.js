let audioCtx = null;
let soundEnabled = false;

function initSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    soundEnabled = true;
  } catch (err) {
    console.warn('Ne mogu da pokrenem zvuk:', err);
  }
}

function playTone(freq, duration = 0.12, type = 'sine', volume = 0.02, sweepTo = null) {
  try {
    if (!audioCtx) initSound();
    if (!audioCtx || !soundEnabled) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    if (sweepTo) {
      osc.frequency.linearRampToValueAtTime(sweepTo, now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.linearRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + duration);
  } catch (err) {
    console.warn('Greška pri puštanju zvuka:', err);
  }
}

function playSuccessSound() {
  playTone(650, 0.10, 'sine', 0.07);
  setTimeout(() => playTone(900, 0.12, 'sine', 0.06), 80);
}

function playFailSound() {
  playTone(320, 0.09, 'triangle', 0.05, 220);
}

function playWinSound() {
  playTone(523.25, 0.12, 'sine', 0.02);   // C5
  setTimeout(() => playTone(659.25, 0.12, 'sine', 0.02), 100); // E5
  setTimeout(() => playTone(783.99, 0.16, 'sine', 0.02), 200); // G5
  setTimeout(() => playTone(1046.5, 0.22, 'sine', 0.025), 320); // C6
}