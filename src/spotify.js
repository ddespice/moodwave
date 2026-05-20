// src/spotify.js — хелперы для работы со Spotify через наш бэкенд
// Подключи в index.html: <script src="/src/spotify.js"></script>

window.SpotifyAPI = (() => {

  // ---------- Auth ----------

  // Перенаправляет пользователя на страницу логина Spotify
  function login() {
    window.location.href = '/auth/login';
  }

  function logout() {
    fetch('/auth/logout').then(() => window.location.reload());
  }

  // Проверяем, залогинен ли пользователь (вызывай при загрузке страницы)
  async function isAuthenticated() {
    try {
      const res  = await fetch('/auth/status', { credentials: 'include' });
      const data = await res.json();
      return data.authenticated;
    } catch {
      return false;
    }
  }

  // Получаем access_token (нужен для Web Playback SDK)
  async function getToken() {
    const res  = await fetch('/auth/token', { credentials: 'include' });
    if (!res.ok) throw new Error('Not authenticated');
    const data = await res.json();
    return data.access_token;
  }

  // ---------- Search ----------

  // Поиск треков по тексту
  // Возвращает массив объектов: { id, name, artists, album, image, uri, preview_url, ... }
  async function search(query, limit = 10) {
    const params = new URLSearchParams({ q: query, limit });
    const res    = await fetch(`/api/search?${params}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const data = await res.json();
    return data.tracks;
  }

  // Рекомендации по параметрам настроения
  // energy:  0.0 (спокойно) → 1.0 (энергично)
  // valence: 0.0 (грустно)  → 1.0 (радостно)
  async function recommendations({ genres = 'pop', energy = 0.5, valence = 0.5, limit = 10 } = {}) {
    const params = new URLSearchParams({ genres, energy, valence, limit });
    const res    = await fetch(`/api/recommendations?${params}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Recommendations failed: ${res.status}`);
    const data = await res.json();
    return data.tracks;
  }

  // Информация о пользователе
  async function getMe() {
    const res  = await fetch('/api/me', { credentials: 'include' });
    if (!res.ok) return null;
    return res.json();
  }

  // ---------- Web Playback SDK ----------
  // Требует: Premium аккаунт + скрипт Spotify SDK (подключи в HTML)
  // <script src="https://sdk.scdn.co/spotify-player.js"></script>

  let player = null;

  async function initPlayer(playerName = 'MOODWAVE Player') {
    const token = await getToken();

    return new Promise((resolve, reject) => {
      // SDK вызывает этот коллбэк, когда готов
      const startInit = () => {
        player = new window.Spotify.Player({
          name:               playerName,
          volume:             0.8,
          // SDK сам запрашивает свежий токен через этот коллбэк
          getOAuthToken: async (cb) => {
            const freshToken = await getToken();
            cb(freshToken);
          },
        });

        player.addListener('ready', ({ device_id }) => {
          console.log('[Spotify SDK] Ready, device_id:', device_id);
          resolve({ player, device_id });
        });

        player.addListener('not_ready', ({ device_id }) => {
          console.warn('[Spotify SDK] Device offline:', device_id);
        });

        player.addListener('player_state_changed', (state) => {
          if (!state) return;
          // Здесь можно обновлять UI: текущий трек, прогресс, пауза/играет
          console.log('[Spotify SDK] State:', state);
        });

        player.addListener('initialization_error', ({ message }) => {
          reject(new Error(`Init error: ${message}`));
        });

        player.addListener('authentication_error', ({ message }) => {
          reject(new Error(`Auth error: ${message}`));
        });

        player.addListener('account_error', ({ message }) => {
          reject(new Error(`Account error (нужен Premium): ${message}`));
        });

        player.connect();
      };

      // SDK мог уже загрузиться (window.Spotify готов) — тогда запускаем сразу,
      // иначе ждём официальный коллбэк
      if (window.Spotify && window.Spotify.Player) {
        startInit();
      } else {
        window.onSpotifyWebPlaybackSDKReady = startInit;
      }
    });
  }

  // Воспроизвести трек по Spotify URI (нужен device_id из initPlayer)
  async function playTrack(uri, device_id) {
    const token = await getToken();
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
      method:  'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ uris: [uri] }),
    });
  }

  return { login, logout, isAuthenticated, getToken, search, recommendations, getMe, initPlayer, playTrack };
})();

// ---------- Пример использования ----------
//
// 1. Проверить авторизацию при загрузке страницы:
//    const loggedIn = await Spotify.isAuthenticated();
//    if (!loggedIn) Spotify.login();
//
// 2. Поиск треков:
//    const tracks = await Spotify.search('late night drive', 5);
//    tracks.forEach(t => console.log(t.name, '—', t.artists));
//
// 3. Рекомендации по настроению:
//    const tracks = await Spotify.recommendations({ genres: 'indie', energy: 0.3, valence: 0.2 });
//
// 4. Web Playback SDK:
//    const { player, device_id } = await Spotify.initPlayer('MOODWAVE');
//    await Spotify.playTrack('spotify:track:...', device_id);
//
// 5. Кнопка логина:
//    document.getElementById('loginBtn').addEventListener('click', Spotify.login);

// Читаем URL-параметры после редиректа
(function handleRedirectParams() {
  const params = new URLSearchParams(window.location.search);

  if (params.get('spotify') === 'connected') {
    console.log('✓ Spotify подключён!');
    // Убираем параметр из URL
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (params.get('error')) {
    console.error('Ошибка Spotify:', params.get('error'));
    window.history.replaceState({}, '', window.location.pathname);
  }
})();
