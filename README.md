# Connect — Mini Social Media Platform

A full-stack social media app with user profiles, posts, comments, likes, and follows.

## Stack

- **Frontend:** HTML, CSS, JavaScript (ES modules)
- **Backend:** Express.js
- **Database:** SQLite (`better-sqlite3`)

## Features

- **User profiles** — Register, log in, edit bio and avatar
- **Posts & comments** — Create posts, comment on any post
- **Likes** — Like and unlike posts
- **Follow system** — Follow users; personalized feed from people you follow

## Quick start

```bash
npm install
npm start
```

Open[ [http://localhost:3000](http://localhost:3000)](https://codealpha-tasks-social-media-platform.onrender.com) in your browser.

## API overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Log in |
| GET | `/api/auth/me` | Current user |
| GET | `/api/posts/feed` | Feed (you + following) |
| GET | `/api/posts` | All posts (discover) |
| POST | `/api/posts` | Create post |
| POST/DELETE | `/api/posts/:id/like` | Like / unlike |
| GET/POST | `/api/posts/:id/comments` | List / add comments |
| GET | `/api/users/:id` | User profile |
| PUT | `/api/users/:id` | Update own profile |
| POST/DELETE | `/api/users/:id/follow` | Follow / unfollow |

Auth uses JWT in the `Authorization: Bearer <token>` header.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `JWT_SECRET` | dev secret | Set in production |
