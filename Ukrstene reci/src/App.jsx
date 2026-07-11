import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  Gamepad2,
  History,
  LogOut,
  Pencil,
  Plus,
  Search,
  Save,
  ShieldCheck,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';
import {
  WS_URL,
  acceptChallenge,
  acceptFriend,
  approveAdminThemeSubmission,
  createChallenge,
  createAdminTheme,
  createAdminWord,
  deleteAdminTheme,
  deleteAdminWord,
  fetchThemesFromDatabase,
  finishMatch,
  forfeitMatch,
  getActiveMatch,
  getAdminDashboard,
  getChallenges,
  getFriendsPage,
  getLeaderboard,
  getMatchResult,
  getMatchHistory,
  getOutgoingChallenges,
  loginUser,
  rejectChallenge,
  rejectAdminThemeSubmission,
  registerUser,
  requestFriend,
  updateAdminTheme,
  updateAdminWord,
  updateMatchProgress,
} from './api.js';
import { DIFFICULTIES, THEMES } from './data.js';
import { buildGrid, cellsForSelection, fetchWords, getSelectedWord } from './gameLogic.jsx';
import { initSound, playFailSound, playSuccessSound, playWinSound, startAmbientMusic, stopAmbientMusic } from './sound.js';

const defaultDiff = DIFFICULTIES[0];
const turnSeconds = 20;
const SOLO_GAME_LIMIT_SECONDS = 300;
const GRID_GENERATION_ATTEMPTS = 4;
const PLAYER_COLORS = ['#ff4b6e', '#00d9b0'];
const emptyAuthForm = { korisnickoIme: '', ime: '', prezime: '', email: '', lozinka: '' };
const emptyThemeForm = { id: '', label: '' };
const emptyWordForm = { themeId: '', word: '', difficulty: 'sve' };

function entityId(item) {
  return item?.ID ?? item?.id;
}

function parseStoredWords(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function displayThemeLabel(label) {
  return label === 'Zivotinje' ? 'Životinje' : label;
}

function matchOutcome(match, userId) {
  if (!match?.Pobjednik_ID) return { label: 'Neriješeno', className: 'draw' };
  return Number(match.Pobjednik_ID) === Number(userId)
    ? { label: 'Pobjeda', className: 'win' }
    : { label: 'Poraz', className: 'loss' };
}

function Screen({ active, children, className = '', inert = false }) {
  return (
    <section
      aria-hidden={!active || inert ? 'true' : undefined}
      className={`screen ${active ? 'active' : ''} ${className}`}
      inert={inert ? '' : undefined}
    >
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="empty-state">
      <Icon size={24} strokeWidth={1.8} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function SectionHeader({ eyebrow, title, text }) {
  return (
    <header className="section-header">
      {eyebrow && <span>{eyebrow}</span>}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </header>
  );
}

function App() {
  const [screen, setScreen] = useState(() => (localStorage.getItem('ukrstene-user') ? 'home' : 'auth'));
  const [activeTab, setActiveTab] = useState('play');
  const [authMode, setAuthMode] = useState('login');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ukrstene-user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [mode, setMode] = useState('solo');
  const [onlineOpponent, setOnlineOpponent] = useState(null);
  const [selectedVersusFriend, setSelectedVersusFriend] = useState(null);
  const [activeMatch, setActiveMatch] = useState(null);
  const [playerTwo, setPlayerTwo] = useState('');
  const [diff, setDiff] = useState(defaultDiff);
  const [theme, setTheme] = useState(THEMES[0]);
  const [themeOptions, setThemeOptions] = useState(THEMES);
  const [customTheme, setCustomTheme] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [gridData, setGridData] = useState({ grid: [], words: [], placements: [] });
  const [found, setFound] = useState([]);
  const [doneCells, setDoneCells] = useState({});
  const [wordColors, setWordColors] = useState({});
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionCells, setSelectionCells] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [scores, setScores] = useState([0, 0]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [turnLeft, setTurnLeft] = useState(turnSeconds);
  const [result, setResult] = useState(null);
  const [turnPopup, setTurnPopup] = useState(null);
  const [opponentNotice, setOpponentNotice] = useState(null);
  const [dismissedChallengeId, setDismissedChallengeId] = useState(null);
  const [friendSearch, setFriendSearch] = useState('');
  const [challengeClock, setChallengeClock] = useState(Date.now());
  const [challengeDeadline, setChallengeDeadline] = useState(0);
  const [challengeSending, setChallengeSending] = useState(false);
  const [friendActionId, setFriendActionId] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [confirmExit, setConfirmExit] = useState(false);
  const [socialReady, setSocialReady] = useState(false);
  const [social, setSocial] = useState({ friends: [], friendships: [], allUsers: [], challenges: [], outgoingChallenges: [], activeMatch: null, leaderboard: [], history: [] });
  const [adminData, setAdminData] = useState({ themes: [], words: [], submissions: [] });
  const [adminLoading, setAdminLoading] = useState(false);
  const [themeForm, setThemeForm] = useState(emptyThemeForm);
  const [editingThemeId, setEditingThemeId] = useState(null);
  const [wordForm, setWordForm] = useState(emptyWordForm);
  const [editingWordId, setEditingWordId] = useState(null);

  const timerRef = useRef(null);
  const soloLimitTimerRef = useRef(null);
  const gameStartedAtRef = useRef(null);
  const turnTimerRef = useRef(null);
  const opponentNoticeTimerRef = useRef(null);
  const previousOpponentScoreRef = useRef(0);
  const opponentNoticeReadyRef = useRef(false);
  const launchingMatchRef = useRef(null);
  const liveRefreshRef = useRef(false);
  const finishingRef = useRef(false);
  const latestFoundRef = useRef([]);
  const latestScoresRef = useRef([0, 0]);
  const latestElapsedRef = useRef(0);
  const finishGameRef = useRef(null);

  const names = useMemo(() => {
    if (mode === 'versus') {
      return {
        p1: user?.korisnickoIme || user?.ime || 'Igrač',
        p2: onlineOpponent?.korisnickoIme || onlineOpponent?.IzazivacIme || 'Prijatelj',
      };
    }
    return {
      p1: user?.korisnickoIme || user?.ime || 'Igrač 1',
      p2: playerTwo.trim() || 'Igrač 2',
    };
  }, [mode, onlineOpponent, playerTwo, user]);

  const selectedKeys = useMemo(() => new Set(selectionCells.map(([r, c]) => `${r}-${c}`)), [selectionCells]);
  const friendshipByUser = useMemo(
    () => new Map(social.friendships.map((item) => [Number(item.DrugiKorisnik_ID), item])),
    [social.friendships],
  );
  const registeredUsers = useMemo(
    () => social.allUsers.filter((item) => entityId(item) !== entityId(user)),
    [social.allUsers, user],
  );
  const filteredRegisteredUsers = useMemo(() => {
    const query = friendSearch.trim().toLocaleLowerCase('bs');
    if (!query) return registeredUsers;
    return registeredUsers.filter((item) => (
      [item.korisnickoIme, item.ime, item.prezime]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('bs')
        .includes(query)
    ));
  }, [friendSearch, registeredUsers]);
  const incomingFriendRequests = useMemo(
    () => social.friendships.filter((item) => item.Status === 'na_cekanju' && Number(item.Primalac_ID) === entityId(user)),
    [social.friendships, user],
  );
  const isAdmin = user?.uloga === 'admin';
  const currentThemeLabel = customTheme.trim() || theme.label;
  const selectedOutgoingChallenge = useMemo(
    () => social.outgoingChallenges.find((item) => Number(item.Protivnik_ID) === entityId(selectedVersusFriend)),
    [selectedVersusFriend, social.outgoingChallenges],
  );
  const incomingChallenge = social.challenges[0] || null;
  const outgoingChallenge = social.outgoingChallenges[0] || null;
  const challengeDialog = incomingChallenge || outgoingChallenge;
  const challengeDifficulty = DIFFICULTIES.find((item) => item.id === challengeDialog?.Tezina);
  const challengeSecondsLeft = challengeDialog
    ? Math.max(0, challengeDeadline
      ? Math.ceil((challengeDeadline - challengeClock) / 1000)
      : Number(challengeDialog.PreostaloSekundi ?? 15))
    : 0;
  const gridSize = gridData.grid.length;
  const mobilePagePadding = viewportWidth <= 520 ? 20 : viewportWidth <= 760 ? 32 : 48;
  const gridGap = viewportWidth <= 520 ? 2 : 3;
  const availableGridWidth = Math.min(viewportWidth - mobilePagePadding, 580);
  const cellSize = gridSize
    ? Math.max(17, Math.floor((availableGridWidth - gridGap * (gridSize - 1)) / gridSize))
    : 32;

  useEffect(() => {
    const updateViewport = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    latestFoundRef.current = found;
    latestScoresRef.current = scores;
    latestElapsedRef.current = elapsed;
  }, [elapsed, found, scores]);

  useEffect(() => {
    if (error.includes('moraju imati od 4')) {
      setError('');
    }
  }, [error]);

  const refreshThemes = useCallback(() => {
    fetchThemesFromDatabase()
      .then((dbThemes) => {
        if (!Array.isArray(dbThemes) || dbThemes.length === 0) return;
        const nextThemes = dbThemes.map((item) => ({
          id: item.id,
          label: item.id === 'zivotinje' ? 'Životinje' : item.label,
        }));
        setThemeOptions(nextThemes);
        setTheme((current) => nextThemes.find((item) => item.id === current.id) || nextThemes[0]);
      })
      .catch(() => setThemeOptions(THEMES));
  }, []);

  const refreshSocial = useCallback(async () => {
    if (!user || user.uloga === 'admin') return;
    const [friendsPage, challenges, outgoingChallenges, currentMatch, leaderboard, history] = await Promise.all([
      getFriendsPage(entityId(user)),
      getChallenges(entityId(user)),
      getOutgoingChallenges(entityId(user)),
      getActiveMatch(entityId(user)),
      getLeaderboard(),
      getMatchHistory(entityId(user)),
    ]);
    setChallengeClock(Date.now());
    setSocial({
      friends: friendsPage.friends || [],
      friendships: friendsPage.friendships || [],
      allUsers: friendsPage.users || [],
      challenges,
      outgoingChallenges,
      activeMatch: currentMatch,
      leaderboard,
      history,
    });
    setSocialReady(true);
  }, [user]);

  const refreshAdmin = useCallback(async () => {
    if (!user || user.uloga !== 'admin') return;
    setAdminLoading(true);
    try {
      const data = await getAdminDashboard(entityId(user));
      setAdminData({
        themes: data.themes || [],
        words: data.words || [],
        submissions: data.submissions || [],
      });
    } finally {
      setAdminLoading(false);
    }
  }, [user]);

  async function saveAdminTheme() {
    setError('');
    try {
      const payload = { adminUserId: entityId(user), ...themeForm };
      if (editingThemeId) {
        await updateAdminTheme(editingThemeId, payload);
        setNotice('Tema je izmijenjena.');
      } else {
        await createAdminTheme(payload);
        setNotice('Tema je dodata.');
      }
      setThemeForm(emptyThemeForm);
      setEditingThemeId(null);
      await Promise.all([refreshAdmin(), refreshThemes()]);
    } catch (err) {
      setError(err.message || 'Tema nije sacuvana.');
    }
  }

  async function removeAdminTheme(id) {
    if (!window.confirm('Obrisati temu i njene rijeci iz baze?')) return;
    setError('');
    try {
      await deleteAdminTheme(entityId(user), id);
      setNotice('Tema je obrisana.');
      if (editingThemeId === id) {
        setEditingThemeId(null);
        setThemeForm(emptyThemeForm);
      }
      await Promise.all([refreshAdmin(), refreshThemes()]);
    } catch (err) {
      setError(err.message || 'Tema nije obrisana.');
    }
  }

  async function saveAdminWord() {
    setError('');
    try {
      const payload = { adminUserId: entityId(user), ...wordForm };
      if (editingWordId) {
        await updateAdminWord(editingWordId, payload);
        setNotice('Rijec je izmijenjena.');
      } else {
        await createAdminWord(payload);
        setNotice('Rijec je dodata.');
      }
      setWordForm(emptyWordForm);
      setEditingWordId(null);
      await Promise.all([refreshAdmin(), refreshThemes()]);
    } catch (err) {
      setError(err.message || 'Rijec nije sacuvana.');
    }
  }

  async function removeAdminWord(id) {
    if (!window.confirm('Obrisati rijec iz baze?')) return;
    setError('');
    try {
      await deleteAdminWord(entityId(user), id);
      setNotice('Rijec je obrisana.');
      if (editingWordId === id) {
        setEditingWordId(null);
        setWordForm(emptyWordForm);
      }
      await Promise.all([refreshAdmin(), refreshThemes()]);
    } catch (err) {
      setError(err.message || 'Rijec nije obrisana.');
    }
  }

  async function handleSubmissionAction(id, action) {
    setError('');
    try {
      if (action === 'approve') {
        await approveAdminThemeSubmission(entityId(user), id);
        setNotice('Predlog teme je odobren.');
      } else {
        await rejectAdminThemeSubmission(entityId(user), id);
        setNotice('Predlog teme je odbijen.');
      }
      await Promise.all([refreshAdmin(), refreshThemes()]);
    } catch (err) {
      setError(err.message || 'Predlog nije obradjen.');
    }
  }

  const refreshFriendsPage = useCallback(async () => {
    if (!user) return;
    const friendsPage = await getFriendsPage(entityId(user));
    setSocial((current) => ({
      ...current,
      friends: friendsPage.friends || [],
      friendships: friendsPage.friendships || [],
      allUsers: friendsPage.users || [],
    }));
  }, [user]);

  const showOpponentNotice = useCallback((foundCount) => {
    window.clearTimeout(opponentNoticeTimerRef.current);
    setOpponentNotice({ id: Date.now(), foundCount });
    opponentNoticeTimerRef.current = window.setTimeout(() => setOpponentNotice(null), 1800);
  }, []);

  const refreshLiveSocial = useCallback(async () => {
    if (!user || user.uloga === 'admin' || liveRefreshRef.current) return;
    liveRefreshRef.current = true;
    try {
      const [challenges, outgoingChallenges, currentMatch] = await Promise.all([
        getChallenges(entityId(user)),
        getOutgoingChallenges(entityId(user)),
        getActiveMatch(entityId(user)),
      ]);
      if (mode === 'versus' && screen === 'game' && entityId(activeMatch) && entityId(currentMatch) === entityId(activeMatch)) {
        const nextOpponentScore = Number(currentMatch?.ProtivnikBrojPronadjenih || 0);
        setScores((current) => [current[0], nextOpponentScore]);
      }
      setSocial((current) => ({
        ...current,
        challenges,
        outgoingChallenges,
        activeMatch: currentMatch,
      }));
    } finally {
      liveRefreshRef.current = false;
    }
  }, [activeMatch, mode, screen, user]);

  useEffect(() => {
    refreshThemes();
  }, [refreshThemes]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem('ukrstene-user', JSON.stringify(user));
    refreshSocial();
  }, [refreshSocial, user]);

  useEffect(() => {
    if (isAdmin && activeTab !== 'admin') {
      setActiveTab('admin');
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab === 'admin' && isAdmin) {
      refreshAdmin().catch((err) => setError(err.message || 'Admin podaci nisu ucitani.'));
    }
  }, [activeTab, isAdmin, refreshAdmin]);

  useEffect(() => {
    if (!user || user.uloga === 'admin') return undefined;
    const poll = window.setInterval(refreshLiveSocial, 3000);
    return () => window.clearInterval(poll);
  }, [refreshLiveSocial, user]);

  useEffect(() => {
    if (!challengeDialog) {
      setChallengeDeadline(0);
      return undefined;
    }
    setChallengeDeadline(Date.now() + Number(challengeDialog.PreostaloSekundi ?? 15) * 1000);
    setChallengeClock(Date.now());
    const countdown = window.setInterval(() => setChallengeClock(Date.now()), 250);
    return () => window.clearInterval(countdown);
  }, [challengeDialog?.ID]);

  useEffect(() => {
    if (challengeDialog && challengeSecondsLeft === 0) {
      setNotice('Vrijeme za odgovor na izazov je isteklo.');
      const expiredId = entityId(challengeDialog);
      setSocial((current) => ({
        ...current,
        challenges: current.challenges.filter((item) => entityId(item) !== expiredId),
        outgoingChallenges: current.outgoingChallenges.filter((item) => entityId(item) !== expiredId),
      }));
      refreshLiveSocial();
    }
  }, [challengeDialog, challengeSecondsLeft, refreshLiveSocial]);

  useEffect(() => {
    if (!user || user.uloga === 'admin') return;
    const socket = new WebSocket(WS_URL);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'match_progress' && mode === 'versus' && entityId(activeMatch) === Number(message.payload?.matchId) && entityId(user) !== Number(message.payload?.userId)) {
          const nextOpponentScore = Number(message.payload?.foundCount || 0);
          setScores((current) => [current[0], nextOpponentScore]);
        }
        if (message.type === 'challenge_rejected' && outgoingChallenge) {
          setNotice('Prijatelj je odbio izazov.');
          setDismissedChallengeId(null);
        }
        if (message.type === 'match_finished' && entityId(activeMatch) === Number(message.payload?.matchId)) {
          showVersusResult(message.payload);
        }
        if (message.type === 'friend_request_created' || message.type === 'friend_request_accepted') {
          refreshFriendsPage();
        }
      } catch {
        // A refresh still keeps the social views in sync.
      }
      refreshLiveSocial();
    };
    return () => socket.close();
  }, [activeMatch, mode, outgoingChallenge, refreshFriendsPage, refreshLiveSocial, user]);

  useEffect(() => () => window.clearTimeout(opponentNoticeTimerRef.current), []);

  useEffect(() => {
    if (mode !== 'versus' || screen !== 'game') {
      previousOpponentScoreRef.current = scores[1];
      opponentNoticeReadyRef.current = false;
      return;
    }

    if (!opponentNoticeReadyRef.current) {
      previousOpponentScoreRef.current = scores[1];
      opponentNoticeReadyRef.current = true;
      return;
    }

    if (scores[1] > previousOpponentScoreRef.current) {
      showOpponentNotice(scores[1]);
    }
    previousOpponentScoreRef.current = scores[1];
  }, [mode, scores[1], screen, showOpponentNotice]);

  async function handleAcceptFriend(friendshipId) {
    setFriendActionId(`accept-${friendshipId}`);
    setError('');
    try {
      await acceptFriend(friendshipId);
      setSocial((current) => ({
        ...current,
        friendships: current.friendships.map((item) => (
          Number(item.ID) === Number(friendshipId) ? { ...item, Status: 'prihvaceno' } : item
        )),
      }));
      await refreshFriendsPage();
    } catch (err) {
      setError(err.message || 'Zahtjev nije moguće prihvatiti.');
    } finally {
      setFriendActionId(null);
    }
  }

  async function handleRequestFriend(registeredUser) {
    const targetId = entityId(registeredUser);
    setFriendActionId(`request-${targetId}`);
    setError('');
    try {
      const created = await requestFriend(entityId(user), targetId);
      setSocial((current) => ({
        ...current,
        friendships: [
          {
            ...created,
            DrugiKorisnik_ID: targetId,
            DrugiKorisnickoIme: registeredUser.korisnickoIme,
            DrugiIme: registeredUser.ime,
            Posiljalac_ID: entityId(user),
            Primalac_ID: targetId,
            Status: 'na_cekanju',
          },
          ...current.friendships.filter((item) => Number(item.DrugiKorisnik_ID) !== Number(targetId)),
        ],
      }));
      refreshFriendsPage().catch(() => null);
    } catch (err) {
      setError(err.message || 'Zahtjev nije poslat.');
    } finally {
      setFriendActionId(null);
    }
  }

  useEffect(() => {
    const currentMatch = social.activeMatch;
    if (!currentMatch || result || screen === 'game' || screen === 'load') return;
    if (launchingMatchRef.current === entityId(currentMatch)) return;
    launchingMatchRef.current = entityId(currentMatch);
    resumeVersusMatch(currentMatch).finally(() => {
      launchingMatchRef.current = null;
    });
  }, [result, screen, social.activeMatch]);

  useEffect(() => {
    if (!user || !socialReady || result || social.activeMatch) return;
    const storedMatchId = Number(localStorage.getItem('ukrstene-active-match'));
    if (!storedMatchId) return;
    getMatchResult(storedMatchId, entityId(user))
      .then((matchResult) => {
        if (matchResult) showVersusResult(matchResult);
        else localStorage.removeItem('ukrstene-active-match');
      })
      .catch(() => null);
  }, [result, social.activeMatch, socialReady, user]);

  const stopTurnTimer = useCallback(() => {
    window.clearInterval(turnTimerRef.current);
    turnTimerRef.current = null;
  }, []);

  const stopGameTimer = useCallback(() => {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const stopSoloLimitTimer = useCallback(() => {
    window.clearTimeout(soloLimitTimerRef.current);
    soloLimitTimerRef.current = null;
  }, []);

  const startSoloLimitTimer = useCallback((initialElapsed = 0) => {
    stopSoloLimitTimer();
    const remainingMs = Math.max(0, (SOLO_GAME_LIMIT_SECONDS - initialElapsed) * 1000);
    soloLimitTimerRef.current = window.setTimeout(() => {
      latestElapsedRef.current = SOLO_GAME_LIMIT_SECONDS;
      setElapsed(SOLO_GAME_LIMIT_SECONDS);
      finishGameRef.current?.(latestFoundRef.current, latestScoresRef.current);
    }, remainingMs);
  }, [stopSoloLimitTimer]);

  const showTurnPopup = useCallback((title, message) => {
    setTurnPopup({ title, message });
    window.setTimeout(() => setTurnPopup(null), 1500);
  }, []);

  const startTurnTimer = useCallback(() => {
    stopTurnTimer();
    setTurnLeft(turnSeconds);
    turnTimerRef.current = window.setInterval(() => {
      setTurnLeft((left) => {
        if (left <= 1) {
          window.clearInterval(turnTimerRef.current);
          turnTimerRef.current = null;
          return 0;
        }
        return left - 1;
      });
    }, 1000);
  }, [stopTurnTimer]);

  const buildResult = useCallback((nextFound = found, nextScores = scores) => {
    const finalElapsed = mode === 'solo'
      ? Math.min(latestElapsedRef.current, SOLO_GAME_LIMIT_SECONDS)
      : latestElapsedRef.current;
    if (mode === 'solo') {
      const pct = Math.round((nextFound.length / gridData.words.length) * 100) || 0;
      return {
        icon: 'WIN',
        title: `Bravo, ${names.p1}!`,
        score: formatTime(finalElapsed),
        message: `Pronašao/la si ${nextFound.length} od ${gridData.words.length} riječi (${pct}%) za ${formatTime(finalElapsed)}.`,
      };
    }
    const winner = nextScores[0] > nextScores[1] ? names.p1 : nextScores[1] > nextScores[0] ? names.p2 : null;
    return {
      icon: winner ? 'WIN' : 'VS',
      title: winner ? `Pobijedio/la ${winner}!` : 'Neriješeno!',
      score: `${nextScores[0]} - ${nextScores[1]}`,
      message: `${names.p1}: ${nextScores[0]} bod. | ${names.p2}: ${nextScores[1]} bod.\nVrijeme: ${formatTime(finalElapsed)}`,
    };
  }, [found, gridData.words.length, mode, names.p1, names.p2, scores]);

  function showVersusResult(matchResult) {
    stopGameTimer();
    stopAmbientMusic();
    finishingRef.current = true;
    setConfirmExit(false);
    localStorage.removeItem('ukrstene-active-match');
    setScreen('home');
    const players = Array.isArray(matchResult?.players) ? matchResult.players : [];
    const flatPlayers = [
      {
        Korisnik_ID: matchResult?.playerOneUserId,
        BrojPronadjenih: matchResult?.playerOneFoundCount,
        VrijemeSekundi: matchResult?.playerOneElapsedSeconds,
      },
      {
        Korisnik_ID: matchResult?.playerTwoUserId,
        BrojPronadjenih: matchResult?.playerTwoFoundCount,
        VrijemeSekundi: matchResult?.playerTwoElapsedSeconds,
      },
    ].filter((item) => item.Korisnik_ID !== undefined);
    const resultPlayers = players.length ? players : flatPlayers;
    const myPlayer = resultPlayers.find((item) => Number(item.Korisnik_ID) === entityId(user));
    const otherPlayer = resultPlayers.find((item) => Number(item.Korisnik_ID) !== entityId(user));
    const myScore = Number(myPlayer?.BrojPronadjenih ?? found.length);
    const otherScore = Number(otherPlayer?.BrojPronadjenih ?? scores[1]);
    const winnerUserId = Number(matchResult?.winnerUserId);
    const myName = user?.korisnickoIme || names.p1;
    const otherName = Number(matchResult?.challengerUserId) === entityId(user)
      ? matchResult?.opponentName || names.p2
      : matchResult?.challengerName || names.p2;
    const winnerName = winnerUserId === entityId(user) ? myName : winnerUserId ? otherName : null;
    const winnerPlayer = resultPlayers.find((item) => Number(item.Korisnik_ID) === winnerUserId);
    const resultDifficulty = DIFFICULTIES.find((item) => item.id === matchResult?.difficultyId)?.label || diff.label;
    const resultTheme = displayThemeLabel(matchResult?.themeName || currentThemeLabel);
    const reasonText = matchResult?.reason === 'predaja'
      ? `${Number(matchResult?.forfeitedUserId) === entityId(user) ? 'Napustio/la si meč.' : `${otherName} je napustio/la meč.`} Protivnik je automatski pobijedio.`
      : winnerName
        ? `${winnerName} je prvi pronašao sve riječi ili je imao više riječi po isteku vremena.`
        : 'Oba igrača su pronašla isti broj riječi.';
    setScores([myScore, otherScore]);
    setActiveMatch(null);
    setResult({
      icon: winnerName ? 'WIN' : 'VS',
      title: winnerName ? `Pobijedio/la je ${winnerName}!` : 'Neriješeno!',
      score: `${myScore} - ${otherScore}`,
      message: `Tema: ${resultTheme}\nTežina: ${resultDifficulty}\nRezultat: ${myName} ${myScore} · ${otherName} ${otherScore}\nVrijeme pobjednika: ${formatTime(Number(winnerPlayer?.VrijemeSekundi || elapsed))}\n${reasonText}`,
    });
  }

  const finishGame = useCallback(async (nextFound = found, nextScores = scores) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    stopGameTimer();
    stopTurnTimer();
    stopSoloLimitTimer();
    stopAmbientMusic();
    playWinSound();
    let versusResult = null;
    if (entityId(activeMatch) && user) {
      const progressResult = await updateMatchProgress(entityId(activeMatch), {
        userId: entityId(user),
        foundWords: nextFound,
        elapsedSeconds: elapsed,
        finished: true,
      }).catch(() => null);
      versusResult = progressResult?.winnerUserId !== undefined
        ? progressResult
        : await finishMatch(entityId(activeMatch)).catch(() => null);
      refreshSocial();
    }
    if (mode === 'versus' && versusResult) {
      showVersusResult(versusResult);
    } else {
      setResult(buildResult(nextFound, nextScores));
    }
  }, [activeMatch, buildResult, elapsed, found, mode, refreshSocial, scores, stopGameTimer, stopSoloLimitTimer, stopTurnTimer, user]);

  useEffect(() => {
    finishGameRef.current = finishGame;
  }, [finishGame]);

  useEffect(() => {
    const limit = Number(activeMatch?.VremenskoOgranicenjeSekundi || 300);
    if (screen !== 'game' || mode !== 'versus' || result || elapsed < limit) return;
    finishGame(found, [found.length, scores[1]]);
  }, [activeMatch, elapsed, finishGame, found, mode, result, scores, screen]);

  useEffect(() => {
    if (screen !== 'game' || mode !== 'solo' || result || elapsed < SOLO_GAME_LIMIT_SECONDS) return;
    finishGame(found, scores);
  }, [elapsed, finishGame, found, mode, result, scores, screen]);

  useEffect(() => {
    if (screen !== 'game' || mode !== 'multiplayer' || turnLeft !== 0 || result) return;
    setSelectionStart(null);
    setSelectionCells([]);
    playFailSound();
    setCurrentPlayer((player) => {
      const nextPlayer = 1 - player;
      showTurnPopup('Vrijeme je isteklo!', `Na redu je sada: ${nextPlayer === 0 ? names.p1 : names.p2}`);
      return nextPlayer;
    });
    startTurnTimer();
  }, [mode, names.p1, names.p2, result, screen, showTurnPopup, startTurnTimer, turnLeft]);

  useEffect(() => () => {
    stopGameTimer();
    stopTurnTimer();
    stopSoloLimitTimer();
    stopAmbientMusic();
  }, [stopGameTimer, stopSoloLimitTimer, stopTurnTimer]);

  async function handleAuth() {
    setError('');
    try {
      const nextUser = authMode === 'login'
        ? await loginUser({ email: authForm.email, lozinka: authForm.lozinka })
        : await registerUser({ ...authForm, avatarBoja: '#00e5b4' });
      setUser(nextUser);
      setScreen('home');
      setActiveTab(nextUser?.uloga === 'admin' ? 'admin' : 'play');
      setNotice('');
      setAuthMode('login');
      setAuthForm(emptyAuthForm);
      setDismissedChallengeId(null);
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    localStorage.removeItem('ukrstene-user');
    localStorage.removeItem('ukrstene-active-match');
    setUser(null);
    setAuthMode('login');
    setAuthForm(emptyAuthForm);
    setMode('solo');
    setPlayerTwo('');
    setSelectedVersusFriend(null);
    setActiveMatch(null);
    setOnlineOpponent(null);
    setNotice('');
    setError('');
    setDismissedChallengeId(null);
    setFriendSearch('');
    setSocialReady(false);
    setSocial({ friends: [], friendships: [], allUsers: [], challenges: [], outgoingChallenges: [], activeMatch: null, leaderboard: [], history: [] });
    setScreen('auth');
    stopSoloLimitTimer();
    stopAmbientMusic();
  }

  function goHome() {
    stopGameTimer();
    stopTurnTimer();
    stopSoloLimitTimer();
    stopAmbientMusic();
    finishingRef.current = false;
    setResult(null);
    setTurnPopup(null);
    setOpponentNotice(null);
    window.clearTimeout(opponentNoticeTimerRef.current);
    setActiveMatch(null);
    setOnlineOpponent(null);
    setSelectedVersusFriend(null);
    setScreen('home');
  }

  function startGameFromUserGesture() {
    initSound();
    startAmbientMusic();
    launchGame();
  }

  async function launchGame(match = activeMatch, overrides = {}) {
    const gameMode = overrides.gameMode || mode;
    if (gameMode === 'versus' && !entityId(match)) {
      setError('Online meč počinje tek kada drugi korisnik prihvati izazov.');
      return;
    }

    const selectedTheme = overrides.theme || theme;
    const selectedDiff = overrides.diff || diff;
    const themeLabel = overrides.themeLabel || customTheme.trim() || selectedTheme.label;
    const themeId = customTheme.trim() ? customTheme.trim() : selectedTheme.id;
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    setError('');
    stopSoloLimitTimer();
    finishingRef.current = false;
    setResult(null);
    setTurnPopup(null);
    setOpponentNotice(null);
    window.clearTimeout(opponentNoticeTimerRef.current);
    setFound([]);
    setDoneCells({});
    setWordColors({});
    setSelectionStart(null);
    setSelectionCells([]);
    setScores([0, 0]);
    latestFoundRef.current = [];
    latestScoresRef.current = [0, 0];
    latestElapsedRef.current = 0;
    setCurrentPlayer(0);
    setElapsed(0);
    setScreen('load');
    setLoadingMessage(apiKey ? 'AI generiše tematske riječi...' : `Pripremam riječi za temu: ${themeLabel}...`);

    try {
      let words = [];
      let nextGrid = null;
      let lastGridError = null;
      const usePresetWords = Boolean(overrides.words?.length);

      for (let attempt = 1; attempt <= GRID_GENERATION_ATTEMPTS; attempt++) {
        if (attempt > 1) {
          setLoadingMessage('Riječi ne staju u tablu, generišem novi set...');
        }
        words = usePresetWords
          ? overrides.words
          : await fetchWords(themeLabel, themeId, selectedDiff.wc, apiKey, Boolean(customTheme.trim()), selectedDiff.n);
        try {
          nextGrid = buildGrid(words, selectedDiff.n, gameMode === 'versus' ? entityId(match) : undefined);
          break;
        } catch (gridError) {
          lastGridError = gridError;
          if (usePresetWords) break;
        }
      }

      if (!nextGrid) throw lastGridError || new Error('Nije moguće pripremiti tablu.');
      const restoredFound = overrides.foundWords || [];
      const restoredCells = {};
      const restoredColors = {};
      nextGrid.placements.forEach((placement) => {
        if (!restoredFound.includes(placement.word)) return;
        restoredColors[placement.word] = PLAYER_COLORS[0];
        for (let index = 0; index < placement.word.length; index++) {
          restoredCells[`${placement.r + placement.dr * index}-${placement.c + placement.dc * index}`] = PLAYER_COLORS[0];
        }
      });
      setGridData(nextGrid);
      setFound(restoredFound);
      latestFoundRef.current = restoredFound;
      setDoneCells(restoredCells);
      setWordColors(restoredColors);
      const restoredScores = [restoredFound.length, Number(overrides.opponentScore || 0)];
      setScores(restoredScores);
      latestScoresRef.current = restoredScores;
      const initialElapsed = gameMode === 'versus'
        ? Math.max(0, Number(overrides.elapsedSeconds ?? match?.ProtekloSekundi ?? 0))
        : 0;
      setElapsed(initialElapsed);
      latestElapsedRef.current = initialElapsed;
      gameStartedAtRef.current = Date.now() - initialElapsed * 1000;
      setScreen('game');
      startAmbientMusic();
      if (gameMode === 'solo') startSoloLimitTimer(initialElapsed);
      if (gameMode === 'versus') localStorage.setItem('ukrstene-active-match', String(entityId(match)));
      timerRef.current = window.setInterval(() => {
        const nextElapsed = Math.max(0, Math.floor((Date.now() - gameStartedAtRef.current) / 1000));
        if (gameMode === 'solo' && nextElapsed >= SOLO_GAME_LIMIT_SECONDS) {
          latestElapsedRef.current = SOLO_GAME_LIMIT_SECONDS;
          setElapsed(SOLO_GAME_LIMIT_SECONDS);
          window.clearInterval(timerRef.current);
          timerRef.current = null;
          window.setTimeout(() => {
            finishGameRef.current?.(latestFoundRef.current, latestScoresRef.current);
          }, 0);
          return;
        }
        latestElapsedRef.current = nextElapsed;
        setElapsed(nextElapsed);
      }, 250);
      if (gameMode === 'multiplayer') {
        showTurnPopup('Početak igre', `Prvi igra: ${names.p1}`);
        startTurnTimer();
      }
      if (entityId(match) && user && !overrides.resume) {
        updateMatchProgress(entityId(match), { userId: entityId(user), foundWords: [], elapsedSeconds: 0, finished: false }).catch(() => null);
      }
      return true;
    } catch (err) {
      if (gameMode === 'versus' && overrides.resume && entityId(match) && user) {
        localStorage.removeItem('ukrstene-active-match');
        setActiveMatch(null);
        setOnlineOpponent(null);
        setSocial((current) => ({ ...current, activeMatch: null }));
        await forfeitMatch(entityId(match), {
          userId: entityId(user),
          foundWords: [],
          elapsedSeconds: 0,
          finished: true,
        }).catch(() => null);
        refreshSocial();
        setNotice('Pokvareni mec je ociscen. Mozes normalno nastaviti.');
        setError('');
        setScreen('home');
        setActiveTab('play');
        return false;
      }
      setError(`Greska: ${err.message}`);
      stopAmbientMusic();
      stopSoloLimitTimer();
      setScreen('home');
      setActiveTab('play');
      return false;
    }
  }

  function startSelection(r, c) {
    initSound();
    setSelectionStart({ r, c });
    setSelectionCells([[r, c]]);
  }

  function moveSelection(r, c) {
    if (!selectionStart) return;
    setSelectionCells(cellsForSelection(selectionStart, { r, c }));
  }

  async function endSelection() {
    if (!selectionStart || selectionCells.length === 0) return;
    const word = getSelectedWord(gridData.grid, selectionCells);
    const reversed = word.split('').reverse().join('');
    const match = gridData.words.find((candidate) => (candidate === word || candidate === reversed) && !found.includes(candidate));

    if (match) {
      playSuccessSound();
      const nextFound = [...found, match];
      const nextDoneCells = { ...doneCells };
      const foundColor = mode === 'multiplayer' ? PLAYER_COLORS[currentPlayer] : mode === 'versus' ? PLAYER_COLORS[0] : 'var(--teal)';
      for (const [r, c] of selectionCells) nextDoneCells[`${r}-${c}`] = foundColor;
      setFound(nextFound);
      setDoneCells(nextDoneCells);
      setWordColors((current) => ({ ...current, [match]: foundColor }));

      if (entityId(activeMatch) && user) {
        updateMatchProgress(entityId(activeMatch), { userId: entityId(user), foundWords: nextFound, elapsedSeconds: elapsed, finished: nextFound.length === gridData.words.length }).catch(() => null);
      }

      if (mode === 'multiplayer') {
        stopTurnTimer();
        const nextScores = [...scores];
        nextScores[currentPlayer] += 1;
        setScores(nextScores);
        if (nextFound.length === gridData.words.length) window.setTimeout(() => finishGame(nextFound, nextScores), 500);
        else {
          const nextPlayer = 1 - currentPlayer;
          setCurrentPlayer(nextPlayer);
          showTurnPopup('Pogođena riječ!', `Sada igra: ${nextPlayer === 0 ? names.p1 : names.p2}`);
          startTurnTimer();
        }
      } else if (mode === 'versus') {
        const nextScores = [nextFound.length, scores[1]];
        setScores(nextScores);
        if (nextFound.length === gridData.words.length) {
          window.setTimeout(() => finishGame(nextFound, nextScores), 500);
        }
      } else if (nextFound.length === gridData.words.length) {
        window.setTimeout(() => finishGame(nextFound, scores), 500);
      }
    } else if (selectionCells.length > 1) {
      playFailSound();
    }
    setSelectionStart(null);
    setSelectionCells([]);
  }

  function handleTouchMove(event) {
    event.preventDefault();
    const touch = event.touches[0];
    const hit = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = hit?.closest?.('[data-cell]');
    if (cell) moveSelection(Number(cell.dataset.r), Number(cell.dataset.c));
  }

  async function sendVersusChallenge() {
    if (!selectedVersusFriend || challengeSending || selectedOutgoingChallenge) {
      if (selectedOutgoingChallenge) return;
      setError('Izaberi prijatelja kojeg želiš da izazoveš.');
      return;
    }
    setChallengeSending(true);
    setError('');
    setNotice('Pripremam iste riječi za oba igrača...');
    try {
      const isCustomTheme = Boolean(customTheme.trim());
      const challengeWords = isCustomTheme
        ? await fetchWords(
          customTheme.trim(),
          theme.id,
          diff.wc,
          import.meta.env.VITE_GEMINI_API_KEY,
          true,
          diff.n,
        )
        : [];
      const createdChallenge = await createChallenge({
        challengerId: entityId(user),
        opponentId: entityId(selectedVersusFriend),
        themeId: isCustomTheme ? null : theme.id,
        customTheme: isCustomTheme ? customTheme.trim() : null,
        words: challengeWords,
        difficultyId: diff.id,
        wordCount: isCustomTheme ? challengeWords.length : diff.wc,
        gridSize: diff.n,
        timeLimitSeconds: 300,
      });
      setChallengeClock(Date.now());
      setSocial((current) => ({
        ...current,
        outgoingChallenges: [
          createdChallenge,
          ...current.outgoingChallenges.filter((item) => entityId(item) !== entityId(createdChallenge)),
        ],
      }));
      setNotice('');
      setOnlineOpponent(selectedVersusFriend);
      setMode('versus');
      setActiveMatch(null);
    } catch (err) {
      setNotice('');
      setError(err.message || 'Izazov nije poslat.');
    } finally {
      setChallengeSending(false);
    }
  }

  async function acceptIncomingChallenge(challenge) {
    setError('');
    try {
      const match = await acceptChallenge(challenge.ID, entityId(user));
      await resumeVersusMatch({
        ...match,
        ProtivnikIme: challenge.IzazivacIme,
        MojeRijeciJson: '[]',
        ProtivnikBrojPronadjenih: 0,
      });
      refreshLiveSocial();
    } catch (err) {
      setError(err.message || 'Izazov nije moguće prihvatiti.');
    }
  }

  async function rejectIncomingChallenge(challenge) {
    setError('');
    try {
      await rejectChallenge(challenge.ID, entityId(user));
      setNotice('Izazov je odbijen.');
      setSocial((current) => ({
        ...current,
        challenges: current.challenges.filter((item) => entityId(item) !== entityId(challenge)),
      }));
      refreshLiveSocial();
    } catch (err) {
      setError(err.message || 'Izazov nije moguće odbiti.');
    }
  }

  async function resumeVersusMatch(match) {
    const matchTheme = themeOptions.find((item) => item.id === match.Tema_ID) || theme;
    const matchDiff = DIFFICULTIES.find((item) => item.id === match.Tezina) || defaultDiff;
    setMode('versus');
    setActiveMatch(match);
    setOnlineOpponent({ korisnickoIme: match.ProtivnikIme });
    setTheme(matchTheme);
    setDiff(matchDiff);
    setCustomTheme(match.CustomTema || '');
    setActiveTab('play');
    await launchGame(match, {
      theme: matchTheme,
      diff: matchDiff,
      words: parseStoredWords(match.RijeciJson),
      themeLabel: match.TemaNaziv,
      gameMode: 'versus',
      foundWords: parseStoredWords(match.MojeRijeciJson),
      opponentScore: match.ProtivnikBrojPronadjenih,
      resume: true,
    });
  }

  async function exitVersusGame() {
    if (!entityId(activeMatch) || !user) return;
    setConfirmExit(false);
    setError('');
    try {
      const forfeitResult = await forfeitMatch(entityId(activeMatch), {
        userId: entityId(user),
        foundWords: found,
        elapsedSeconds: elapsed,
        finished: true,
      });
      showVersusResult(forfeitResult);
      refreshSocial();
    } catch (err) {
      setError(err.message || 'Napredak nije moguće sačuvati.');
    }
  }

  const navItems = [
    ...(isAdmin
      ? [['admin', 'Admin', ShieldCheck]]
      : [
        ['play', 'Igra', Gamepad2],
        ['friends', 'Prijatelji', Users],
        ['challenges', 'Izazovi', Swords],
        ['leaderboard', 'Rang lista', Trophy],
      ]),
  ];
  const challengeOverlayOpen = screen === 'home' && challengeDialog && entityId(challengeDialog) !== dismissedChallengeId;
  const overlayOpen = Boolean(confirmExit || challengeOverlayOpen || result || turnPopup);

  return (
    <>
      <Screen active={screen === 'auth'} className="auth-screen" inert={overlayOpen}>
        <div className="auth-shell">
          <div className="brand-lockup">
            <img className="brand-mark" src="/ukrstene-logo.png" alt="" />
            <div>
              <h1>Ukrštene riječi</h1>
              <p>Pronađi riječi. Izazovi prijatelje. Osvoji vrh liste.</p>
            </div>
          </div>

          <div className="auth-card">
            <div className="auth-tabs" role="tablist">
              <button className={authMode === 'login' ? 'active' : ''} type="button" onClick={() => setAuthMode('login')}>Log in</button>
              <button className={authMode === 'register' ? 'active' : ''} type="button" onClick={() => setAuthMode('register')}>Registracija</button>
            </div>
            <SectionHeader
              title={authMode === 'login' ? 'Dobrodošao nazad' : 'Napravi nalog'}
              text={authMode === 'login' ? 'Prijavi se i nastavi gdje si stao.' : 'Kreiraj profil za prijatelje, izazove i rang listu.'}
            />
            {authMode === 'register' && (
              <div className="form-grid">
                <label className="field"><span className="label">Korisničko ime</span><input className="input" value={authForm.korisnickoIme} onChange={(e) => setAuthForm({ ...authForm, korisnickoIme: e.target.value })} /></label>
                <label className="field"><span className="label">Ime</span><input className="input" value={authForm.ime} onChange={(e) => setAuthForm({ ...authForm, ime: e.target.value })} /></label>
              </div>
            )}
            <label className="field"><span className="label">Email</span><input className="input" type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></label>
            <label className="field"><span className="label">Lozinka</span><input className="input" type="password" value={authForm.lozinka} onChange={(e) => setAuthForm({ ...authForm, lozinka: e.target.value })} /></label>
            {error && <div className="error">{error}</div>}
            <button className="btn btn-teal" type="button" onClick={handleAuth}>
              {authMode === 'login' ? 'Log in' : 'Registruj se'}
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </Screen>

      <Screen active={screen === 'home'} className="dashboard-screen" inert={overlayOpen}>
        <div className="app-shell">
          <header className="app-header">
            <div className="brand-lockup compact">
              <img className="brand-mark" src="/ukrstene-logo.png" alt="" />
              <div>
                <h1>Ukrštene riječi</h1>
                <p>{user?.korisnickoIme}</p>
              </div>
            </div>
            <button className="icon-command" type="button" onClick={logout} title="Odjavi se">
              <LogOut size={18} />
              <span>Odjava</span>
            </button>
          </header>

          <nav className="app-nav" aria-label="Glavna navigacija">
            {navItems.map(([id, label, Icon]) => (
              <button
                className={`${activeTab === id ? 'active' : ''} ${id === 'challenges' && social.outgoingChallenges.length > 0 ? 'has-sent-challenge' : ''}`}
                key={id}
                type="button"
                onClick={() => {
                  setActiveTab(id);
                  setError('');
                  setNotice('');
                  if (id === 'challenges') setDismissedChallengeId(null);
                  if (id === 'friends') refreshFriendsPage().catch(() => null);
                  if (id === 'admin') refreshAdmin().catch(() => null);
                }}
              >
                <Icon size={18} />
                <span>{label}</span>
                {id === 'challenges' && (social.challenges.length + social.outgoingChallenges.length) > 0 && <b>{social.challenges.length + social.outgoingChallenges.length}</b>}
              </button>
            ))}
          </nav>

          <main className="app-content">
            {notice && <div className="notice"><Check size={17} />{notice}</div>}
            {error && <div className="error">{error}</div>}

            {activeTab === 'play' && (
              <section className="content-section">
                <SectionHeader eyebrow="Nova partija" title="Izaberi mod igre" text="Podešavanja ispod se mijenjaju prema izabranom modu." />
                <div className="game-mode-tabs" role="tablist" aria-label="Mod igre">
                  {[
                    ['solo', 'Solo', Gamepad2],
                    ['multiplayer', 'Multiplayer', Users],
                    ['versus', 'Versus', Swords],
                  ].map(([id, label, Icon]) => (
                    <button className={mode === id ? 'active' : ''} key={id} type="button" onClick={() => { setMode(id); setError(''); setNotice(''); }}>
                      <Icon size={19} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                <div className="surface game-settings">
                  {mode === 'solo' && (
                    <div className="mode-intro">
                      <div className="mode-intro-icon solo"><Gamepad2 size={21} /></div>
                      <div><strong>Solo igra</strong><span>Igraš sa svojim nalogom, bez unosa dodatnog imena.</span></div>
                    </div>
                  )}

                  {mode === 'multiplayer' && (
                    <>
                      <div className="mode-intro">
                        <div className="mode-intro-icon multiplayer"><Users size={21} /></div>
                        <div><strong>Lokalni multiplayer</strong><span>Ti si prvi igrač. Unesi samo ime drugog igrača.</span></div>
                      </div>
                      <label className="field opponent-field">
                        <span className="label">Ime drugog igrača</span>
                        <input className="input" value={playerTwo} onChange={(event) => setPlayerTwo(event.target.value)} placeholder="Igrač 2" />
                      </label>
                      <div className="player-color-legend">
                        <span><i style={{ background: PLAYER_COLORS[0] }} />{names.p1}</span>
                        <span><i style={{ background: PLAYER_COLORS[1] }} />{names.p2}</span>
                      </div>
                    </>
                  )}

                  {mode === 'versus' && (
                    <>
                      <div className="mode-intro">
                        <div className="mode-intro-icon versus"><Swords size={21} /></div>
                        <div><strong>Versus protiv prijatelja</strong><span>Izaberi prijatelja, temu i težinu, pa pošalji izazov.</span></div>
                      </div>
                      <div className="settings-block versus-friends">
                        <div className="settings-heading"><span>Izaberi prijatelja</span></div>
                        {social.friends.length === 0 ? (
                          <EmptyState icon={Users} title="Nemaš dodatih prijatelja" text="Dodaj korisnika u sekciji Prijatelji da bi ga mogao izazvati." />
                        ) : (
                          <div className="friend-choice-list scroll-list friend-scroll">
                            {social.friends.map((friend) => (
                              <button className={entityId(selectedVersusFriend) === entityId(friend) ? 'selected' : ''} key={entityId(friend)} type="button" onClick={() => { setSelectedVersusFriend(friend); setError(''); }}>
                                <span className="avatar">{friend.korisnickoIme?.slice(0, 1).toUpperCase()}</span>
                                <span><strong>{friend.korisnickoIme}</strong><small>Prijatelj</small></span>
                                {entityId(selectedVersusFriend) === entityId(friend) && <Check size={18} />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="settings-block">
                    <div className="settings-heading"><span>Težina</span><small>{diff.sub}</small></div>
                    <div className="difficulty-grid">
                      {DIFFICULTIES.map((item) => (
                        <button className={`difficulty-choice ${diff.id === item.id ? 'selected' : ''}`} key={item.id} type="button" onClick={() => { setDiff(item); setError(''); }}>
                          <strong>{item.label}</strong>
                          <span>{item.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-block">
                    <div className="settings-heading"><span>Tema</span></div>
                    <div className="theme-grid">
                      {themeOptions.map((item) => (
                        <button className={`theme-choice ${theme.id === item.id && !customTheme ? 'selected' : ''}`} key={item.id} type="button" onClick={() => { setTheme(item); setCustomTheme(''); setError(''); }}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="custom-topic">
                    <div className="custom-topic-icon"><WandSparkles size={20} /></div>
                    <label className="field">
                      <span className="label">Tema po tvom izboru</span>
                      <input className="input" value={customTheme} onChange={(event) => { setCustomTheme(event.target.value); setError(''); }} placeholder="NBA kosarka, svemir, filmovi..." />
                      <small>{mode === 'versus' ? 'Gemini generiše riječi jednom, a oba igrača dobijaju istu igru.' : 'Unesena tema ide direktno AI generatoru.'}</small>
                    </label>
                  </div>

                  {mode === 'versus' ? (
                    <button className={`btn ${selectedOutgoingChallenge || challengeSending ? 'btn-sent' : 'btn-primary'}`} type="button" onClick={sendVersusChallenge} disabled={!selectedVersusFriend || Boolean(selectedOutgoingChallenge) || challengeSending}>
                      <Check size={18} />
                      {selectedOutgoingChallenge || challengeSending ? 'Zahtjev poslat' : 'Pošalji izazov'}
                    </button>
                  ) : (
                    <button className="btn btn-teal" type="button" onClick={startGameFromUserGesture}>
                      <Sparkles size={18} />
                      Generiši i igraj
                    </button>
                  )}
                </div>
              </section>
            )}

            {activeTab === 'friends' && (
              <section className="content-section">
                <SectionHeader eyebrow="Društvo" title="Prijatelji" text="Pregledaj registrovane korisnike i upravljaj zahtjevima." />

                {incomingFriendRequests.length > 0 && (
                  <div className="surface">
                    <div className="surface-title"><h3>Zahtjevi za prijateljstvo</h3><span>{incomingFriendRequests.length}</span></div>
                    <div className="data-list scroll-list">
                      {incomingFriendRequests.map((request) => (
                        <div className="data-row" key={request.ID}>
                          <div className="avatar">{request.DrugiKorisnickoIme?.slice(0, 1).toUpperCase()}</div>
                          <div className="row-copy"><strong>{request.DrugiKorisnickoIme}</strong><span>Želi da vas doda za prijatelja</span></div>
                          <button className="row-action accent" type="button" disabled={friendActionId === `accept-${request.ID}`} onClick={() => handleAcceptFriend(request.ID)}><Check size={17} />{friendActionId === `accept-${request.ID}` ? 'Prihvatam...' : 'Prihvati'}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="surface">
                  <div className="surface-title"><h3>Pronađi korisnika</h3></div>
                  <label className="search-bar user-search">
                    <Search size={18} />
                    <input
                      aria-label="Pretraži korisnike"
                      value={friendSearch}
                      onChange={(event) => setFriendSearch(event.target.value)}
                      placeholder="Pretraži po imenu ili korisničkom imenu"
                    />
                    {friendSearch && <button type="button" onClick={() => setFriendSearch('')}>Očisti</button>}
                  </label>
                  {filteredRegisteredUsers.length === 0 ? (
                    <EmptyState icon={Users} title="Nema rezultata" text="Pokušaj sa drugim imenom ili korisničkim imenom." />
                  ) : (
                    <div className="data-list scroll-list user-directory">
                      {filteredRegisteredUsers.map((registeredUser) => {
                        const connection = friendshipByUser.get(entityId(registeredUser));
                        const isFriend = connection?.Status === 'prihvaceno';
                        const isIncoming = connection?.Status === 'na_cekanju' && Number(connection.Primalac_ID) === entityId(user);
                        const isOutgoing = connection?.Status === 'na_cekanju' && Number(connection.Posiljalac_ID) === entityId(user);

                        return (
                          <div className="data-row" key={entityId(registeredUser)}>
                            <div className="avatar">{registeredUser.korisnickoIme?.slice(0, 1).toUpperCase()}</div>
                            <div className="row-copy">
                              <strong>{registeredUser.korisnickoIme}</strong>
                              <span>{registeredUser.ime || 'Igrač'}</span>
                            </div>
                            {isFriend && <span className="relationship-status friend"><Check size={15} />Prijatelj</span>}
                            {isOutgoing && <span className="relationship-status pending">Zahtjev poslat</span>}
                            {isIncoming && <button className="row-action accent" type="button" disabled={friendActionId === `accept-${connection.ID}`} onClick={() => handleAcceptFriend(connection.ID)}><Check size={17} />{friendActionId === `accept-${connection.ID}` ? 'Prihvatam...' : 'Prihvati'}</button>}
                            {!connection && <button className="row-action" type="button" disabled={friendActionId === `request-${entityId(registeredUser)}`} onClick={() => handleRequestFriend(registeredUser)}><UserPlus size={17} />{friendActionId === `request-${entityId(registeredUser)}` ? 'Šaljem...' : 'Dodaj'}</button>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeTab === 'challenges' && (
              <section className="content-section">
                <SectionHeader eyebrow="Versus" title="Izazovi" text="Istorija mečeva." />
               
                <div className="surface">
                  
                  {social.history.length === 0 ? (
                    <EmptyState icon={History} title="Nema odigranih mečeva" text="Završene versus partije pojaviće se ovdje." />
                  ) : (
                    <div className="data-list scroll-list">
                      {social.history.map((item) => {
                        const outcome = matchOutcome(item, entityId(user));
                        const difficulty = DIFFICULTIES.find((option) => option.id === item.Tezina)?.label || item.Tezina;
                        return (
                          <div className="data-row match-history-row" key={item.ID}>
                            <div className="avatar clock"><History size={18} /></div>
                            <div className="row-copy">
                              <strong>Protiv: {item.ProtivnikIme}</strong>
                              <span>{displayThemeLabel(item.TemaNaziv)} · {difficulty}</span>
                            </div>
                            <strong className={`match-outcome ${outcome.className}`}>{outcome.label}</strong>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeTab === 'leaderboard' && (
              <section className="content-section">
                <SectionHeader eyebrow="Takmičenje" title="Rang lista" text="Poredak igrača prema ukupnom broju pogođenih riječi." />
                <div className="surface leaderboard scroll-list">
                  {social.leaderboard.length === 0 ? <EmptyState icon={Trophy} title="Lista je prazna" text="Odigraj prvi meč i zauzmi vrh." /> : social.leaderboard.map((item, index) => (
                    <div className={`rank-row ${entityId(item) === entityId(user) ? 'me' : ''}`} key={entityId(item)}>
                      <span className="rank-number">{index + 1}</span>
                      <div className="avatar">{item.korisnickoIme?.slice(0, 1).toUpperCase()}</div>
                      <div className="row-copy"><strong>{item.korisnickoIme}</strong><span>{item.ukupnoPartija} odigranih partija</span></div>
                      <strong className="wins"> {item.ukupnoPogodjenihRijeci}</strong>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'admin' && isAdmin && (
              <section className="content-section admin-panel">
                <SectionHeader eyebrow="Kontrola" title="Admin panel" text="Upravljanje temama, rijecima i predlozima iz baze." />

                <div className="admin-grid">
                  <div className="surface">
                    <div className="surface-title"><h3>{editingThemeId ? 'Izmijeni temu' : 'Dodaj temu'}</h3></div>
                    <div className="form-grid">
                      <label className="field">
                        <span className="label">ID teme</span>
                        <input className="input" value={themeForm.id} onChange={(event) => setThemeForm({ ...themeForm, id: event.target.value })} placeholder="npr. priroda" />
                      </label>
                      <label className="field">
                        <span className="label">Naziv</span>
                        <input className="input" value={themeForm.label} onChange={(event) => setThemeForm({ ...themeForm, label: event.target.value })} placeholder="Priroda" />
                      </label>
                    </div>
                    <div className="admin-actions">
                      <button className="btn btn-teal compact" type="button" onClick={saveAdminTheme} disabled={adminLoading || !themeForm.label.trim()}>
                        <Save size={17} />{editingThemeId ? 'Sacuvaj' : 'Dodaj'}
                      </button>
                      {editingThemeId && (
                        <button className="btn btn-outline compact" type="button" onClick={() => { setEditingThemeId(null); setThemeForm(emptyThemeForm); }}>
                          <X size={17} />Odustani
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="surface">
                    <div className="surface-title"><h3>{editingWordId ? 'Izmijeni rijec' : 'Dodaj rijec'}</h3></div>
                    <div className="form-grid admin-word-form">
                      <label className="field">
                        <span className="label">Tema</span>
                        <select className="input" value={wordForm.themeId} onChange={(event) => setWordForm({ ...wordForm, themeId: event.target.value })}>
                          <option value="">Izaberi temu</option>
                          {adminData.themes.map((item) => <option key={item.id} value={item.id}>{displayThemeLabel(item.label)}</option>)}
                        </select>
                      </label>
                      <label className="field">
                        <span className="label">Rijec</span>
                        <input className="input" value={wordForm.word} onChange={(event) => setWordForm({ ...wordForm, word: event.target.value })} placeholder="PLANINA" />
                      </label>
                      <label className="field">
                        <span className="label">Tezina</span>
                        <select className="input" value={wordForm.difficulty} onChange={(event) => setWordForm({ ...wordForm, difficulty: event.target.value })}>
                          <option value="sve">Sve</option>
                          <option value="easy">Lako</option>
                          <option value="med">Srednje</option>
                          <option value="hard">Tesko</option>
                        </select>
                      </label>
                    </div>
                    <div className="admin-actions">
                      <button className="btn btn-teal compact" type="button" onClick={saveAdminWord} disabled={adminLoading || !wordForm.themeId || !wordForm.word.trim()}>
                        <Save size={17} />{editingWordId ? 'Sacuvaj' : 'Dodaj'}
                      </button>
                      {editingWordId && (
                        <button className="btn btn-outline compact" type="button" onClick={() => { setEditingWordId(null); setWordForm(emptyWordForm); }}>
                          <X size={17} />Odustani
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="surface">
                  <div className="surface-title"><h3>Teme</h3><span>{adminData.themes.length}</span></div>
                  {adminData.themes.length === 0 ? (
                    <EmptyState icon={ShieldCheck} title="Nema tema" text="Dodaj prvu temu kroz formu iznad." />
                  ) : (
                    <div className="data-list scroll-list admin-list">
                      {adminData.themes.map((item) => (
                        <div className="data-row admin-row" key={item.id}>
                          <div className="avatar"><ShieldCheck size={17} /></div>
                          <div className="row-copy">
                            <strong>{displayThemeLabel(item.label)}</strong>
                            <span>{item.id} - {item.wordCount ?? 0} rijeci</span>
                          </div>
                          <div className="row-buttons">
                            <button className="row-action" type="button" onClick={() => { setEditingThemeId(item.id); setThemeForm({ id: item.id, label: displayThemeLabel(item.label) }); }}>
                              <Pencil size={16} />Izmijeni
                            </button>
                            <button className="row-action danger" type="button" onClick={() => removeAdminTheme(item.id)}>
                              <Trash2 size={16} />Obrisi
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="surface">
                  <div className="surface-title"><h3>Rijeci iz baze</h3><span>{adminData.words.length}</span></div>
                  {adminData.words.length === 0 ? (
                    <EmptyState icon={Plus} title="Nema rijeci" text="Dodaj rijeci za izabranu temu." />
                  ) : (
                    <div className="data-list scroll-list admin-list tall">
                      {adminData.words.map((item) => (
                        <div className="data-row admin-row" key={item.ID}>
                          <div className="avatar">{String(item.Rijec || '?').slice(0, 1)}</div>
                          <div className="row-copy">
                            <strong>{item.Rijec}</strong>
                            <span>{displayThemeLabel(item.TemaNaziv || item.Tema_ID)} - {item.Tezina || 'sve'}</span>
                          </div>
                          <div className="row-buttons">
                            <button className="row-action" type="button" onClick={() => { setEditingWordId(item.ID); setWordForm({ themeId: item.Tema_ID || '', word: item.Rijec || '', difficulty: item.Tezina || 'sve' }); }}>
                              <Pencil size={16} />Izmijeni
                            </button>
                            <button className="row-action danger" type="button" onClick={() => removeAdminWord(item.ID)}>
                              <Trash2 size={16} />Obrisi
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="surface">
                  <div className="surface-title"><h3>Predlozi tema</h3><span>{adminData.submissions.length}</span></div>
                  {adminData.submissions.length === 0 ? (
                    <EmptyState icon={Check} title="Nema predloga" text="Novi korisnicki predlozi pojavice se ovdje." />
                  ) : (
                    <div className="data-list scroll-list admin-list">
                      {adminData.submissions.map((item) => (
                        <div className="data-row admin-row" key={item.ID}>
                          <div className="avatar">{String(item.Naziv || '?').slice(0, 1)}</div>
                          <div className="row-copy">
                            <strong>{item.Naziv}</strong>
                            <span>{parseStoredWords(item.RijeciJson).join(', ') || 'Bez rijeci'} - {item.KorisnickoIme}</span>
                          </div>
                          <div className="row-buttons">
                            <button className="row-action accent" type="button" onClick={() => handleSubmissionAction(item.ID, 'approve')}>
                              <Check size={16} />Odobri
                            </button>
                            <button className="row-action danger" type="button" onClick={() => handleSubmissionAction(item.ID, 'reject')}>
                              <X size={16} />Odbij
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

          </main>
        </div>
      </Screen>

      <Screen active={screen === 'load'} inert={overlayOpen}>
        <img className="brand-mark loading-mark" src="/ukrstene-logo.png" alt="" />
        <h1 className="loading-title">Pripremamo tablu</h1>
        <div className="spinner" />
        <p className="loading-sub">{loadingMessage}</p>
      </Screen>

      <Screen active={screen === 'game'} className="game-screen" inert={overlayOpen}>
        <header className="game-header">
          <div><div className="game-theme">{currentThemeLabel}</div><div className="timer">{formatTime(elapsed)}</div></div>
          {mode === 'multiplayer' && <div className="stat-pill">Potez: <span>{turnLeft}</span>s</div>}
          {mode === 'solo' ? <div className="stat-pill">Nađeno: <span>{found.length}</span>/<span>{gridData.words.length}</span></div> : (
            <div className="duo-score">
              <div className={`player-score ${mode === 'multiplayer' && currentPlayer === 0 ? 'current' : ''}`}><span>{names.p1}</span><strong style={{ color: PLAYER_COLORS[0] }}>{scores[0]}</strong></div>
              <div className="vs">VS</div>
              <div className={`player-score ${mode === 'multiplayer' && currentPlayer === 1 ? 'current' : ''}`}><span>{names.p2}</span><strong style={{ color: PLAYER_COLORS[1] }}>{scores[1]}</strong></div>
            </div>
          )}
          {mode === 'versus'
            ? <button className="btn btn-outline compact exit-match" type="button" onClick={() => setConfirmExit(true)}><LogOut size={16} />Izađi iz igre</button>
            : <button className="btn btn-outline compact" type="button" onClick={() => finishGame()}>Završi</button>}
        </header>
        {mode === 'versus' && opponentNotice && (
          <div className="opponent-word-notice" key={opponentNotice.id}>
            <span>{names.p2} je našao/la riječ</span>
            <strong>{opponentNotice.foundCount}</strong>
          </div>
        )}
        {mode === 'multiplayer' && <div className="current-turn">Na potezu: {currentPlayer === 0 ? names.p1 : names.p2}</div>}
        <div className="grid-wrap"><div className="grid" style={{ gridTemplateColumns: `repeat(${gridData.grid.length}, ${cellSize}px)`, gap: `${gridGap}px` }} onMouseLeave={() => selectionStart && setSelectionCells([[selectionStart.r, selectionStart.c]])} onTouchMove={handleTouchMove} onTouchEnd={endSelection}>
          {gridData.grid.map((row, r) => row.map((letter, c) => {
            const key = `${r}-${c}`;
            const doneColor = doneCells[key];
            return <button className={`cell ${selectedKeys.has(key) ? 'preview' : ''} ${doneColor ? 'done' : ''}`} data-cell data-r={r} data-c={c} key={key} onMouseDown={(e) => { e.preventDefault(); startSelection(r, c); }} onMouseEnter={() => moveSelection(r, c)} onMouseUp={endSelection} onTouchStart={(e) => { e.preventDefault(); startSelection(r, c); }} style={{ width: cellSize, height: cellSize, fontSize: Math.max(10, Math.min(cellSize * 0.52, 22)), background: doneColor || undefined }} type="button">{letter}</button>;
          }))}
        </div></div>
        <div className="words-panel">
          {gridData.words.map((word) => (
            <span
              className={`word-tag ${found.includes(word) ? 'done' : ''}`}
              key={word}
              style={wordColors[word] ? { background: wordColors[word], borderColor: wordColors[word], color: '#fff' } : undefined}
            >
              {word}
            </span>
          ))}
        </div>
      </Screen>

      {confirmExit && (
        <div className="overlay">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Napusti meč">
            <div className="modal-icon"><LogOut size={30} /></div>
            <h2>Napusti meč?</h2>
            <p>Izlazak znači predaju. Protivnik će odmah postati pobjednik i nećeš moći da se vratiš u ovaj meč.</p>
            <button className="btn btn-primary" type="button" onClick={exitVersusGame}>Predaj meč</button>
            <button className="btn btn-outline" type="button" onClick={() => setConfirmExit(false)}>Nastavi igrati</button>
          </div>
        </div>
      )}

      {challengeOverlayOpen && (
        <div className="overlay challenge-overlay">
          <div className={`challenge-modal ${incomingChallenge ? 'incoming' : 'outgoing'}`} role="dialog" aria-modal="true" aria-labelledby="challenge-title">
            <button className="challenge-close" type="button" onClick={() => setDismissedChallengeId(entityId(challengeDialog))} title="Sakrij prozor">
              <X size={18} />
            </button>
            <div className="challenge-emblem"><Swords size={28} /></div>
            <span className="challenge-kicker">{incomingChallenge ? 'Novi Versus izazov' : 'Izazov je poslat'}</span>
            <h2 id="challenge-title">
              {incomingChallenge
                ? `${incomingChallenge.IzazivacIme} te izaziva`
                : `Čeka se odgovor korisnika ${outgoingChallenge.ProtivnikIme}`}
            </h2>
            <div className="challenge-details">
              <div><span>Tema</span><strong>{displayThemeLabel(challengeDialog.TemaNaziv)}</strong></div>
              <div><span>Težina</span><strong>{challengeDifficulty?.label || challengeDialog.Tezina}</strong></div>
            </div>
            {incomingChallenge && (
              <div className={`challenge-countdown ${challengeSecondsLeft <= 3 ? 'urgent' : ''}`}>
                Vrijeme za odgovor: <strong>{challengeSecondsLeft}s</strong>
              </div>
            )}
            {incomingChallenge ? (
              <div className="challenge-actions">
                <button className="btn btn-outline" type="button" onClick={() => rejectIncomingChallenge(incomingChallenge)}><X size={18} />Odbij</button>
                <button className="btn btn-teal" type="button" disabled={challengeSecondsLeft === 0} onClick={() => acceptIncomingChallenge(incomingChallenge)}><Check size={18} />Prihvati i igraj</button>
              </div>
            ) : (
              <>
                <div className="challenge-waiting"><span />Zahtjev poslat, ceka se odgovor...</div>
                <button className="btn btn-outline" type="button" onClick={() => setDismissedChallengeId(entityId(outgoingChallenge))}>Nastavi koristiti aplikaciju</button>
              </>
            )}
          </div>
        </div>
      )}

      {result && <div className="overlay"><div className="modal"><div className="modal-icon"><Trophy size={34} /></div><h2>{result.title}</h2><div className="score-big">{result.score}</div><p>{result.message}</p><button className="btn btn-teal" type="button" onClick={() => { finishingRef.current = false; setResult(null); setScreen('home'); refreshSocial(); }}>Igraj ponovo</button><button className="btn btn-outline" type="button" onClick={goHome}>Početna</button></div></div>}
      {turnPopup && <div className="overlay"><div className="modal small-modal"><div className="modal-icon">...</div><h2>{turnPopup.title}</h2><p>{turnPopup.message}</p></div></div>}
    </>
  );
}

export default App;
