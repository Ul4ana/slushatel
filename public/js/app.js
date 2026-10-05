import { initAuth } from './auth.js';
import { initAvatar } from './avatar.js';
import { initCourse } from './listener.js';
import { initChat, initProfile } from './chat.js';

const socket = io();

// Надежная функция для получения свежего токена в любой момент
export function getToken() {
  return localStorage.getItem('token');
}

export function getCurrentUser() {
  const userStr = localStorage.getItem('currentUser');
  return userStr ? JSON.parse(userStr) : null;
}

export function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

let currentUser = getCurrentUser();
let token = getToken();

// Проверка сессии при загрузке
if (token) {
  fetch('/api/profile', { headers: { 'Authorization': `Bearer ${token}` } })
    .then(res => res.ok ? res.json() : Promise.reject())
    .then(user => {
      currentUser = user;
      setCurrentUser(user);
      showScreen('main-screen');
      updateUserHeader();
      socket.emit('user-online', user.id);
    })
    .catch(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      showScreen('auth-screen');
    });
} else {
  showScreen('auth-screen');
}

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  const target = document.getElementById(id);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
    // Небольшая задержка для плавной анимации, если она есть
    setTimeout(() => target.classList.add('active'), 10);
  }
}

export function updateUserHeader() {
  currentUser = getCurrentUser();
  if (!currentUser) return;
  const nickEl = document.getElementById('user-nick-header');
  if (nickEl) nickEl.textContent = currentUser.nickname;
  
  // Импортируем renderAvatar динамически, чтобы избежать циклических зависимостей
  import('./avatar.js').then(module => {
    module.renderAvatar(currentUser, 'user-avatar-header');
  });
}

export { socket };

// Инициализация модулей
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initAvatar();
  initCourse();
  initChat();
  initProfile();
});
