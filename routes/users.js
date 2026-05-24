const express = require('express');
const db = require('../db');
const { authRequired, authOptional } = require('../middleware/auth');

const router = express.Router();

function profileStats(userId, viewerId) {
  const posts = db.prepare('SELECT COUNT(*) AS c FROM posts WHERE user_id = ?').get(userId).c;
  const followers = db
    .prepare('SELECT COUNT(*) AS c FROM followers WHERE following_id = ?')
    .get(userId).c;
  const following = db
    .prepare('SELECT COUNT(*) AS c FROM followers WHERE follower_id = ?')
    .get(userId).c;
  let isFollowing = false;
  if (viewerId && viewerId !== userId) {
    isFollowing = !!db
      .prepare(
        'SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?'
      )
      .get(viewerId, userId);
  }
  return { posts, followers, following, isFollowing };
}

router.get('/:id', authOptional, (req, res) => {
  const user = db
    .prepare(
      'SELECT id, username, email, bio, avatar_url, created_at FROM users WHERE id = ?'
    )
    .get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const stats = profileStats(user.id, req.user?.id);
  res.json({ user, stats, isOwnProfile: req.user?.id === user.id });
});

router.put('/:id', authRequired, (req, res) => {
  if (Number(req.params.id) !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own profile' });
  }
  const { bio, avatar_url } = req.body;
  db.prepare('UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?').run(
    typeof bio === 'string' ? bio.slice(0, 500) : '',
    typeof avatar_url === 'string' ? avatar_url.slice(0, 500) : '',
    req.user.id
  );
  const user = db
    .prepare(
      'SELECT id, username, email, bio, avatar_url, created_at FROM users WHERE id = ?'
    )
    .get(req.user.id);
  res.json({ user });
});

router.post('/:id/follow', authRequired, (req, res) => {
  const followingId = Number(req.params.id);
  if (followingId === req.user.id) {
    return res.status(400).json({ error: 'You cannot follow yourself' });
  }
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(followingId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  try {
    db.prepare(
      'INSERT INTO followers (follower_id, following_id) VALUES (?, ?)'
    ).run(req.user.id, followingId);
  } catch (err) {
    if (err.code !== 'SQLITE_CONSTRAINT_PRIMARYKEY') throw err;
  }
  res.json({ following: true, stats: profileStats(followingId, req.user.id) });
});

router.delete('/:id/follow', authRequired, (req, res) => {
  const followingId = Number(req.params.id);
  db.prepare(
    'DELETE FROM followers WHERE follower_id = ? AND following_id = ?'
  ).run(req.user.id, followingId);
  res.json({ following: false, stats: profileStats(followingId, req.user.id) });
});

router.get('/:id/posts', authOptional, (req, res) => {
  const userId = Number(req.params.id);
  const posts = enrichPosts(
    db
      .prepare(
        `SELECT p.*, u.username, u.avatar_url
         FROM posts p JOIN users u ON u.id = p.user_id
         WHERE p.user_id = ?
         ORDER BY p.created_at DESC`
      )
      .all(userId),
    req.user?.id
  );
  res.json({ posts });
});

function enrichPosts(rows, viewerId) {
  const likeCount = db.prepare(
    'SELECT COUNT(*) AS c FROM likes WHERE post_id = ?'
  );
  const commentCount = db.prepare(
    'SELECT COUNT(*) AS c FROM comments WHERE post_id = ?'
  );
  const likedByMe = viewerId
    ? db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?')
    : null;

  return rows.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    content: p.content,
    created_at: p.created_at,
    author: { username: p.username, avatar_url: p.avatar_url },
    like_count: likeCount.get(p.id).c,
    comment_count: commentCount.get(p.id).c,
    liked_by_me: viewerId ? !!likedByMe.get(viewerId, p.id) : false,
  }));
}

router.enrichPosts = enrichPosts;
module.exports = router;
