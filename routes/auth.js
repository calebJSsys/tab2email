const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Hash password on first request (lazy init)
let hashedPassword = null;

function getHashedPassword() {
  if (!hashedPassword) {
    hashedPassword = bcrypt.hashSync(process.env.SHARED_PASSWORD || 'tabmail', 10);
  }
  return hashedPassword;
}

router.post('/auth', express.urlencoded({ extended: false }), (req, res) => {
  const { password } = req.body;

  if (bcrypt.compareSync(password || '', getHashedPassword())) {
    req.session.authenticated = true;
    return res.redirect('/search');
  }

  return res.redirect('/?error=1');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
