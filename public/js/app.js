// ==========================================
// УПРАВЛЕНИЕ ТЕМОЙ (Строгий контроль переходов)
// ==========================================

const themeToggleBtn = document.getElementById('theme-toggle');
const iconSun = themeToggleBtn?.querySelector('.icon-sun');
const iconMoon = themeToggleBtn?.querySelector('.icon-moon');

function applyTheme(theme) {
  // 1. Добавляем класс, который включает ТОЛЬКО цветовые переходы
  document.body.classList.add('theme-color-transition');
  
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    iconSun?.classList.add('hidden');
    iconMoon?.classList.remove('hidden');
  } else {
    document.documentElement.removeAttribute('data-theme');
    iconSun?.classList.remove('hidden');
    iconMoon?.classList.add('hidden');
  }
  localStorage.setItem('theme', theme);
  
  // 2. Убираем класс после завершения перехода (400мс), 
  // чтобы обычные hover-эффекты (transform) работали мгновенно
  setTimeout(() => {
    document.body.classList.remove('theme-color-transition');
  }, 450);
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    // Применяем без анимации при первой загрузке
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      iconSun?.classList.add('hidden');
      iconMoon?.classList.remove('hidden');
    } else {
      iconSun?.classList.remove('hidden');
      iconMoon?.classList.add('hidden');
    }
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      iconSun?.classList.add('hidden');
      iconMoon?.classList.remove('hidden');
    } else {
      iconSun?.classList.remove('hidden');
      iconMoon?.classList.add('hidden');
    }
  }
}

themeToggleBtn?.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('theme')) {
    applyTheme(e.matches ? 'dark' : 'light');
  }
});

initTheme();

// ... ДАЛЕЕ ВАШ СУЩЕСТВУЮЩИЙ КОД ...
import { initAvatar } from './avatar.js';
import { initCourse } from './listener.js';
import { initChat, initProfile } from './chat.js';

const socket = io();

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
  }
}

export function updateUserHeader() {
  currentUser = getCurrentUser();
  if (!currentUser) return;
  const nickEl = document.getElementById('user-nick-header');
  if (nickEl) nickEl.textContent = currentUser.nickname;
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

export { socket };

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initAvatar();
  initCourse();
  initChat();
  initProfile();
});
