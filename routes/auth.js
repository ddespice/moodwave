// routes/auth.js — Spotify Authorization Code Flow
// Документация: https://developer.spotify.com/documentation/web-api/tutorials/code-flow

const express = require('express');
const axios   = require('axios');
const router  = express.Router();

const CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI  = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/auth/callback';

// Что разрешаем делать от имени пользователя
const SCOPES = [
  'streaming',                   // Web Playback SDK — воспроизведение треков
  'user-read-email',             // e-mail пользователя
  'user-read-private',           // тип аккаунта (нужен для SDK — требует Premium)
  'user-read-playback-state',    // текущее состояние плеера
  'user-modify-playback-state',  // пауза, переключение треков
].join(' ');

// Shortcut для Base64 "client_id:client_secret" — Spotify требует это для обмена токенами
function basicAuth() {
  return Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
}

// ---------- Шаг 1: Редирект на Spotify ----------
// Пользователь открывает /auth/login → попадает на страницу авторизации Spotify
router.get('/login', (req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    scope:         SCOPES,
    redirect_uri:  REDIRECT_URI,
    // state — защита от CSRF; в учебном проекте фиксированная строка, в продакшне — crypto.randomUUID()
    state: 'moodwave_state',
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// ---------- Шаг 2: Spotify возвращает code сюда ----------
// После логина Spotify делает GET /auth/callback?code=...&state=...
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    // Пользователь отказался или что-то пошло не так
    return res.redirect('/?error=spotify_denied');
  }

  try {
    // Обмениваем одноразовый code на долгоживущий токен
    const { data } = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth()}`,
        },
      }
    );

    // Сохраняем токены в сессии на сервере — браузер не видит их напрямую
    req.session.access_token     = data.access_token;
    req.session.refresh_token    = data.refresh_token;
    req.session.token_expires_at = Date.now() + data.expires_in * 1000;

    // Возвращаем пользователя на главную с флагом успеха
    res.redirect('/?spotify=connected');
  } catch (err) {
    console.error('[auth/callback] Ошибка обмена кода:', err.response?.data || err.message);
    res.redirect('/?error=token_exchange_failed');
  }
});

// ---------- /auth/token — отдаём access_token фронтенду ----------
// Фронтенд вызывает этот endpoint, чтобы получить токен для Web Playback SDK
// Токен автоматически обновляется, если скоро истечёт
router.get('/token', async (req, res) => {
  if (!req.session.access_token) {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  // Если до истечения меньше 5 минут — обновляем
  if (Date.now() > req.session.token_expires_at - 5 * 60 * 1000) {
    try {
      const { data } = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type:    'refresh_token',
          refresh_token: req.session.refresh_token,
        }),
        {
          headers: {
            'Content-Type':  'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth()}`,
          },
        }
      );

      req.session.access_token     = data.access_token;
      req.session.token_expires_at = Date.now() + data.expires_in * 1000;
      // Spotify иногда возвращает новый refresh_token, иногда нет
      if (data.refresh_token) req.session.refresh_token = data.refresh_token;

    } catch (err) {
      console.error('[auth/token] Ошибка обновления токена:', err.message);
      return res.status(401).json({ error: 'token_refresh_failed' });
    }
  }

  res.json({ access_token: req.session.access_token });
});

// ---------- /auth/logout ----------
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// ---------- /auth/status — проверить, залогинен ли пользователь ----------
router.get('/status', (req, res) => {
  res.json({ authenticated: !!req.session.access_token });
});

module.exports = router;
