// routes/news.js — музыкальные новости через The Guardian API + NME RSS
const express = require('express');
const axios   = require('axios');
const Parser  = require('rss-parser');
const router  = express.Router();

const rss = new Parser({
  customFields: {
    item: [
      ['media:content',   'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure',       'enclosure'],
    ],
  },
});

// Кеш на 10 минут — чтобы не долбить API при каждом рефреше
let cache = { data: null, ts: 0 };
const CACHE_TTL = 10 * 60 * 1000;

router.get('/news', async (req, res) => {
  const force = req.query.refresh === '1';

  if (!force && cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return res.json(cache.data);
  }

  const articles = [];

  // ── Source 1: The Guardian Music (ключ "test" — бесплатно, без регистрации) ──
  try {
    const { data } = await axios.get('https://content.guardianapis.com/music', {
      params: {
        'api-key':     'test',
        'show-fields': 'thumbnail,trailText',
        'page-size':   12,
        'order-by':    'newest',
      },
      timeout: 6000,
    });

    for (const item of data.response?.results ?? []) {
      articles.push({
        title:   item.webTitle || '',
        summary: (item.fields?.trailText || '').replace(/<[^>]*>/g, '').slice(0, 240),
        url:     item.webUrl || '',
        image:   item.fields?.thumbnail || null,
        source:  'The Guardian',
        date:    item.webPublicationDate
          ? new Date(item.webPublicationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '',
        iso: item.webPublicationDate || '',
      });
    }
  } catch (err) {
    console.error('[news] Guardian:', err.message);
  }

  // ── Source 2: NME RSS ──
  try {
    const feed = await rss.parseURL('https://www.nme.com/feed');
    for (const item of feed.items.slice(0, 8)) {
      const image =
        item.mediaContent?.$?.url ||
        item.mediaThumbnail?.$?.url ||
        item.enclosure?.url ||
        null;

      articles.push({
        title:   item.title || '',
        summary: (item.contentSnippet || '').slice(0, 240),
        url:     item.link || '',
        image,
        source:  'NME',
        date:    item.pubDate
          ? new Date(item.pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '',
        iso: item.pubDate || '',
      });
    }
  } catch (err) {
    console.error('[news] NME RSS:', err.message);
  }

  // Сортируем по дате (свежее сначала)
  articles.sort((a, b) => new Date(b.iso || 0) - new Date(a.iso || 0));

  const result = { articles: articles.slice(0, 15), cached_at: new Date().toISOString() };
  cache = { data: result, ts: Date.now() };
  res.json(result);
});

module.exports = router;
