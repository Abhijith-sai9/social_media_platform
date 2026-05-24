const express = require('express');
const db = require('../db');
const { authRequired, authOptional } = require('../middleware/auth');
const { enrichPosts } = require('./users');

const router = express.Router();

const postSelect = `
  SELECT p.*, u.username, u.avatar_url
  FROM posts p JOIN users u ON u.id = p.user_id
`;

router.get('/feed', authRequired, (req, res) => {
  const rows = db
    .prepare(
      `${postSelect}
       WHERE p.user_id = ? OR p.user_id IN (
         SELECT following_id FROM followers WHERE follower_id = ?
       )
       ORDER BY p.created_at DESC
       LIMIT 50`
    )
    .all(req.user.id, req.user.id);
  res.json({ posts: enrichPosts(rows, req.user.id) });
});

router.get('/', authOptional, (req, res) => {
  const rows = db
    .prepare(`${postSelect} ORDER BY p.created_at DESC LIMIT 50`)
    .all();
  res.json({ posts: enrichPosts(rows, req.user?.id) });
});

router.post('/', authRequired, (req, res) => {
  const content = req.body.content?.trim();
  if (!content) return res.status(400).json({ error: 'Post content is required' });
  if (content.length > 2000) {
    return res.status(400).json({ error: 'Post is too long (max 2000 characters)' });
  }

  const result = db
    .prepare('INSERT INTO posts (user_id, content) VALUES (?, ?)')
    .run(req.user.id, content);

  const row = db
    .prepare(`${postSelect} WHERE p.id = ?`)
    .get(result.lastInsertRowid);
  res.status(201).json({ post: enrichPosts([row], req.user.id)[0] });
});

router.delete('/:id', authRequired, (req, res) => {
  const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own posts' });
  }
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

router.post('/:id/like', authRequired, (req, res) => {
  const postId = Number(req.params.id);
  if (!db.prepare('SELECT id FROM posts WHERE id = ?').get(postId)) {
    return res.status(404).json({ error: 'Post not found' });
  }
  try {
    db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(
      req.user.id,
      postId
    );
  } catch (err) {
    if (err.code !== 'SQLITE_CONSTRAINT_PRIMARYKEY') throw err;
  }
  const like_count = db
    .prepare('SELECT COUNT(*) AS c FROM likes WHERE post_id = ?')
    .get(postId).c;
  res.json({ liked: true, like_count });
});

router.delete('/:id/like', authRequired, (req, res) => {
  const postId = Number(req.params.id);
  db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(
    req.user.id,
    postId
  );
  const like_count = db
    .prepare('SELECT COUNT(*) AS c FROM likes WHERE post_id = ?')
    .get(postId).c;
  res.json({ liked: false, like_count });
});

router.get('/:id/comments', authOptional, (req, res) => {
  const postId = Number(req.params.id);
  if (!db.prepare('SELECT id FROM posts WHERE id = ?').get(postId)) {
    return res.status(404).json({ error: 'Post not found' });
  }
  const comments = db
    .prepare(
      `SELECT c.*, u.username, u.avatar_url
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC`
    )
    .all(postId)
    .map((c) => ({
      id: c.id,
      post_id: c.post_id,
      content: c.content,
      created_at: c.created_at,
      author: { id: c.user_id, username: c.username, avatar_url: c.avatar_url },
    }));
  res.json({ comments });
});

router.post('/:id/comments', authRequired, (req, res) => {
  const postId = Number(req.params.id);
  const content = req.body.content?.trim();
  if (!content) return res.status(400).json({ error: 'Comment content is required' });
  if (!db.prepare('SELECT id FROM posts WHERE id = ?').get(postId)) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const result = db
    .prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)')
    .run(postId, req.user.id, content.slice(0, 1000));

  const c = db
    .prepare(
      `SELECT c.*, u.username, u.avatar_url
       FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(result.lastInsertRowid);

  res.status(201).json({
    comment: {
      id: c.id,
      post_id: c.post_id,
      content: c.content,
      created_at: c.created_at,
      author: { id: c.user_id, username: c.username, avatar_url: c.avatar_url },
    },
  });
});

module.exports = router;
