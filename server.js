/*
 * TabMail — Server Entry Point
 *
 * TabMail is a non-commercial, personal-use web application that helps friends
 * and family send guitar chord sheets (as PDFs) to a missionary who has email
 * access but cannot browse the web.
 *
 * This project is NOT operated for profit. There is no revenue, advertising,
 * data collection, analytics, or tracking. It is a family project built with
 * love, intended for a small private group of users (5-20 people).
 *
 * Chord sheets are sourced from publicly available guitar tab websites.
 * TabMail does not host, permanently store, or claim ownership of any chord
 * sheets or lyrics. All content belongs to its respective authors and rights
 * holders. This tool operates at minimal scale for personal, non-commercial,
 * fair-use purposes.
 *
 * No database. No user accounts. No persistent data. Just search → PDF → email.
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const pageRoutes = require('./routes/pages');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (behind Conway's reverse proxy)
app.set('trust proxy', 1);

// Body parsing
app.use(express.json());

// Sessions — simple cookie-based, no persistent store needed for this scale
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: 'lax',
  },
}));

// Rate limiting — keep it generous for family use but prevent abuse
app.use('/api/search', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'Too many searches, please try again later' },
}));

app.use('/api/send', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many sends, please try again later' },
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', authRoutes);
app.use('/', pageRoutes);
app.use('/api', apiRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TabMail running on port ${PORT}`);
});
