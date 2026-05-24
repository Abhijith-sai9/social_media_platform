const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, authRequired } = require('../middleware/auth');

const router = express.Router();

const userPublic = db.prepare(`
  SELECT id, username, email, bio, avatar_url, created_at FROM users WHERE id = ?
`);

router.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db
      .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
      .run(username.trim(), email.trim().toLowerCase(), hash);
    const user = userPublic.get(result.lastInsertRowid);
    const token = signToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username or email already taken' });
    }
    throw err;
  }
});

router.post('/login', (req, res) => {
  const { login, password } = req.body;
  if (!login?.trim() || !password) {
    return res.status(400).json({ error: 'Login and password are required' });
  }

  const row = db
    .prepare(
      `SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE`
    )
    .get(login.trim(), login.trim().toLowerCase());

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = userPublic.get(row.id);
  res.json({ user, token: signToken(user) });
});

router.get('/me', authRequired, (req, res) => {
  const user = userPublic.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

module.exports = router;
