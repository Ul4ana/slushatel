import { showScreen, socket, currentUser, token, renderAvatar } from './app.js';

let currentSession = null;
let peer = null;
let localStream = null;
let currentCall = null;

export function initChat() {
  document.getElementById('find-listener').addEventListener('click', findListener);
  document.getElementById('stop-listening').addEventListener('click', stopListening);
  document.getElementById('end-session-btn').addEventListener('click', endSession);
  document.getElementById('send-msg').addEventListener('click', sendMessage);
  document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  document.getElementById('sos-btn').addEventListener('click', () => {
    socket.emit('sos-triggered', { sessionId: currentSession.id });
  });
  document.getElementById('report-btn').addEventListener('click', showReportModal);
}

export function initProfile() {
  document.getElementById('open-profile').addEventListener('click', () => {
    document.getElementById('prof-nick').value = currentUser.nickname;
    document.getElementById('prof-age').value = currentUser.age;
    document.getElementById('prof-gender').value = currentUser.gender;
    renderAvatar(currentUser, 'profile-avatar');
    showScreen('profile-screen');
  });

  document.getElementById('back-to-main').addEventListener('click', () => showScreen('main-screen'));

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
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

  document.getElementById('donate-btn').addEventListener('click', () => {
    alert('Спасибо, что вы с нами. Платёжный модуль появится позже.');
  });
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

// Socket listeners
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

function rejectSession(sessionId, reason) {
  socket.emit('respond-session', { sessionId, accepted: false, reason });
  closeModal();
}

socket.on('session-accepted', (data) => {
  closeModal();
  startSession(data.sessionId, data.mode);
});

socket.on('session-rejected', (data) => {
  closeModal();
  alert(data.reason);
});

function startSession(sessionId, mode) {
  currentSession = { id: sessionId, mode };
  showScreen('chat-screen');
  document.getElementById('chat-messages').innerHTML = '';
  
  if (currentUser.is_listener) {
    document.getElementById('listener-status').classList.remove('hidden');
    document.getElementById('storyteller-panel').classList.add('hidden');
  }

  if (mode === 'audio') {
    document.getElementById('audio-controls').classList.remove('hidden');
    initWebRTC();
  } else {
    document.getElementById('audio-controls').classList.add('hidden');
  }

  if (!currentUser.is_listener) {
    document.getElementById('sos-btn').classList.remove('hidden');
  }
}

function initWebRTC() {
  peer = new Peer();
  peer.on('open', (id) => {
    socket.emit('webrtc-signal', { targetId: currentSession.mode === 'audio' ? 'partner' : 'partner', signal: { type: 'init', peerId: id } }); // Упрощено для примера
  });
  // Полная реализация WebRTC требует обмена offer/answer через socket, здесь базовый каркас
}

function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text || !currentSession) return;
  
  socket.emit('send-message', { sessionId: currentSession.id, senderId: currentUser.id, text });
  input.value = '';
}

socket.on('new-message', (data) => {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `message ${data.senderId === currentUser.id ? 'mine' : (data.senderId === 'system' ? 'system' : 'theirs')}`;
  div.textContent = data.text; // XSS защита через textContent
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

function endSession() {
  if (!currentSession) return;
  socket.emit('end-session', { sessionId: currentSession.id, userId: currentUser.id });
  
  showModal('Оценка', 'Как прошёл разговор?', [1, 2, 3, 4, 5].map(score => ({
    text: `${score} ⭐`,
    action: () => {
      fetch('/api/rate', { // Эндпоинт нужно добавить в server.js аналогично другим, здесь заглушка логики
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSession.id, score })
      });
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
      const htmlSnapshot = document.body.innerHTML; // Упрощенный снимок
      socket.emit('report-user', {
        sessionId: currentSession.id,
        reporterId: currentUser.id,
        reportedId: 'partner_id', // В реальном приложении брать из currentSession
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
    btn.addEventListener('click', act.action);
    actionsDiv.appendChild(btn);
  });
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
