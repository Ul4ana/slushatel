import { showScreen, getToken, getCurrentUser, setCurrentUser } from './app.js';

const courseData = [
  { title: "Твоя роль — cлушать", text: "Ты здесь не для того, чтобы давать советы или решать чужие проблемы. Твоя задача — быть рядом и слышать.", icon: "👂" },
  { title: "Не перебивай", text: "Дай человеку выговориться полностью. Паузы — это нормально. Тишина — это пространство для мысли.", icon: "⏸️" },
  { title: "Отражай чувства", text: "Используй фразы: 'Я слышу тебя', 'Это звучит тяжело', 'Я понимаю, почему ты так чувствуешь'. Не говори 'Всё будет хорошо'.", icon: "🪞" },
  { title: "Границы и безопасность", text: "Ты не психолог. Если звучат слова о самоповреждении — мягко предложи контакты горячей линии. Не бери на себя ответственность за жизнь другого.", icon: "🛡️" },
  { title: "Ты готов", text: "Просто быть рядом — это уже огромная помощь. Ты не обязан знать ответы. Ты обязан быть человеком.", icon: "🫂" }
];

let currentStep = 0;
let currentQuestions = [];
let currentAnswers = {};

export function initCourse() {
  const btn = document.getElementById('start-course');
  if (btn) {
    btn.addEventListener('click', () => {
      currentStep = 0;
      renderCourseStep();
      showScreen('course-screen');
    });
  }
}

function renderCourseStep() {
  const data = courseData[currentStep];
  const container = document.getElementById('course-content');
  container.innerHTML = `
    <div style="font-size: 3rem; text-align: center; margin-bottom: 20px;">${data.icon}</div>
    <h2>${data.title}</h2>
    <p>${data.text}</p>
    <button id="next-step" class="btn-primary" style="margin-top: 20px;">${currentStep === 4 ? 'К тестированию' : 'Далее'}</button>
  `;
  document.getElementById('next-step').addEventListener('click', () => {
    if (currentStep < 4) {
      currentStep++;
      renderCourseStep();
    } else {
      initTest();
    }
  });
}

export async function initTest() {
  showScreen('test-screen');
  const token = getToken(); // БЕРЕМ СВЕЖИЙ ТОКЕН ПРЯМО ЗДЕСЬ
  
  try {
    const res = await fetch('/api/questions', { 
      headers: { 'Authorization': `Bearer ${token}` } 
    });
    
    if (!res.ok) {
      throw new Error('Не авторизован');
    }
    
    currentQuestions = await res.json();
    currentAnswers = {};
    renderTestQuestion(0);
  } catch (err) {
    alert('Сессия истекла. Пожалуйста, войдите в систему заново.');
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.reload();
  }
}

function renderTestQuestion(index) {
  if (!currentQuestions || index >= currentQuestions.length) {
    submitTest();
    return;
  }
  const q = currentQuestions[index];
  const container = document.getElementById('test-content');
  container.innerHTML = `
    <h3>Вопрос ${index + 1} из ${currentQuestions.length}</h3>
    <p style="margin-bottom: 20px; font-size: 1.1rem;">${q.question_text}</p>
    ${['A', 'B', 'C', 'D'].map(opt => `
      <button class="btn-secondary test-opt" data-opt="${opt}" data-qid="${q.id}" style="display:block; width:100%; margin-bottom:10px; text-align:left;">
        ${q['option_' + opt.toLowerCase()]}
      </button>
    `).join('')}
  `;
  
  document.querySelectorAll('.test-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      currentAnswers[btn.dataset.qid] = btn.dataset.opt;
      renderTestQuestion(index + 1);
    });
  });
}

async function submitTest() {
  const token = getToken();
  const res = await fetch('/api/check-test', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ answers: currentAnswers })
  });
  
  const data = await res.json();
  const container = document.getElementById('test-content');
  
  if (data.passed) {
    // Обновляем статус пользователя
    const user = getCurrentUser();
    user.is_listener = true;
    setCurrentUser(user);
    
    container.innerHTML = `
      <h2>Ты справился. ${data.score}/7.</h2>
      <p>Теперь ты слушатель. Спасибо, что ты здесь.</p>
      <button onclick="window.location.reload()" class="btn-primary" style="margin-top:20px;">Вернуться</button>
    `;
  } else {
    container.innerHTML = `
      <h2>Ты набрал ${data.score} из 7. Нужно 6.</h2>
      <p>Пересмотри Шаг ${data.wrongStep} и попробуй снова. Мы в тебя верим.</p>
      <button id="retry-course" class="btn-primary" style="margin-top:20px;">Пройти курс заново</button>
    `;
    document.getElementById('retry-course').addEventListener('click', () => {
      currentStep = 0;
      renderCourseStep();
      showScreen('course-screen');
    });
  }
}
