const API = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function setAuth(token, user) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
  if (user) localStorage.setItem('user', JSON.stringify(user));
  else localStorage.removeItem('user');
}

function getStoredUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const api = {
  getToken,
  setAuth,
  getStoredUser,
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  getFeed: () => request('/posts/feed'),
  getAllPosts: () => request('/posts'),
  createPost: (content) =>
    request('/posts', { method: 'POST', body: JSON.stringify({ content }) }),
  deletePost: (id) => request(`/posts/${id}`, { method: 'DELETE' }),
  toggleLike: async (post, liked) => {
    const path = `/posts/${post.id}/like`;
    return liked
      ? request(path, { method: 'DELETE' })
      : request(path, { method: 'POST' });
  },
  getComments: (postId) => request(`/posts/${postId}/comments`),
  addComment: (postId, content) =>
    request(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  getUser: (id) => request(`/users/${id}`),
  updateProfile: (id, body) =>
    request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  follow: (id) => request(`/users/${id}/follow`, { method: 'POST' }),
  unfollow: (id) => request(`/users/${id}/follow`, { method: 'DELETE' }),
  getUserPosts: (id) => request(`/users/${id}/posts`),
};
