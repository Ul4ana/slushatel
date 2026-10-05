import { showScreen, updateUserHeader, socket, setCurrentUser } from './app.js';

export function initAuth() {
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  const showRegisterBtn = document.getElementById('show-register');
  
  // 1. Логика переключения на регистрацию
  if (showRegisterBtn) {
    showRegisterBtn.addEventListener('click', () => {
      loginForm.classList.add('hidden');
      regForm.classList.remove('hidden');
      document.getElementById('login-nick').value = '';
      document.getElementById('login-pass').value = '';
    });
  }

  // 2. Динамическое создание кнопки "Вернуться ко входу" внутри формы регистрации
  if (regForm && !document.getElementById('back-to-login')) {
    const backToLogin = document.createElement('p');
    backToLogin.id = 'back-to-login';
    backToLogin.className = 'toggle-auth';
    backToLogin.innerHTML = 'Уже есть аккаунт? <span id="show-login" tabindex="0" role="button" style="color: var(--accent-primary); cursor: pointer; font-weight: 600; text-decoration: underline; text-underline-offset: 4px;">Войти</span>';
    
    const submitBtn = regForm.querySelector('button[type="submit"]');
    regForm.insertBefore(backToLogin, submitBtn);

    document.getElementById('show-login').addEventListener('click', () => {
      regForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      document.getElementById('reg-nick').value = '';
      document.getElementById('reg-pass').value = '';
    });
  }

  // 3. Обработка входа
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('login-nick').value;
    const password = document.getElementById('login-pass').value;
    const fingerprint = getFingerprint();

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password, fingerprint })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      setCurrentUser(data.user);
      showScreen('main-screen');
      updateUserHeader();
      socket.emit('user-online', data.user.id);
    } else {
      alert(data.error);
    }
  });

  // 4. Обработка регистрации
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('reg-nick').value;
    
    const valRes = await fetch('/api/validate-nickname', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname })
    });
    const valData = await valRes.json();
    if (!valData.valid) {
      alert('Пожалуйста, выбери другой никнейм. Этот не подходит.');
      return;
    }

    const payload = {
      nickname,
      password: document.getElementById('reg-pass').value,
      age: parseInt(document.getElementById('reg-age').value),
      gender: document.getElementById('reg-gender').value,
      avatar_type: window.selectedAvatarType,
      avatar_bg_color: window.selectedAvatarBg,
      avatar_content: window.selectedAvatarContent,
      fingerprint: getFingerprint()
    };

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      setCurrentUser(data.user);
      showScreen('main-screen');
      updateUserHeader();
      socket.emit('user-online', data.user.id);
    } else {
      alert(data.error);
    }
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.reload();
  });
}

function getFingerprint() {
  return navigator.userAgent + window.screen.width + window.screen.height + navigator.language;
}
