# MOODWAVE — AI DJ Көмекшісі

Музыкалық веб-қосымша: настроение сипаттайсың → AI трек тізімін ұсынады → браузерде тікелей ойнатады.

---

## Стек

| Қабат | Технология |
|---|---|
| Backend | Node.js + Express |
| Auth | Spotify OAuth 2.0 (Authorization Code Flow) |
| Frontend | Vanilla JS + GSAP (барлығы `index.html`-де) |
| AI | OpenAI API (GPT-4o-mini) — чат арқылы трек ұсынады |
| Playback | Spotify Web Playback SDK → YouTube IFrame API → iTunes 30s preview |
| News | The Guardian API + NME RSS |

---

## Жоба құрылымы

```
MOODWAVE/
├── index.html          # Барлық фронтенд: CSS + HTML + JS (~4400 жол)
├── server.js           # Express сервері, сессиялар, статика
├── src/
│   └── spotify.js      # Фронтенд Spotify API обёртка + Web Playback SDK
├── routes/
│   ├── auth.js         # Spotify OAuth: /auth/login, /auth/callback, /auth/token, /auth/logout
│   ├── spotify.js      # Spotify API прокси: /api/search, /api/recommendations, /api/lookup, /api/me
│   └── news.js         # Музыкалық жаңалықтар: /api/news (Guardian + NME RSS)
├── assets/
│   ├── bg-ornament.png # Фондық орнамент
│   └── penguin-dance.gif
├── .env.example        # Орта айнымалылардың үлгісі
├── package.json
└── .gitignore
```

---

## Іске қосу

### 1. Репозиторийді клондаңыз

```bash
git clone <repo-url>
cd MOODWAVE
```

### 2. Тәуелділіктерді орнатыңыз

```bash
npm install
```

### 3. Spotify Developer қосымшасын жасаңыз

1. [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → **Create app**
2. App settings → **Redirect URIs** → `http://localhost:3000/auth/callback` қосыңыз
3. **Client ID** мен **Client Secret**-ті сақтаңыз

### 4. `.env` файлын жасаңыз

```bash
cp .env.example .env
```

`.env` файлын өз мәндеріңізбен толтырыңыз:

```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/callback
SESSION_SECRET=кез_келген_кездейсоқ_сөз
PORT=3000
```

### 5. Серверді іске қосыңыз

```bash
npm run dev    # nodemon (hot reload)
# немесе
npm start      # node
```

Браузерде ашыңыз: **http://localhost:3000**

---

## OpenAI API кілті

AI DJ чаты үшін OpenAI API кілті керек. Ол **серверде сақталмайды** — тек браузердің `localStorage`-інде.

1. Беттегі тісберек (⚙) белгісін басыңыз
2. **OpenAI API Кілті** өрісіне `sk-...` кілтіңізді енгізіңіз
3. Кілт браузерде жергілікті сақталады

API кілтін [platform.openai.com](https://platform.openai.com/api-keys) сайтынан алуға болады.

---

## Spotify ойнату

Толық трек ойнату үшін **Spotify Premium** аккаунты керек.

- **Premium бар** → Spotify Web Playback SDK арқылы толық трек ойнатылады
- **Premium жоқ** → YouTube → iTunes 30с превью тізбегі автоматты іске қосылады

Тісберек менюде **Spotify-ке кіру** батырмасын басыңыз.

---

## API эндпойнттары

### Auth
| Эндпойнт | Сипаттама |
|---|---|
| `GET /auth/login` | Spotify авторизация бетіне бағыттайды |
| `GET /auth/callback` | Spotify кодты осыған қайтарады |
| `GET /auth/token` | Фронтендке access token береді (автожаңарту бар) |
| `GET /auth/logout` | Сессияны жояды |
| `GET /auth/status` | `{ authenticated: true/false }` |

### Spotify API (авторизация керек)
| Эндпойнт | Параметрлер | Сипаттама |
|---|---|---|
| `GET /api/search` | `q`, `limit`, `market` | Трек іздеу |
| `GET /api/recommendations` | `genres`, `energy`, `valence`, `limit` | Настроение бойынша ұсыныс |
| `GET /api/me` | — | Пайдаланушы ақпараты |
| `GET /api/lookup` | `q` | Трек іздеу (авторизациясыз, Client Credentials) |

### Жаңалықтар
| Эндпойнт | Параметрлер | Сипаттама |
|---|---|---|
| `GET /api/news` | `refresh=1` (опц.) | The Guardian + NME жаңалықтары (10 мин кэш) |

---

## Фронтенд ішкі құрылымы (`index.html`)

`index.html` бір файлда бірнеше бөлімді қамтиды:

| Бөлім | Сипаттама |
|---|---|
| **`#home-view`** | Басты бет, Hero секция, жанрлар карусель, стек-галерея |
| **`#player-view`** | AI DJ чаты + музыка плеері (left sidebar) |
| **`#news-view`** | Музыкалық жаңалықтар |
| **`#create-view`** | Suno AI арқылы музыка жасау беті |

Чаттың негізгі логикасы `index.html`-дің соңғы `<script>` блогында орналасқан. Маңызды айнымалылар:

```js
queue          // трек кезегі
chatHistory    // чат тарихы (localStorage-та сақталады)
spotifyEnabled // Spotify SDK дайын болса — true
currentSource  // 'spotify' | 'youtube' | 'preview'
```

---

## Дамыту кезінде ескерулер

- **Сессия жадта сақталады** — сервер қайта іске қосылса, барлық Spotify токендері жоғалады. Продакшен үшін Redis/DB керек.
- **CSRF** — OAuth state параметрі оқу ортасы үшін тұрақты жол (`moodwave_state`). Продакшен үшін `crypto.randomUUID()` қолданыңыз.
- **YouTube IDs** — `index.html`-де ~80 танымал трек үшін тексерілген ID-лер бар. Жаңа трек қосу үшін `VERIFIED_YOUTUBE_IDS` объектін толтырыңыз.
- **iTunes enrichment** — авторизациясыз жұмыс істейді, трек суреті мен 30с превью үшін CORS-friendly.

---

## Тез тексеру

Сервер іске қосылғаннан кейін:

```bash
# Spotify іздеу (авторизация керек)
curl http://localhost:3000/api/lookup?q=Nightcall+Kavinsky

# Жаңалықтар
curl http://localhost:3000/api/news
```
