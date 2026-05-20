// routes/spotify.js — прокси к Spotify Web API
// Документация: https://developer.spotify.com/documentation/web-api

const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// ---------- Client Credentials token (не требует логина пользователя) ----------
let _ccToken = null;
let _ccExpiry = 0;

async function getAppToken() {
  if (_ccToken && Date.now() < _ccExpiry) return _ccToken;
  const { data } = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({ grant_type: 'client_credentials' }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
    }
  );
  _ccToken = data.access_token;
  _ccExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _ccToken;
}

// ---------- GET /api/lookup ----------
// Поиск трека без авторизации пользователя (Client Credentials)
// Пример: /api/lookup?q=Nightcall+Kavinsky
router.get('/lookup', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q required' });
  try {
    const token = await getAppToken();
    const { data } = await axios.get('https://api.spotify.com/v1/search', {
      params: { q, type: 'track', limit: 5, market: 'US' },
      headers: { Authorization: `Bearer ${token}` },
    });
    const tracks = data.tracks.items.map(t => ({
      id:          t.id,
      uri:         t.uri,
      name:        t.name,
      artist:      t.artists.map(a => a.name).join(', '),
      image:       t.album.images[1]?.url ?? t.album.images[0]?.url ?? null,
      preview_url: t.preview_url,
      duration_ms: t.duration_ms,
    }));
    res.json({ tracks });
  } catch (err) {
    console.error('[/api/lookup]', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: 'lookup failed' });
  }
});

// Middleware: проверяет, что пользователь авторизован
function requireAuth(req, res, next) {
  if (!req.session.access_token) {
    return res.status(401).json({ error: 'not_authenticated', hint: 'Открой /auth/login' });
  }
  next();
}

// Создаём axios-инстанс с токеном текущего пользователя
function spotifyClient(req) {
  return axios.create({
    baseURL: 'https://api.spotify.com/v1',
    headers: { Authorization: `Bearer ${req.session.access_token}` },
  });
}

// ---------- GET /api/search ----------
// Поиск треков по тексту
// Пример: /api/search?q=rainy+sunday&limit=5
router.get('/search', requireAuth, async (req, res) => {
  const { q, limit = 10, market = 'US' } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Параметр "q" обязателен' });
  }

  try {
    const { data } = await spotifyClient(req).get('/search', {
      params: { q, type: 'track', limit, market },
    });

    // Возвращаем только нужные поля — не весь громоздкий ответ Spotify
    const tracks = data.tracks.items.map(track => ({
      id:          track.id,
      name:        track.name,
      artists:     track.artists.map(a => a.name).join(', '),
      album:       track.album.name,
      image:       track.album.images[1]?.url ?? track.album.images[0]?.url,
      uri:         track.uri,         // spotify:track:... — нужен для SDK
      preview_url: track.preview_url, // 30-секундный превью (может быть null)
      duration_ms: track.duration_ms,
      spotify_url: track.external_urls.spotify,
    }));

    res.json({ tracks });
  } catch (err) {
    console.error('[/api/search]', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.error?.message || 'Search failed',
    });
  }
});

// ---------- GET /api/recommendations ----------
// Рекомендации по настроению через audio features
// Пример: /api/recommendations?energy=0.8&valence=0.3&genres=indie,rock&limit=10
//
// energy  : 0.0 (тихо/спокойно) → 1.0 (громко/бурно)
// valence : 0.0 (грустно/мрачно) → 1.0 (радостно/позитивно)
// genres  : до 5 через запятую — https://api.spotify.com/v1/recommendations/available-genre-seeds
router.get('/recommendations', requireAuth, async (req, res) => {
  const {
    genres  = 'pop',
    energy  = 0.5,
    valence = 0.5,
    limit   = 10,
    market  = 'US',
  } = req.query;

  try {
    const { data } = await spotifyClient(req).get('/recommendations', {
      params: {
        seed_genres:    genres,
        target_energy:  parseFloat(energy),
        target_valence: parseFloat(valence),
        limit,
        market,
      },
    });

    const tracks = data.tracks.map(track => ({
      id:          track.id,
      name:        track.name,
      artists:     track.artists.map(a => a.name).join(', '),
      album:       track.album.name,
      image:       track.album.images[1]?.url ?? track.album.images[0]?.url,
      uri:         track.uri,
      preview_url: track.preview_url,
      duration_ms: track.duration_ms,
    }));

    res.json({ tracks });
  } catch (err) {
    console.error('[/api/recommendations]', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.error?.message || 'Recommendations failed',
    });
  }
});

// ---------- GET /api/me ----------
// Информация о залогиненном пользователе (для отображения в UI)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data } = await spotifyClient(req).get('/me');
    res.json({
      name:    data.display_name,
      email:   data.email,
      image:   data.images?.[0]?.url,
      product: data.product, // 'premium' или 'free' — SDK требует premium
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

module.exports = router;
