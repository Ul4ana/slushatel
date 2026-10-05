const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Простая функция хеширования для фингерпринтов и IP
const hashString = (str) => crypto.createHash('sha256').update(str).digest('hex');

db.serialize(() => {
  // Таблица пользователей
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    age INTEGER CHECK(age >= 11 AND age <= 19) NOT NULL,
    gender TEXT NOT NULL,
    avatar_type TEXT DEFAULT 'auto',
    avatar_bg_color TEXT,
    avatar_content TEXT,
    is_listener BOOLEAN DEFAULT 0,
    is_online BOOLEAN DEFAULT 0,
    is_busy BOOLEAN DEFAULT 0,
    is_banned BOOLEAN DEFAULT 0,
    is_shadow_banned BOOLEAN DEFAULT 0,
    ban_expires DATETIME,
    fingerprint_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица сессий
  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storyteller_id INTEGER,
    listener_id INTEGER,
    mode TEXT CHECK(mode IN ('text', 'audio')) DEFAULT 'text',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    status TEXT DEFAULT 'active',
    FOREIGN KEY(storyteller_id) REFERENCES users(id),
    FOREIGN KEY(listener_id) REFERENCES users(id)
  )`);

  // Таблица сообщений
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    sender_id INTEGER,
    text TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES sessions(id),
    FOREIGN KEY(sender_id) REFERENCES users(id)
  )`);

  // Таблица оценок
  db.run(`CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    rater_id INTEGER,
    rated_user_id INTEGER,
    role_of_rater TEXT,
    score INTEGER CHECK(score >= 1 AND score <= 5),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES sessions(id),
    FOREIGN KEY(rater_id) REFERENCES users(id),
    FOREIGN KEY(rated_user_id) REFERENCES users(id)
  )`);

  // Таблица жалоб
  db.run(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER,
    reported_id INTEGER,
    session_id INTEGER,
    reason TEXT NOT NULL,
    evidence_log_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(reporter_id) REFERENCES users(id),
    FOREIGN KEY(reported_id) REFERENCES users(id),
    FOREIGN KEY(session_id) REFERENCES sessions(id),
    FOREIGN KEY(evidence_log_id) REFERENCES reported_sessions(id)
  )`);

  // Таблица доказательств
  db.run(`CREATE TABLE IF NOT EXISTS reported_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reported_user_id INTEGER,
    reporter_user_id INTEGER,
    session_id INTEGER,
    chat_log TEXT,
    call_log TEXT,
    html_snapshot TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(reported_user_id) REFERENCES users(id),
    FOREIGN KEY(reporter_user_id) REFERENCES users(id),
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  )`);

  // Таблица забаненных
  db.run(`CREATE TABLE IF NOT EXISTS banned_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    fingerprint_hash TEXT,
    ip_hash TEXT,
    ban_type TEXT CHECK(ban_type IN ('permanent', 'temporary')),
    banned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Таблица вопросов теста
  db.run(`CREATE TABLE IF NOT EXISTS test_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option TEXT CHECK(correct_option IN ('A', 'B', 'C', 'D')),
    related_step INTEGER
  )`);

  // Проверка и заполнение вопросов (12 штук)
  db.get("SELECT COUNT(*) as count FROM test_questions", (err, row) => {
    if (row.count === 0) {
      const questions = [
        ["Твоя главная задача как слушателя?", "Давать советы", "Быть рядом и слышать", "Решать проблемы собеседника", "Переводить тему на себя", "B", 1],
        ["Что делать, если собеседник замолчал?", "Перебить и задать новый вопрос", "Начать говорить о себе", "Дать человеку выговориться, пауза — это нормально", "Завершить разговор", "C", 2],
        ["Как правильно отражать чувства?", "Говорить 'Всё будет хорошо'", "Использовать фразы 'Я слышу тебя', 'Это звучит тяжело'", "Игнорировать эмоции", "Смеяться, чтобы разрядить обстановку", "B", 3],
        ["Что делать при упоминании самоповреждения?", "Испугаться и бросить трубку", "Мягко предложить контакты горячей линии", "Читать мораль", "Обещать сохранить это в тайне", "B", 4],
        ["Обязан ли ты знать ответы на все вопросы?", "Да, иначе ты плохой слушатель", "Нет, ты обязан быть человеком и быть рядом", "Да, нужно гуглить во время разговора", "Только если ты старше собеседника", "B", 5],
        ["Можно ли перебивать рассказчика?", "Да, если он говорит ерунду", "Да, чтобы поправить его", "Нет, дай человеку выговориться полностью", "Только для уточнения деталей", "C", 2],
        ["Что делать, если тебе самому стало тяжело во время сессии?", "Терпеть до конца", "Вежливо завершить сессию и отдохнуть", "Выместить злость на собеседнике", "Ничего, ты же слушатель", "B", 4],
        ["Допустимо ли осуждать рассказчика?", "Иногда, если он не прав", "Только в мыслях", "Нет, никогда", "Да, это помогает ему исправиться", "C", 1],
        ["Можно ли переводить тему на свои проблемы?", "Да, чтобы показать эмпатию", "Нет, фокус должен быть на рассказчике", "Только если твоя проблема серьезнее", "Да, в конце разговора", "B", 1],
        ["Что такое активное слушание?", "Молчать и кивать", "Возврат сути сказанного своими словами", "Перебивание с советами", "Запись разговора на диктофон", "B", 3],
        ["Какой тон общения недопустим?", "Доброжелательный", "Пассивно-агрессивный", "Спокойный", "Поддерживающий", "B", 1],
        ["Что делать, если собеседник нарушает границы?", "Четко и мягко обозначить свои границы", "Оскорбить в ответ", "Молча терпеть", "Сразу кинуть жалобу без предупреждения", "A", 4]
      ];
      const stmt = db.prepare("INSERT INTO test_questions (question_text, option_a, option_b, option_c, option_d, correct_option, related_step) VALUES (?, ?, ?, ?, ?, ?, ?)");
      questions.forEach(q => stmt.run(q));
      stmt.finalize();
    }
  });

  // Черный список слов (упрощенный, но эффективный набор для примера)
  db.run(`CREATE TABLE IF NOT EXISTS bad_words (word TEXT UNIQUE)`);
  db.get("SELECT COUNT(*) as count FROM bad_words", (err, row) => {
    if (row.count === 0) {
      const words = ["хуй", "xyi", "пизд", "pizd", "бля", "blya", "сука", "suka", "мудак", "mudak", "fuck", "f*ck", "shit", "блять", "blat", "нахуй", "nahui", "пидор", "pidor", "долбоёб", "dolboeb"];
      const stmt = db.prepare("INSERT OR IGNORE INTO bad_words (word) VALUES (?)");
      words.forEach(w => stmt.run(w));
      stmt.finalize();
    }
  });
});

module.exports = { db, hashString };
