/*
 * TabMail — Tab Scraper
 *
 * Searches for and fetches guitar chord sheets from publicly available sources.
 * This is a non-commercial, personal-use tool for a small family group.
 *
 * Chord sheets are sourced from publicly available guitar tab websites.
 * TabMail does not permanently store, redistribute, or claim ownership of
 * any content. All chord sheets and lyrics belong to their respective authors
 * and rights holders.
 *
 * Primary source: guitartabs.cc
 * Results are cached in-memory for 24 hours to minimize external requests.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const cache = require('./cache');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function httpGet(url, params = {}) {
  return axios.get(url, {
    params,
    headers: {
      'User-Agent': randomUA(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 12000,
  });
}

// Search guitartabs.cc for chord sheets matching the query
async function searchGuitarTabs(query) {
  let band = '', song = '';
  if (query.includes(' - ')) {
    const parts = query.split(' - ');
    band = parts[0].trim();
    song = parts.slice(1).join(' - ').trim();
  } else {
    song = query;
  }

  const params = { tabtype: 0 };
  if (band) params.band = band;
  if (song) params.song = song;

  const { data } = await httpGet('https://www.guitartabs.cc/search.php', params);
  const $ = cheerio.load(data);

  const results = [];
  const seen = new Set();

  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();

    if (!href.includes('/tabs/') || text.length < 3 || href.includes('search.php')) return;
    if (seen.has(href)) return;
    seen.add(href);

    let type = 'tab';
    if (href.includes('_crd') || text.toLowerCase().includes('chord')) type = 'chords';
    if (href.includes('_btab')) type = 'bass tab';
    if (href.includes('_drum')) type = 'drum tab';

    // Skip bass/drum tabs — not useful for this app
    if (type === 'bass tab' || type === 'drum tab') return;

    const fullUrl = href.startsWith('http') ? href : `https://www.guitartabs.cc${href}`;

    results.push({
      title: text.replace(/ (Chords|Tab|Bass Tab|Drum Tab)$/i, '').replace(/\(ver \d+\)\s*/i, '').trim(),
      artist: band || extractArtistFromUrl(href),
      url: fullUrl,
      type,
      rating: 0,
      votes: 0,
      source: 'guitartabs.cc',
    });
  });

  // Sort chords first — more useful for casual playing
  results.sort((a, b) => {
    if (a.type === 'chords' && b.type !== 'chords') return -1;
    if (b.type === 'chords' && a.type !== 'chords') return 1;
    return 0;
  });

  return results.slice(0, 15);
}

function extractArtistFromUrl(href) {
  const match = href.match(/\/tabs\/\w\/([^/]+)\//);
  if (match) {
    return match[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  return 'Unknown';
}

// Fetch the full chord sheet content from a guitartabs.cc page
async function fetchGuitarTabsSheet(url) {
  await delay(500 + Math.random() * 1000);

  const { data } = await httpGet(url);
  const $ = cheerio.load(data);

  const pageTitle = $('title').text();
  let artist = 'Unknown', title = 'Unknown';
  const titleMatch = pageTitle.match(/^(.+?)\s*-\s*(.+?)\s*(Chords|Tab)/i);
  if (titleMatch) {
    artist = titleMatch[1].trim();
    title = titleMatch[2].trim();
  }

  // Content lives in the innermost div within div.tabcont
  const tabcont = $('div.tabcont');
  let content = '';

  const innerDiv = tabcont.find('div').last();
  if (innerDiv.length) {
    let html = innerDiv.html() || '';
    html = html.replace(/<br\s*\/?>/gi, '\n');
    const $inner = cheerio.load(html);
    content = $inner.text();
  }

  if (!content || content.trim().length < 20) {
    content = tabcont.text();
  }

  // Clean up artifacts from the page
  content = content
    .replace(/^\s*Highlighted\s*/gm, '')
    .replace(/^\s*Show chords diagrams\s*/gm, '')
    .replace(/\t/g, '  ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  let capo = 'none';
  const capoMatch = content.match(/[Cc]apo[:\s]+(\d+)/);
  if (capoMatch) capo = capoMatch[1];

  let tuning = 'Standard';
  const tuningMatch = content.match(/[Tt]uning[:\s]+([^\n]+)/);
  if (tuningMatch) tuning = tuningMatch[1].trim();

  return { title, artist, capo, tuning, key: '', content, source: 'guitartabs.cc' };
}

// Public API: search for tabs (with caching)
async function searchTabs(query) {
  const cacheKey = `search:${query.toLowerCase().trim()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let results = [];

  try {
    results = await searchGuitarTabs(query);
  } catch (e) {
    console.error('guitartabs.cc search failed:', e.message);
  }

  if (results.length > 0) {
    cache.set(cacheKey, results);
  }

  return results;
}

// Public API: fetch a chord sheet by URL (with caching)
async function fetchChordSheet(url) {
  const cacheKey = `sheet:${url}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let sheet;

  if (url.includes('guitartabs.cc')) {
    sheet = await fetchGuitarTabsSheet(url);
  } else {
    throw new Error('Unsupported tab source');
  }

  cache.set(cacheKey, sheet);
  return sheet;
}

module.exports = { searchTabs, fetchChordSheet };
