import { initAuth } from './auth.js';
import { initAvatar } from './avatar.js';
import { initCourse, initTest } from './listener.js';
import { initChat, initProfile } from './chat.js';

const socket = io();
let currentUser = null;
let token = localStorage.getItem('token');

// Проверка сессии при загрузке
if (token) {
  fetch('/api/profile', { headers: { 'Authorization': `Bearer ${token}` } })
    .then(res => res.ok ? res.json() : Promise.reject())
    .then(user => {
      currentUser = user;
      showScreen('main-screen');
      updateUserHeader();
      socket.emit('user-online', user.id);
    })
    .catch(() => {
      localStorage.removeItem('token');
      showScreen('auth-screen');
    });
} else {
  showScreen('auth-screen');
}

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active', 'hidden'));
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  document.getElementById(id).classList.add('active');
}

export function updateUserHeader() {
  if (!currentUser) return;
  document.getElementById('user-nick-header').textContent = currentUser.nickname;
  renderAvatar(currentUser, 'user-avatar-header');
}

export function renderAvatar(user, elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.style.backgroundColor = user.avatar_bg_color;
  el.style.color = isDark(user.avatar_bg_color) ? '#F5F5F5' : '#2C2C2C';
  el.textContent = user.avatar_content;
}

function isDark(color) {
  return ['#7B7167', '#5E6E5E', '#8B9A8B'].includes(color);
}

export { socket, currentUser, token };

// Инициализация модулей
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initAvatar();
  initCourse();
  initTest();
  initChat();
  initProfile();
});
