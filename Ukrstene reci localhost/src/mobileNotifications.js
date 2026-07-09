import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const CHANNEL_ID = 'match-challenges';
const SEEN_KEY_PREFIX = 'ukrstene-notified-challenges-';
let notificationPermissionGranted = false;

function challengeId(challenge) {
  return Number(challenge?.ID ?? challenge?.id);
}

function readSeen(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(`${SEEN_KEY_PREFIX}${userId}`) || '[]').map(Number));
  } catch {
    return new Set();
  }
}

function writeSeen(userId, seen) {
  localStorage.setItem(`${SEEN_KEY_PREFIX}${userId}`, JSON.stringify([...seen].slice(-100)));
}

export function isNativeMobileApp() {
  return Capacitor.isNativePlatform();
}

export async function initializeMobileNotifications() {
  if (!isNativeMobileApp()) return false;
  const current = await LocalNotifications.checkPermissions();
  const permission = current.display === 'granted'
    ? current
    : await LocalNotifications.requestPermissions();
  notificationPermissionGranted = permission.display === 'granted';
  if (notificationPermissionGranted && Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Izazovi za meč',
      description: 'Obavještenja kada drugi igrač pošalje izazov.',
      importance: 5,
      visibility: 1,
      vibration: true,
    });
  }
  return notificationPermissionGranted;
}

export async function notifyIncomingChallenges(userId, challenges) {
  if (!isNativeMobileApp() || !notificationPermissionGranted || !userId || !Array.isArray(challenges)) return;
  const seen = readSeen(userId);
  const fresh = challenges.filter((challenge) => {
    const id = challengeId(challenge);
    return Number.isFinite(id) && !seen.has(id);
  });
  if (fresh.length === 0) return;

  await LocalNotifications.schedule({
    notifications: fresh.map((challenge) => {
      const id = challengeId(challenge);
      const sender = challenge.IzazivacIme || 'Prijatelj';
      const theme = challenge.TemaNaziv || challenge.CustomTema || 'izabrana tema';
      const matchMode = challenge.ModMeca === 'race' ? 'Ko će brže' : 'Versus';
      return {
        id: 100000 + (id % 2000000000),
        title: `${sender} te izaziva`,
        body: `${matchMode} · ${theme}`,
        channelId: CHANNEL_ID,
        extra: { challengeId: id },
      };
    }),
  });

  fresh.forEach((challenge) => seen.add(challengeId(challenge)));
  writeSeen(userId, seen);
}

export async function addMobileNotificationListeners({ onResume, onNotificationOpen }) {
  if (!isNativeMobileApp()) return () => {};
  const appStateListener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) onResume?.();
  });
  const notificationListener = await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    onNotificationOpen?.(event.notification?.extra?.challengeId);
  });
  return () => {
    appStateListener.remove();
    notificationListener.remove();
  };
}
