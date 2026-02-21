const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect('/search');
  }
  res.sendFile(path.join(__dirname, '..', 'views', 'login.html'));
});

router.get('/search', (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '..', 'views', 'search.html'));
});

router.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'terms.html'));
});

module.exports = router;
