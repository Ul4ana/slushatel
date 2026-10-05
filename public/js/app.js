// ==========================================
// УПРАВЛЕНИЕ ТЕМОЙ
// ==========================================
const themeToggleBtn = document.getElementById('theme-toggle');
const iconSun = themeToggleBtn?.querySelector('.icon-sun');
const iconMoon = themeToggleBtn?.querySelector('.icon-moon');

function applyTheme(theme) {
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
  setTimeout(() => document.body.classList.remove('theme-color-transition'), 450);
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
}

themeToggleBtn?.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('theme')) applyTheme(e.matches ? 'dark' : 'light');
});

initTheme();

// ==========================================
// ИМПОРТЫ
// ==========================================
import { initAuth } from './auth.js';
import { initAvatar } from './avatar.js';
import { initCourse } from './listener.js';
import { initChat, initProfile } from './chat.js';

const socket = io();

export function getToken() { return localStorage.getItem('token'); }
export function getCurrentUser() {
  const userStr = localStorage.getItem('currentUser');
  return userStr ? JSON.parse(userStr) : null;
}
export function setCurrentUser(user) { localStorage.setItem('currentUser', JSON.stringify(user)); }

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
      updateDrawerProfile(user);
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

// ==========================================
// ЛОГИКА DRAWER (БОКОВОЕ МЕНЮ)
// ==========================================
const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerToggle = document.getElementById('drawer-toggle');
const drawerCloseBtn = document.getElementById('drawer-close-btn');
let isDrawerOpen = false;

function openDrawer() {
  isDrawerOpen = true;
  drawer.classList.remove('hidden');
  drawerOverlay.classList.remove('hidden');
  drawerToggle.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  isDrawerOpen = false;
  drawer.classList.add('hidden');
  drawerOverlay.classList.add('hidden');
  drawerToggle.classList.remove('active');
  document.body.style.overflow = '';
}

drawerToggle?.addEventListener('click', () => isDrawerOpen ? closeDrawer() : openDrawer());
drawerCloseBtn?.addEventListener('click', closeDrawer);
drawerOverlay?.addEventListener('click', closeDrawer);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isDrawerOpen) closeDrawer();
});

let touchStartX = 0;
let touchEndX = 0;
document.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
document.addEventListener('touchend', (e) => { touchEndX = e.changedTouches[0].screenX; handleSwipe(); }, { passive: true });

function handleSwipe() {
  const swipeDistance = touchEndX - touchStartX;
  if (touchStartX < 30 && swipeDistance > 60 && !isDrawerOpen) openDrawer();
  if (swipeDistance < -60 && isDrawerOpen) closeDrawer();
}

export function updateDrawerProfile(user) {
  if (!user) return;
  renderAvatar(user, 'drawer-avatar');
  document.getElementById('drawer-nick').textContent = user.nickname;
  
  if (user.created_at) {
    const date = new Date(user.created_at);
    const formattedDate = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('drawer-date').textContent = `С нами с ${formattedDate}`;
  }
  
  const badge = document.getElementById('drawer-badge');
  if (user.is_listener) badge.classList.remove('hidden');
  else badge.classList.add('hidden');
}

// ==========================================
// МОДАЛЬНЫЕ ОКНА (ИДЕАЛЬНОЕ ЦЕНТРИРОВАНИЕ)
// ==========================================
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalActions = document.getElementById('modal-actions');
const modalCloseBtn = document.getElementById('modal-close-btn');

function openModal(title, bodyHTML, actionsHTML = '') {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHTML;
  modalActions.innerHTML = actionsHTML;
  modalOverlay.classList.remove('hidden');
  closeDrawer();
}

function closeModal() {
  modalOverlay.classList.add('hidden');
}

modalCloseBtn?.addEventListener('click', closeModal);
modalOverlay?.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.querySelectorAll('.drawer-item').forEach(item => {
  item.addEventListener('click', () => {
    const type = item.dataset.modal;
    const user = getCurrentUser() || {};
    
    if (type === 'profile') {
      // ИСПРАВЛЕНО: Берем реальный никнейм, а не слово "Никнейм"
      const realNick = user.nickname || 'Пользователь';
      const date = user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Неизвестно';
      
      openModal('Мой профиль', `
        <div style="text-align: center; margin-bottom: 24px;">
          <div id="modal-profile-avatar" class="avatar-large" style="margin: 0 auto 20px;"></div>
          <h3 style="font-family: 'Cormorant Garamond', serif; font-size: 32px; font-weight: 600; text-align: center; margin-bottom: 8px;">${realNick}</h3>
          ${user.is_listener ? '<span class="drawer-badge">Слушатель ✓</span>' : ''}
        </div>
        <div style="display: flex; flex-direction: column; gap: 16px; font-size: 15px; text-align: center; color: var(--text-secondary);">
          <div><strong style="color: var(--text-primary);">Возраст:</strong> ${user.age || '—'} лет</div>
          <div><strong style="color: var(--text-primary);">Пол:</strong> ${user.gender || '—'}</div>
          <div><strong style="color: var(--text-primary);">Дата регистрации:</strong> ${date}</div>
        </div>
      `, `<button class="btn-primary" onclick="document.getElementById('modal-overlay').classList.add('hidden')" style="max-width: 200px; margin: 0 auto;">Закрыть</button>`);
      
      // Небольшая задержка, чтобы элемент успел отрисоваться перед рендером аватара
      setTimeout(() => renderAvatar(user, 'modal-profile-avatar'), 50);
    }
    
    else if (type === 'settings') {
      openModal('Настройки', `
        <div style="display: flex; flex-direction: column; gap: 20px; align-items: center;">
          <p style="margin-bottom: 8px; font-weight: 500; color: var(--text-primary);">Тема оформления</p>
          <div style="display: flex; gap: 12px; width: 100%;">
            <button class="btn-secondary" style="flex: 1;" onclick="applyTheme('light')">Светлая</button>
            <button class="btn-secondary" style="flex: 1;" onclick="applyTheme('dark')">Тёмная</button>
          </div>
          <hr class="divider" style="width: 100%;">
          <p style="font-size: 14px; color: var(--text-muted); line-height: 1.6;">
            Чтобы изменить аватар, никнейм или пароль, используй раздел «Мой профиль» в главном меню приложения.
          </p>
        </div>
      `, `<button class="btn-danger" onclick="localStorage.removeItem('token'); localStorage.removeItem('currentUser'); window.location.reload();" style="max-width: 240px; margin: 0 auto;">Выйти из аккаунта</button>`);
    }
    
    else if (type === 'donate') {
      openModal('Поддержать проект', `
        <h4>Спасибо, что ты здесь</h4>
        <p>Приложение "Слушатель" бесплатно навсегда. Но если оно тебе помогло — ты можешь помочь ему жить дальше. Это не обязательно. Это просто благодарность.</p>
        <div class="modal-actions-grid">
          <button class="btn-primary">50 ₽</button>
          <button class="btn-primary">100 ₽</button>
          <button class="btn-primary">300 ₽</button>
          <button class="btn-primary">500 ₽</button>
        </div>
        <p class="modal-small-text">Платёжный модуль появится позже. Пока что ты можешь просто сказать спасибо — этого достаточно 🤍</p>
      `, `<button class="btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')" style="max-width: 200px; margin: 0 auto;">Понятно</button>`);
    }
    
    else if (type === 'rules') {
      openModal('Правила и безопасность', `
        <div style="display: flex; flex-direction: column; gap: 16px; text-align: center;">
          <p>🌿 <strong>Не осуждай.</strong> Каждое чувство имеет право на существование.</p>
          <p>👂 <strong>Не перебивай.</strong> Дай человеку выговориться полностью.</p>
          <p>🚫 <strong>Не давай советов.</strong> Твоя задача — слышать, а не решать проблемы.</p>
          <p>🔒 <strong>Конфиденциальность.</strong> Всё, что сказано здесь, остаётся здесь.</p>
          <p>⚠️ <strong>Безопасность.</strong> Ты не психолог. При упоминании самоповреждения мягко предложи горячую линию.</p>
        </div>
      `, `<button class="btn-primary modal-sos-btn" onclick="window.open('tel:88002000122')">📞 Позвонить: 8-800-2000-122</button>`);
    }
    
    else if (type === 'about') {
      openModal('О проекте', `
        <h4>Слушатель</h4>
        <p>Анонимная платформа peer-поддержки для подростков. Создана как социальный проект в 2026 году.</p>
        <p>Наша цель — дать каждому безопасное пространство, где его услышат без оценок и давления. Потому что иногда всё, что нужно — это чтобы кто-то просто был рядом.</p>
      `, `<button class="btn-primary" onclick="document.getElementById('modal-overlay').classList.add('hidden')" style="max-width: 200px; margin: 0 auto;">Закрыть</button>`);
    }
  });
});

// Инициализация всех модулей
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initAvatar();
  initCourse();
  initChat();
  initProfile();
});
