const express = require('express');
const router = express.Router();
const { searchTabs, fetchChordSheet } = require('../lib/scraper');
const { generatePDF } = require('../lib/pdf');
const { sendTabEmail, sendReplyEmail } = require('../lib/email');

// Middleware: require auth for search and send
function requireAuth(req, res, next) {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// POST /api/search
router.post('/search', requireAuth, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await searchTabs(query.trim());
    res.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed, please try again' });
  }
});

// POST /api/preview
router.post('/preview', requireAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const sheet = await fetchChordSheet(url);
    res.json({ sheet });
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ error: 'Could not fetch chord sheet' });
  }
});

// POST /api/send
router.post('/send', requireAuth, async (req, res) => {
  try {
    const { url, title, artist } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const sheet = await fetchChordSheet(url);
    const pdfBuffer = await generatePDF(sheet);
    await sendTabEmail(pdfBuffer, { title: sheet.title, artist: sheet.artist });

    res.json({ success: true, title: sheet.title, artist: sheet.artist });
  } catch (err) {
    console.error('Send error:', err);
    res.status(500).json({ error: 'Failed to generate or send PDF' });
  }
});

// POST /api/inbound-email (Mailgun webhook)
router.post('/inbound-email', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const sender = req.body.sender || req.body.from || '';
    const subject = req.body.subject || '';

    // Check allowed senders
    const allowed = (process.env.ALLOWED_SENDERS || '').split(',').map(s => s.trim().toLowerCase());
    const senderEmail = sender.match(/<(.+?)>/) ? sender.match(/<(.+?)>/)[1].toLowerCase() : sender.toLowerCase();

    if (!allowed.includes(senderEmail)) {
      console.log(`Ignoring email from unauthorized sender: ${senderEmail}`);
      return res.status(200).send('ok');
    }

    if (!subject.trim()) {
      console.log('Ignoring email with empty subject');
      return res.status(200).send('ok');
    }

    console.log(`Processing inbound email from ${senderEmail}: "${subject}"`);

    const results = await searchTabs(subject.trim());
    if (results.length === 0) {
      await sendReplyEmail(senderEmail, `Re: ${subject}`,
        `Hey! I couldn't find any chord sheets for "${subject}". Try a different title or include the artist name (e.g., "Foo Fighters - Everlong").`
      );
      return res.status(200).send('ok');
    }

    // Pick the best result
    const best = results[0];
    const sheet = await fetchChordSheet(best.url);
    const pdfBuffer = await generatePDF(sheet);

    await sendReplyEmail(
      senderEmail,
      `Re: ${subject}`,
      `Here are the chords for "${sheet.title}" by ${sheet.artist}. Enjoy!`,
      { filename: `${sheet.artist} - ${sheet.title}.pdf`, content: pdfBuffer }
    );

    console.log(`Sent reply with PDF for "${sheet.title}" to ${senderEmail}`);
    res.status(200).send('ok');
  } catch (err) {
    console.error('Inbound email error:', err);
    res.status(200).send('ok'); // Always 200 to Mailgun so it doesn't retry
  }
});

// GET /api/health
router.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

module.exports = router;
