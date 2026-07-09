const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8082').replace(/\/$/, '');
const API_URL = import.meta.env.VITE_API_URL || `${BACKEND_URL}/api`;
const AUTH_URL = import.meta.env.VITE_AUTH_URL || `${BACKEND_URL}/auth`;
export const WS_URL = import.meta.env.VITE_WS_URL || `${BACKEND_URL.replace(/^http/, 'ws')}/ws/live`;
const REQUEST_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Backend nije dostupan. Provjeri Wi-Fi/IP adresu i pokreni backend.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function getJson(path) {
  const response = await fetchWithTimeout(`${API_URL}${path}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'API greška');
  }
  return response.json();
}

async function sendJson(baseUrl, path, body) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? tryJson(text) : null;
  if (!response.ok) throw new Error(data?.error || data || 'API greška');
  return data;
}

function tryJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function fetchThemesFromDatabase() {
  return getJson('/themes');
}

export async function fetchThemeWordsFromDatabase(themeId, count) {
  return getJson(`/themes/${encodeURIComponent(themeId)}/words?count=${count}`);
}

export function loginUser(payload) {
  return sendJson(AUTH_URL, '/login', payload);
}

export function registerUser(payload) {
  return sendJson(AUTH_URL, '/register', payload);
}

export function searchUsers(search) {
  return getJson(`/users?search=${encodeURIComponent(search || '')}`);
}

export function getFriends(userId) {
  return getJson(`/users/${userId}/friends`);
}

export function getFriendships(userId) {
  return getJson(`/users/${userId}/friendships`);
}

export function getFriendsPage(userId) {
  return getJson(`/users/${userId}/friends-page`);
}

export function requestFriend(fromUserId, toUserId) {
  return sendJson(API_URL, '/friends/request', { fromUserId, toUserId });
}

export function acceptFriend(id) {
  return sendJson(API_URL, `/friends/${id}/accept`, {});
}

export function getChallenges(userId) {
  return getJson(`/users/${userId}/challenges`);
}

export function getOutgoingChallenges(userId) {
  return getJson(`/users/${userId}/outgoing-challenges`);
}

export async function getActiveMatch(userId) {
  const response = await fetchWithTimeout(`${API_URL}/users/${userId}/active-match`);
  if (response.status === 204) return null;
  if (!response.ok) throw new Error('API greška');
  return response.json();
}

export async function getMatchResult(matchId, userId) {
  const response = await fetchWithTimeout(`${API_URL}/matches/${matchId}/result/${userId}`);
  if (response.status === 204) return null;
  if (!response.ok) throw new Error('API greška');
  return response.json();
}

export function createChallenge(payload) {
  return sendJson(API_URL, '/challenges', payload);
}

export function acceptChallenge(id, userId) {
  return sendJson(API_URL, `/challenges/${id}/accept`, { userId });
}

export function rejectChallenge(id, userId) {
  return sendJson(API_URL, `/challenges/${id}/reject`, { userId });
}

export function updateMatchProgress(matchId, payload) {
  return sendJson(API_URL, `/matches/${matchId}/progress`, payload);
}

export function finishMatch(matchId) {
  return sendJson(API_URL, `/matches/${matchId}/finish`, {});
}

export function saveSoloResult(payload) {
  return sendJson(API_URL, '/solo-results', payload);
}

export function forfeitMatch(matchId, payload) {
  return sendJson(API_URL, `/matches/${matchId}/forfeit`, payload);
}

export function getLeaderboard() {
  return getJson('/leaderboard');
}

export function getMatchHistory(userId) {
  return getJson(`/users/${userId}/matches`);
}

export function getAchievements(userId) {
  return getJson(`/users/${userId}/achievements`);
}

export function submitTheme(payload) {
  return sendJson(API_URL, '/themes/submit', payload);
}

export function getPendingThemeSubmissions() {
  return getJson('/admin/theme-submissions');
}

export function approveThemeSubmission(id, adminUserId) {
  return sendJson(API_URL, `/admin/theme-submissions/${id}/approve`, { adminUserId });
}

export function getAdminDashboard(adminUserId) {
  return getJson(`/admin/dashboard?adminUserId=${encodeURIComponent(adminUserId)}`);
}

export function createAdminTheme(payload) {
  return sendJson(API_URL, '/admin/themes', payload);
}

export function updateAdminTheme(id, payload) {
  return sendJson(API_URL, `/admin/themes/${encodeURIComponent(id)}`, payload);
}

export function deleteAdminTheme(adminUserId, id) {
  return fetchWithTimeout(`${API_URL}/admin/themes/${encodeURIComponent(id)}?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'DELETE' })
    .then(async (response) => {
      const text = await response.text();
      const data = text ? tryJson(text) : null;
      if (!response.ok) throw new Error(data?.error || data || 'API greška');
      return data;
    });
}

export function createAdminWord(payload) {
  return sendJson(API_URL, '/admin/words', payload);
}

export function updateAdminWord(id, payload) {
  return sendJson(API_URL, `/admin/words/${encodeURIComponent(id)}`, payload);
}

export function deleteAdminWord(adminUserId, id) {
  return fetchWithTimeout(`${API_URL}/admin/words/${encodeURIComponent(id)}?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'DELETE' })
    .then(async (response) => {
      const text = await response.text();
      const data = text ? tryJson(text) : null;
      if (!response.ok) throw new Error(data?.error || data || 'API greška');
      return data;
    });
}

export function approveAdminThemeSubmission(adminUserId, id) {
  return sendJson(API_URL, `/admin/theme-submissions/${id}/approve`, { adminUserId });
}

export function rejectAdminThemeSubmission(adminUserId, id) {
  return sendJson(API_URL, `/admin/theme-submissions/${id}/reject`, { adminUserId });
}
