import { api } from './api.js';

let currentUser = api.getStoredUser();
let viewUserId = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function avatarHtml(user, size = '') {
  const cls = `avatar ${size}`.trim();
  if (user?.avatar_url) {
    return `<img class="${cls}" src="${escapeAttr(user.avatar_url)}" alt="">`;
  }
  return `<span class="${cls} avatar-fallback">${initials(user?.username)}</span>`;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function showScreen(id) {
  $$('.screen').forEach((el) => el.classList.remove('active'));
  $(`#${id}`)?.classList.add('active');
}

function updateNav() {
  const nav = $('#main-nav');
  if (!currentUser) {
    nav.innerHTML = '';
    return;
  }
  nav.innerHTML = `
    <a href="#" data-view="feed" class="nav-link active">Feed</a>
    <a href="#" data-view="discover" class="nav-link">Discover</a>
    <a href="#" data-view="profile" data-user-id="${currentUser.id}" class="nav-link">Profile</a>
    <button type="button" id="btn-logout" class="btn btn-ghost btn-sm">Log out</button>
  `;
  nav.querySelector('#btn-logout').addEventListener('click', logout);
  nav.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      nav.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
      const view = link.dataset.view;
      if (view === 'feed') loadFeed();
      else if (view === 'discover') loadDiscover();
      else if (view === 'profile') openProfile(Number(link.dataset.userId));
    });
  });
}

async function init() {
  if (api.getToken()) {
    try {
      const { user } = await api.me();
      currentUser = user;
      api.setAuth(api.getToken(), user);
      enterApp();
    } catch {
      api.setAuth(null, null);
      showScreen('auth-screen');
    }
  } else {
    showScreen('auth-screen');
  }
  bindAuthForms();
}

function enterApp() {
  showScreen('app-screen');
  updateNav();
  document.querySelector('.logo')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('[data-view="feed"]')?.click();
  });
  loadFeed();
}

function bindAuthForms() {
  $('#auth-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    $$('#auth-tabs [data-tab]').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    $('#login-form').classList.toggle('hidden', tab.dataset.tab !== 'login');
    $('#register-form').classList.toggle('hidden', tab.dataset.tab !== 'register');
    $('#auth-error').textContent = '';
  });

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await api.login({
        login: fd.get('login'),
        password: fd.get('password'),
      });
      currentUser = data.user;
      api.setAuth(data.token, data.user);
      enterApp();
    } catch (err) {
      $('#auth-error').textContent = err.message;
    }
  });

  $('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await api.register({
        username: fd.get('username'),
        email: fd.get('email'),
        password: fd.get('password'),
      });
      currentUser = data.user;
      api.setAuth(data.token, data.user);
      enterApp();
    } catch (err) {
      $('#auth-error').textContent = err.message;
    }
  });
}

function logout() {
  api.setAuth(null, null);
  currentUser = null;
  showScreen('auth-screen');
  $('#main-nav').innerHTML = '';
}

async function loadFeed() {
  $('#page-title').textContent = 'Your feed';
  $('#profile-view').innerHTML = '';
  $('#composer').classList.remove('hidden');
  try {
    const { posts } = await api.getFeed();
    renderPosts(posts, '#posts-list');
  } catch (err) {
    $('#posts-list').innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
}

async function loadDiscover() {
  $('#page-title').textContent = 'Discover';
  $('#profile-view').innerHTML = '';
  $('#composer').classList.add('hidden');
  try {
    const { posts } = await api.getAllPosts();
    renderPosts(posts, '#posts-list');
  } catch (err) {
    $('#posts-list').innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
}

$('#composer-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#post-content');
  const content = input.value.trim();
  if (!content) return;
  try {
    await api.createPost(content);
    input.value = '';
    loadFeed();
  } catch (err) {
    alert(err.message);
  }
});

function renderPosts(posts, containerSel) {
  const el = $(containerSel);
  if (!posts.length) {
    el.innerHTML = '<p class="empty-state">No posts yet. Be the first to share something!</p>';
    return;
  }
  el.innerHTML = posts.map((p) => postCardHtml(p)).join('');
  el.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => handlePostAction(btn));
  });
}

function postCardHtml(post) {
  const canDelete = currentUser && post.user_id === currentUser.id;
  return `
    <article class="post-card" data-post-id="${post.id}">
      <header class="post-header">
        ${avatarHtml({ username: post.author.username, avatar_url: post.author.avatar_url })}
        <div class="post-meta">
          <a href="#" class="author-link" data-user-id="${post.user_id}">@${escapeHtml(post.author.username)}</a>
          <span class="time">${timeAgo(post.created_at)}</span>
        </div>
        ${canDelete ? '<button type="button" class="btn-icon" data-action="delete" title="Delete">×</button>' : ''}
      </header>
      <p class="post-body">${escapeHtml(post.content)}</p>
      <footer class="post-actions">
        <button type="button" class="action-btn ${post.liked_by_me ? 'liked' : ''}" data-action="like">
          ♥ <span>${post.like_count}</span>
        </button>
        <button type="button" class="action-btn" data-action="comments">
          💬 <span>${post.comment_count}</span>
        </button>
      </footer>
      <div class="comments-panel hidden" data-comments-for="${post.id}">
        <div class="comments-list"></div>
        <form class="comment-form">
          <input type="text" name="content" placeholder="Write a comment..." maxlength="1000" required>
          <button type="submit" class="btn btn-primary btn-sm">Post</button>
        </form>
      </div>
    </article>
  `;
}

async function handlePostAction(btn) {
  const card = btn.closest('.post-card');
  const postId = Number(card.dataset.postId);
  const action = btn.dataset.action;

  if (action === 'delete') {
    if (!confirm('Delete this post?')) return;
    await api.deletePost(postId);
    card.remove();
    return;
  }

  if (action === 'like') {
    const liked = btn.classList.contains('liked');
    try {
      const res = await api.toggleLike({ id: postId }, liked);
      btn.classList.toggle('liked', res.liked !== false);
      btn.querySelector('span').textContent = res.like_count;
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  if (action === 'comments') {
    const panel = card.querySelector('.comments-panel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      await loadComments(postId, panel);
    }
  }

}

document.addEventListener('click', (e) => {
  const link = e.target.closest('.author-link');
  if (link) {
    e.preventDefault();
    openProfile(Number(link.dataset.userId));
  }
});

async function loadComments(postId, panel) {
  const list = panel.querySelector('.comments-list');
  const form = panel.querySelector('.comment-form');
  try {
    const { comments } = await api.getComments(postId);
    list.innerHTML =
      comments.length === 0
        ? '<p class="muted">No comments yet.</p>'
        : comments
            .map(
              (c) => `
        <div class="comment">
          ${avatarHtml(c.author, 'sm')}
          <div>
            <strong>@${escapeHtml(c.author.username)}</strong>
            <span class="time">${timeAgo(c.created_at)}</span>
            <p>${escapeHtml(c.content)}</p>
          </div>
        </div>`
            )
            .join('');

    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const input = form.querySelector('input');
      const content = input.value.trim();
      if (!content) return;
      await api.addComment(postId, content);
      input.value = '';
      await loadComments(postId, panel);
      const card = document.querySelector(`[data-post-id="${postId}"]`);
      const countBtn = card?.querySelector('[data-action="comments"] span');
      if (countBtn) countBtn.textContent = Number(countBtn.textContent) + 1;
    };
  } catch (err) {
    list.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
}

async function openProfile(userId) {
  viewUserId = userId;
  $('#page-title').textContent = 'Profile';
  $('#composer').classList.add('hidden');
  const main = $('#profile-view');
  main.classList.remove('hidden');
  $('#posts-list').innerHTML = '<p class="muted">Loading...</p>';

  try {
    const { user, stats, isOwnProfile } = await api.getUser(userId);
    const { posts } = await api.getUserPosts(userId);

    main.innerHTML = `
      <div class="profile-card">
        ${avatarHtml(user, 'lg')}
        <div class="profile-info">
          <h2>@${escapeHtml(user.username)}</h2>
          <p class="bio">${user.bio ? escapeHtml(user.bio) : '<span class="muted">No bio yet</span>'}</p>
          <div class="profile-stats">
            <span><strong>${stats.posts}</strong> posts</span>
            <span><strong>${stats.followers}</strong> followers</span>
            <span><strong>${stats.following}</strong> following</span>
          </div>
          ${
            isOwnProfile
              ? `<button type="button" class="btn btn-secondary btn-sm" id="btn-edit-profile">Edit profile</button>`
              : stats.isFollowing !== undefined && !isOwnProfile
                ? `<button type="button" class="btn ${stats.isFollowing ? 'btn-secondary' : 'btn-primary'} btn-sm" id="btn-follow">
                    ${stats.isFollowing ? 'Unfollow' : 'Follow'}
                   </button>`
                : ''
          }
        </div>
      </div>
      <div id="edit-profile-form" class="hidden card">
        <h3>Edit profile</h3>
        <form>
          <label>Bio<textarea name="bio" rows="3" maxlength="500">${escapeHtml(user.bio || '')}</textarea></label>
          <label>Avatar URL<input type="url" name="avatar_url" value="${escapeAttr(user.avatar_url || '')}" placeholder="https://..."></label>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary btn-sm">Save</button>
            <button type="button" class="btn btn-ghost btn-sm" id="cancel-edit">Cancel</button>
          </div>
        </form>
      </div>
    `;

    if (isOwnProfile) {
      main.querySelector('#btn-edit-profile').addEventListener('click', () => {
        main.querySelector('#edit-profile-form').classList.remove('hidden');
      });
      main.querySelector('#cancel-edit').addEventListener('click', () => {
        main.querySelector('#edit-profile-form').classList.add('hidden');
      });
      main.querySelector('#edit-profile-form form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const { user: updated } = await api.updateProfile(userId, {
          bio: fd.get('bio'),
          avatar_url: fd.get('avatar_url'),
        });
        currentUser = updated;
        api.setAuth(api.getToken(), updated);
        openProfile(userId);
      });
    } else if (main.querySelector('#btn-follow')) {
      main.querySelector('#btn-follow').addEventListener('click', async () => {
        const btn = main.querySelector('#btn-follow');
        const following = btn.textContent.trim() === 'Unfollow';
        const res = following
          ? await api.unfollow(userId)
          : await api.follow(userId);
        btn.textContent = res.following ? 'Unfollow' : 'Follow';
        btn.className = `btn ${res.following ? 'btn-secondary' : 'btn-primary'} btn-sm`;
        const statsEl = main.querySelector('.profile-stats');
        statsEl.innerHTML = `
          <span><strong>${res.stats.posts}</strong> posts</span>
          <span><strong>${res.stats.followers}</strong> followers</span>
          <span><strong>${res.stats.following}</strong> following</span>`;
      });
    }

    renderPosts(posts, '#posts-list');
  } catch (err) {
    $('#posts-list').innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
}

init();
