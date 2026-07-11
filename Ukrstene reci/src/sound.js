let audioCtx = null;
let soundEnabled = false;
let ambientGain = null;
let ambientTimer = null;
let ambientStep = 0;
let ambientOscillators = [];

export function initSound() {
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

export function startAmbientMusic() {
  try {
    if (!audioCtx) initSound();
    if (!audioCtx || !soundEnabled || ambientTimer) return;

    ambientGain = audioCtx.createGain();
    ambientGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    ambientGain.gain.linearRampToValueAtTime(0.028, audioCtx.currentTime + 1.8);
    ambientGain.connect(audioCtx.destination);

    const chords = [
      [196, 246.94, 293.66],
      [174.61, 220, 261.63],
      [207.65, 246.94, 329.63],
      [164.81, 220, 293.66],
    ];

    const playPad = () => {
      if (!audioCtx || !ambientGain) return;
      const now = audioCtx.currentTime;
      const chord = chords[ambientStep % chords.length];
      chord.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq + (index - 1) * 1.5, now + 4.5);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.16, now + 1.2);
        gain.gain.linearRampToValueAtTime(0.0001, now + 5.8);
        osc.connect(gain);
        gain.connect(ambientGain);
        osc.start(now);
        osc.stop(now + 6);
        ambientOscillators.push(osc);
        osc.onended = () => {
          ambientOscillators = ambientOscillators.filter((item) => item !== osc);
        };
      });
      ambientStep += 1;
    };

    playPad();
    ambientTimer = window.setInterval(playPad, 5200);
  } catch (err) {
    console.warn('Ne mogu da pokrenem ambijentalnu muziku:', err);
  }
}

export function stopAmbientMusic() {
  if (ambientTimer) {
    window.clearInterval(ambientTimer);
    ambientTimer = null;
  }
  ambientOscillators.forEach((osc) => {
    try {
      osc.stop();
    } catch {
      // Oscillator may already be stopped.
    }
  });
  ambientOscillators = [];
  if (ambientGain) {
    try {
      const gainToStop = ambientGain;
      ambientGain = null;
      gainToStop.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.7);
      window.setTimeout(() => gainToStop.disconnect(), 800);
    } catch {
      ambientGain = null;
    }
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

export function playSuccessSound() {
  playTone(650, 0.1, 'sine', 0.07);
  setTimeout(() => playTone(900, 0.12, 'sine', 0.06), 80);
}

export function playFailSound() {
  playTone(320, 0.09, 'triangle', 0.05, 220);
}

export function playWinSound() {
  playTone(523.25, 0.12, 'sine', 0.02);
  setTimeout(() => playTone(659.25, 0.12, 'sine', 0.02), 100);
  setTimeout(() => playTone(783.99, 0.16, 'sine', 0.02), 200);
  setTimeout(() => playTone(1046.5, 0.22, 'sine', 0.025), 320);
}
