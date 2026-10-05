import { showScreen, socket, currentUser, token, renderAvatar } from './app.js';

let currentSession = null;

export function initChat() {
  // 1. Настраиваем кнопки (только если они есть на странице)
  const findBtn = document.getElementById('find-listener');
  if (findBtn) findBtn.addEventListener('click', findListener);
  
  const stopBtn = document.getElementById('stop-listening');
  if (stopBtn) stopBtn.addEventListener('click', stopListening);
  
  const endBtn = document.getElementById('end-session-btn');
  if (endBtn) endBtn.addEventListener('click', endSession);
  
  const sendBtn = document.getElementById('send-msg');
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  
  const msgInput = document.getElementById('message-input');
  if (msgInput) {
    msgInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }
  
  const sosBtn = document.getElementById('sos-btn');
  if (sosBtn) {
    sosBtn.addEventListener('click', () => {
      if (currentSession) socket.emit('sos-triggered', { sessionId: currentSession.id });
    });
  }
  
  const reportBtn = document.getElementById('report-btn');
  if (reportBtn) reportBtn.addEventListener('click', showReportModal);

  // 2. БЕЗОПАСНЫЕ подписки на события Socket (теперь они внутри функции)
  socket.on('session-request', (data) => {
    showModal('Кто-то хочет поговорить', 'Ты нужен.', [
      { text: 'Принять', action: () => {
        socket.emit('respond-session', { sessionId: data.sessionId, accepted: true });
        closeModal();
        startSession(data.sessionId, data.mode);
      }},
      { text: 'Отклонить', action: () => {
        showModal('Причина', 'Почему ты не можешь говорить?', [
          { text: 'Не сейчас', action: () => rejectSession(data.sessionId, 'Не сейчас') },
          { text: 'Я устал', action: () => rejectSession(data.sessionId, 'Я устал') },
          { text: 'Не моя тема', action: () => rejectSession(data.sessionId, 'Не моя тема') }
        ]);
      }}
    ]);
  });

  socket.on('session-accepted', (data) => {
    closeModal();
    startSession(data.sessionId, data.mode);
  });

  socket.on('session-rejected', (data) => {
    closeModal();
    alert(data.reason);
  });

  socket.on('new-message', (data) => {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `message ${data.senderId === currentUser.id ? 'mine' : (data.senderId === 'system' ? 'system' : 'theirs')}`;
    div.textContent = data.text; // Защита от XSS
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  });

  socket.on('message-blocked', (data) => {
    alert(data.warning);
  });

  socket.on('user-banned', (data) => {
    alert(`Твой аккаунт ограничен: ${data.type} бан на ${data.duration}.`);
    localStorage.removeItem('token');
    window.location.reload();
  });
}

export function initProfile() {
  const openProfBtn = document.getElementById('open-profile');
  if (openProfBtn) {
    openProfBtn.addEventListener('click', () => {
      document.getElementById('prof-nick').value = currentUser.nickname;
      document.getElementById('prof-age').value = currentUser.age;
      document.getElementById('prof-gender').value = currentUser.gender;
      renderAvatar(currentUser, 'profile-avatar');
      showScreen('profile-screen');
    });
  }

  const backBtn = document.getElementById('back-to-main');
  if (backBtn) backBtn.addEventListener('click', () => showScreen('main-screen'));

  const profForm = document.getElementById('profile-form');
  if (profForm) {
    profForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        nickname: document.getElementById('prof-nick').value,
        age: parseInt(document.getElementById('prof-age').value),
        gender: document.getElementById('prof-gender').value,
        avatar_type: currentUser.avatar_type,
        avatar_bg_color: currentUser.avatar_bg_color,
        avatar_content: currentUser.avatar_content
      };
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      alert('Профиль обновлен');
      currentUser = { ...currentUser, ...payload };
      renderAvatar(currentUser, 'profile-avatar');
    });
  }

  const donateBtn = document.getElementById('donate-btn');
  if (donateBtn) {
    donateBtn.addEventListener('click', () => {
      alert('Спасибо, что вы с нами. Платёжный модуль появится позже.');
    });
  }
}

async function findListener() {
  const minAge = document.getElementById('min-age').value;
  const maxAge = document.getElementById('max-age').value;
  if (maxAge - minAge > 4) {
    alert('Разница между возрастом не должна превышать 4 года.');
    return;
  }

  const res = await fetch(`/api/online-listeners?prefGender=${document.getElementById('pref-gender').value}&minAge=${minAge}&maxAge=${maxAge}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const listeners = await res.json();
  
  if (listeners.length === 0) {
    alert('К сожалению, сейчас нет свободных слушателей. Попробуй позже.');
    return;
  }

  const chosen = listeners[Math.floor(Math.random() * listeners.length)];
  showModal('Выбор режима', `Найден слушатель: ${chosen.nickname}. Выбери режим общения.`, [
    { text: 'Текст', action: () => requestSession(chosen.id, 'text') },
    { text: 'Аудио', action: () => requestSession(chosen.id, 'audio') }
  ]);
}

function requestSession(listenerId, mode) {
  closeModal();
  socket.emit('request-session', { storytellerId: currentUser.id, listenerId, mode });
  showModal('Поиск', 'Отправляем запрос слушателю...', []);
}

function stopListening() {
  document.getElementById('listener-status').classList.add('hidden');
  document.getElementById('storyteller-panel').classList.remove('hidden');
}

function rejectSession(sessionId, reason) {
  socket.emit('respond-session', { sessionId, accepted: false, reason });
  closeModal();
}

function startSession(sessionId, mode) {
  currentSession = { id: sessionId, mode };
  showScreen('chat-screen');
  document.getElementById('chat-messages').innerHTML = '';
  
  if (currentUser.is_listener) {
    document.getElementById('listener-status').classList.remove('hidden');
    document.getElementById('storyteller-panel').classList.add('hidden');
  }

  if (!currentUser.is_listener) {
    document.getElementById('sos-btn').classList.remove('hidden');
  }
}

function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text || !currentSession) return;
  
  socket.emit('send-message', { sessionId: currentSession.id, senderId: currentUser.id, text });
  input.value = '';
}

function endSession() {
  if (!currentSession) return;
  socket.emit('end-session', { sessionId: currentSession.id, userId: currentUser.id });
  
  showModal('Оценка', 'Как прошёл разговор?', [1, 2, 3, 4, 5].map(score => ({
    text: `${score} ⭐`,
    action: () => {
      // Здесь можно добавить отправку оценки на сервер, если нужно
      closeModal();
      currentSession = null;
      showScreen('main-screen');
    }
  })));
}

function showReportModal() {
  if (!currentSession) return;
  showModal('Пожаловаться', 'Выберите причину:', [
    "Домогательства / непристойное поведение",
    "Оскорбления и агрессия",
    "Спам / реклама",
    "Мне страшно / небезопасно",
    "Другое"
  ].map(reason => ({
    text: reason,
    action: () => {
      const htmlSnapshot = document.body.innerHTML;
      socket.emit('report-user', {
        sessionId: currentSession.id,
        reporterId: currentUser.id,
        reportedId: 'partner_id', 
        reason,
        htmlSnapshot
      });
      closeModal();
      alert('Жалоба отправлена. Спасибо, что помогаешь делать пространство безопасным. Мы рассмотрим её в ближайшее время.');
    }
  })));
}

function showModal(title, text, actions) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-text').textContent = text;
  const actionsDiv = document.getElementById('modal-actions');
  actionsDiv.innerHTML = '';
  actions.forEach(act => {
    const btn = document.createElement('button');
    btn.className = 'btn-secondary';
    btn.textContent = act.text;
    btn.style.margin = '5px';
    btn.addEventListener('click', act.action);
    actionsDiv.appendChild(btn);
  });
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
