require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const session  = require('express-session');
const path     = require('path');

const authRouter    = require('./routes/auth');
const spotifyRouter = require('./routes/spotify');
const newsRouter    = require('./routes/news');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------

app.use(express.json());

// Разрешаем fetch-запросы с фронтенда на тот же origin
app.use(cors({
  origin: `http://localhost:${PORT}`,
  credentials: true, // нужно, чтобы сессионные куки передавались
}));

// Сессии — хранят access_token и refresh_token на сервере (в памяти)
// Для локальной демки этого достаточно; в продакшне — Redis или БД
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,     // false = работает по http (localhost)
    maxAge: 3_600_000, // 1 час в миллисекундах
  },
}));

// ---------- Статичный фронтенд ----------
// Сервер сам отдаёт index.html на http://localhost:3000
app.use(express.static(path.join(__dirname)));

// ---------- Роуты ----------

app.use('/auth', authRouter);   // /auth/login, /auth/callback, /auth/token, /auth/logout
app.use('/api',  spotifyRouter); // /api/search, /api/recommendations
app.use('/api',  newsRouter);    // /api/news

// ---------- Запуск ----------

app.listen(PORT, () => {
  console.log(`\n  MOODWAVE server → http://localhost:${PORT}\n`);
  console.log('  Spotify login → http://localhost:' + PORT + '/auth/login');
  console.log('  Search demo  → http://localhost:' + PORT + '/api/search?q=chill\n');
});
