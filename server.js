require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { ExpressPeerServer } = require('peer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const { db, hashString } = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const peerServer = ExpressPeerServer(server, { path: '/peerjs' });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/peerjs', peerServer);

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_slushatel_2026';

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Нет токена' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Неверный токен' });
    req.user = user;
    next();
  });
};

app.post('/api/validate-nickname', (req, res) => {
  const { nickname } = req.body;
  const regex = /^[a-zA-Zа-яА-ЯёЁ0-9_]{3,20}$/;
  if (!regex.test(nickname)) return res.json({ valid: false });
  
  db.all("SELECT word FROM bad_words", (err, rows) => {
    const lowerNick = nickname.toLowerCase();
    const hasBadWord = rows.some(row => lowerNick.includes(row.word));
    res.json({ valid: !hasBadWord });
  });
});

app.post('/api/register', async (req, res) => {
  const { nickname, password, age, gender, avatar_type, avatar_bg_color, avatar_content, fingerprint } = req.body;
  if (age < 11 || age > 19) return res.status(400).json({ error: 'Возраст должен быть от 11 до 19 лет.' });
  
  const fpHash = hashString(fingerprint);
  db.get("SELECT id FROM banned_users WHERE fingerprint_hash = ?", [fpHash], (err, row) => {
    if (row) return res.status(403).json({ error: 'Регистрация с этого устройства невозможна.' });
  });

  const hash = await bcrypt.hash(password, 12);
  db.run(`INSERT INTO users (nickname, password_hash, age, gender, avatar_type, avatar_bg_color, avatar_content, fingerprint_hash) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    [nickname, hash, age, gender, avatar_type, avatar_bg_color, avatar_content, fpHash], 
    function(err) {
      if (err) return res.status(400).json({ error: 'Пожалуйста, выбери другой никнейм.' });
      const token = jwt.sign({ id: this.lastID, nickname }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id: this.lastID, nickname, age, gender, avatar_type, avatar_bg_color, avatar_content, is_listener: false } });
    }
  );
});

app.post('/api/login', async (req, res) => {
  const { nickname, password, fingerprint } = req.body;
  db.get("SELECT * FROM users WHERE nickname = ?", [nickname], async (err, user) => {
    if (!user) return res.status(400).json({ error: 'Неверные данные' });
    if (user.is_banned) return res.status(403).json({ error: 'Аккаунт заблокирован.' });
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Неверные данные' });

    const fpHash = hashString(fingerprint);
    db.run("UPDATE users SET fingerprint_hash = ?, is_online = 1 WHERE id = ?", [fpHash, user.id]);
    
    const token = jwt.sign({ id: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { ...user, password_hash: undefined } });
  });
});

// ОБНОВЛЕНО: добавлено created_at
app.get('/api/profile', authenticate, (req, res) => {
  db.get("SELECT id, nickname, age, gender, avatar_type, avatar_bg_color, avatar_content, is_listener, created_at FROM users WHERE id = ?", [req.user.id], (err, user) => {
    res.json(user);
  });
});

app.put('/api/profile', authenticate, (req, res) => {
  const { nickname, age, gender, avatar_type, avatar_bg_color, avatar_content } = req.body;
  if (age < 11 || age > 19) return res.status(400).json({ error: 'Недопустимый возраст' });
  
  db.run(`UPDATE users SET nickname=?, age=?, gender=?, avatar_type=?, avatar_bg_color=?, avatar_content=? WHERE id=?`,
    [nickname, age, gender, avatar_type, avatar_bg_color, avatar_content, req.user.id], function(err) {
      if (err) return res.status(400).json({ error: 'Ошибка обновления' });
      res.json({ success: true });
    });
});

app.get('/api/questions', authenticate, (req, res) => {
  db.all("SELECT id, question_text, option_a, option_b, option_c, option_d, related_step FROM test_questions ORDER BY RANDOM() LIMIT 7", (err, rows) => {
    res.json(rows);
  });
});

app.post('/api/check-test', authenticate, (req, res) => {
  const { answers } = req.body;
  let correctCount = 0;
  let wrongStep = null;
  const qIds = Object.keys(answers);
  const placeholders = qIds.map(() => '?').join(',');
  
  db.all(`SELECT id, correct_option, related_step FROM test_questions WHERE id IN (${placeholders})`, qIds, (err, rows) => {
    rows.forEach(row => {
      if (answers[row.id] === row.correct_option) correctCount++;
      else wrongStep = row.related_step;
    });
    
    if (correctCount >= 6) {
      db.run("UPDATE users SET is_listener = 1 WHERE id = ?", [req.user.id]);
      res.json({ passed: true, score: correctCount });
    } else {
      res.json({ passed: false, score: correctCount, wrongStep });
    }
  });
});

app.get('/api/online-listeners', authenticate, (req, res) => {
  const { prefGender, minAge, maxAge } = req.query;
  if (maxAge - minAge > 4) return res.status(400).json({ error: 'Разница возрастов не более 4 лет' });

  let query = `SELECT id, nickname, age, gender, avatar_type, avatar_bg_color, avatar_content FROM users 
               WHERE is_online = 1 AND is_listener = 1 AND is_busy = 0 AND is_banned = 0 AND is_shadow_banned = 0 AND id != ?`;
  const params = [req.user.id];

  if (prefGender && prefGender !== 'Не указывать') {
    query += ` AND gender = ?`;
    params.push(prefGender);
  }
  query += ` AND age >= ? AND age <= ?`;
  params.push(minAge, maxAge);

  db.all(query, params, (err, rows) => res.json(rows));
});

const activeSessions = {};
const userSockets = {};
const reportAttempts = {};

io.on('connection', (socket) => {
  socket.on('user-online', (userId) => {
    userSockets[userId] = socket.id;
    db.run("UPDATE users SET is_online = 1 WHERE id = ?", [userId]);
  });

  socket.on('request-session', (data) => {
    const { storytellerId, listenerId, mode } = data;
    db.get("SELECT is_shadow_banned FROM users WHERE id = ?", [listenerId], (err, row) => {
      if (row && row.is_shadow_banned) {
        io.to(userSockets[storytellerId]).emit('session-rejected', { reason: 'Слушатель пока не готов. Ищем дальше...' });
        return;
      }
      const sessionId = Date.now().toString();
      activeSessions[sessionId] = { storytellerId, listenerId, mode, chatLog: [], callLog: [] };
      db.run("INSERT INTO sessions (id, storyteller_id, listener_id, mode) VALUES (?, ?, ?, ?)", [sessionId, storytellerId, listenerId, mode]);
      
      const listenerSocket = userSockets[listenerId];
      if (listenerSocket) io.to(listenerSocket).emit('session-request', { sessionId, storytellerId, mode });
      else io.to(userSockets[storytellerId]).emit('session-rejected', { reason: 'Слушатель оффлайн.' });
    });
  });

  socket.on('respond-session', (data) => {
    const { sessionId, accepted, reason } = data;
    const session = activeSessions[sessionId];
    if (!session) return;

    if (accepted) {
      db.run("UPDATE users SET is_busy = 1 WHERE id IN (?, ?)", [session.storytellerId, session.listenerId]);
      io.to(userSockets[session.storytellerId]).emit('session-accepted', { sessionId, mode: session.mode });
      io.to(userSockets[session.listenerId]).emit('session-accepted', { sessionId, mode: session.mode });
    } else {
      db.run("UPDATE users SET is_busy = 0 WHERE id = ?", [session.listenerId]);
      io.to(userSockets[session.storytellerId]).emit('session-rejected', { reason: reason || 'Отклонено' });
      delete activeSessions[sessionId];
    }
  });

  socket.on('send-message', (data) => {
    const { sessionId, senderId, text } = data;
    const session = activeSessions[sessionId];
    if (!session) return;

    db.all("SELECT word FROM bad_words", (err, rows) => {
      const lowerText = text.toLowerCase();
      const hasBadWord = rows.some(row => lowerText.includes(row.word));
      
      if (hasBadWord) {
        io.to(userSockets[senderId]).emit('message-blocked', { warning: 'Сообщение содержит неподобающие слова.' });
        if (!reportAttempts[senderId]) reportAttempts[senderId] = { count: 0, resetTime: Date.now() + 300000 };
        if (Date.now() > reportAttempts[senderId].resetTime) reportAttempts[senderId] = { count: 0, resetTime: Date.now() + 300000 };
        reportAttempts[senderId].count++;
        if (reportAttempts[senderId].count >= 3) {
          db.run("UPDATE users SET is_shadow_banned = 1, ban_expires = datetime('now', '+24 hours') WHERE id = ?", [senderId]);
          io.to(userSockets[senderId]).emit('user-banned', { type: 'shadow', duration: '24 часа' });
        }
        return;
      }

      const timestamp = new Date().toISOString();
      session.chatLog.push({ senderId, text, timestamp });
      db.run("INSERT INTO messages (session_id, sender_id, text) VALUES (?, ?, ?)", [sessionId, senderId, text]);
      io.to(userSockets[session.storytellerId]).emit('new-message', { senderId, text, timestamp });
      io.to(userSockets[session.listenerId]).emit('new-message', { senderId, text, timestamp });
    });
  });

  socket.on('webrtc-signal', (data) => {
    const { targetId, signal } = data;
    if (userSockets[targetId]) io.to(userSockets[targetId]).emit('webrtc-signal', { from: socket.userId, signal });
  });

  socket.on('log-call-event', (data) => {
    const { sessionId, event } = data;
    if (activeSessions[sessionId]) activeSessions[sessionId].callLog.push({ ...event, timestamp: new Date().toISOString() });
  });

  socket.on('sos-triggered', (data) => {
    const { sessionId } = data;
    const session = activeSessions[sessionId];
    if (session) {
      const sysMsg = "Пожалуйста, позвони на горячую линию: 8-800-2000-122. Ты важен.";
      io.to(userSockets[session.storytellerId]).emit('new-message', { senderId: 'system', text: sysMsg, timestamp: new Date().toISOString() });
      io.to(userSockets[session.listenerId]).emit('new-message', { senderId: 'system', text: sysMsg, timestamp: new Date().toISOString() });
    }
  });

  socket.on('report-user', async (data) => {
    const { sessionId, reporterId, reportedId, reason, htmlSnapshot } = data;
    const session = activeSessions[sessionId];
    const chatLogJson = JSON.stringify(session ? session.chatLog : []);
    const callLogJson = JSON.stringify(session ? session.callLog : []);

    db.run(`INSERT INTO reported_sessions (reported_user_id, reporter_user_id, session_id, chat_log, call_log, html_snapshot) VALUES (?, ?, ?, ?, ?, ?)`,
      [reportedId, reporterId, sessionId, chatLogJson, callLogJson, htmlSnapshot], function(err) {
        const evidenceId = this.lastID;
        db.run(`INSERT INTO reports (reporter_id, reported_id, session_id, reason, evidence_log_id) VALUES (?, ?, ?, ?, ?)`, [reporterId, reportedId, sessionId, reason, evidenceId]);

        db.all(`SELECT reason FROM reports WHERE reported_id = ? AND timestamp > datetime('now', '-24 hours')`, [reportedId], (err, rows) => {
          const harassmentCount = rows.filter(r => r.reason === 'Домогательства / непристойное поведение').length;
          if (harassmentCount >= 2) db.run("UPDATE users SET is_banned = 1 WHERE id = ?", [reportedId]);
          else if (harassmentCount === 1) db.run("UPDATE users SET is_shadow_banned = 1 WHERE id = ?", [reportedId]);
          else if (rows.length >= 5) db.run("UPDATE users SET is_banned = 1 WHERE id = ?", [reportedId]);
        });
      });
    io.to(userSockets[reporterId]).emit('report-success');
  });

  socket.on('end-session', (data) => {
    const { sessionId, userId } = data;
    const session = activeSessions[sessionId];
    if (session) {
      db.run("UPDATE sessions SET ended_at = CURRENT_TIMESTAMP, status = 'ended' WHERE id = ?", [sessionId]);
      db.run("UPDATE users SET is_busy = 0 WHERE id IN (?, ?)", [session.storytellerId, session.listenerId]);
      io.to(userSockets[session.storytellerId]).emit('session-ended', { sessionId });
      io.to(userSockets[session.listenerId]).emit('session-ended', { sessionId });
      delete activeSessions[sessionId];
    }
  });

  socket.on('disconnect', () => {
    const userId = Object.keys(userSockets).find(key => userSockets[key] === socket.id);
    if (userId) {
      delete userSockets[userId];
      db.run("UPDATE users SET is_online = 0, is_busy = 0 WHERE id = ?", [userId]);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
