import { showScreen, token } from './app.js';

const courseData = [
  { title: "Твоя роль — cлушать", text: "Ты здесь не для того, чтобы давать советы или решать чужие проблемы. Твоя задача — быть рядом и слышать.", icon: "👂" },
  { title: "Не перебивай", text: "Дай человеку выговориться полностью. Паузы — это нормально. Тишина — это пространство для мысли.", icon: "⏸️" },
  { title: "Отражай чувства", text: "Используй фразы: 'Я слышу тебя', 'Это звучит тяжело', 'Я понимаю, почему ты так чувствуешь'. Не говори 'Всё будет хорошо'.", icon: "🪞" },
  { title: "Границы и безопасность", text: "Ты не психолог. Если звучат слова о самоповреждении — мягко предложи контакты горячей линии. Не бери на себя ответственность за жизнь другого.", icon: "🛡️" },
  { title: "Ты готов", text: "Просто быть рядом — это уже огромная помощь. Ты не обязан знать ответы. Ты обязан быть человеком.", icon: "🫂" }
];

let currentStep = 0;
let testQuestions = [];
let testAnswers = {};

export function initCourse() {
  document.getElementById('start-course').addEventListener('click', () => {
    currentStep = 0;
    renderCourseStep();
    showScreen('course-screen');
  });
}

function renderCourseStep() {
  const data = courseData[currentStep];
  const container = document.getElementById('course-content');
  container.innerHTML = `
    <div style="font-size: 3rem; text-align: center; margin-bottom: 20px;">${data.icon}</div>
    <h2>${data.title}</h2>
    <p>${data.text}</p>
    <button id="next-step" class="btn-primary">${currentStep === 4 ? 'К тестированию' : 'Далее'}</button>
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
  const res = await fetch('/api/questions', { headers: { 'Authorization': `Bearer ${token}` } });
  testQuestions = await res.json();
  testAnswers = {};
  renderTestQuestion(0);
}

function renderTestQuestion(index) {
  if (index >= testQuestions.length) {
    submitTest();
    return;
  }
  const q = testQuestions[index];
  const container = document.getElementById('test-content');
  container.innerHTML = `
    <h3>Вопрос ${index + 1} из 7</h3>
    <p style="margin-bottom: 20px;">${q.question_text}</p>
    ${['A', 'B', 'C', 'D'].map(opt => `
      <button class="btn-secondary test-opt" data-opt="${opt}" data-qid="${q.id}">
        ${q['option_' + opt.toLowerCase()]}
      </button>
    `).join('')}
  `;
  
  document.querySelectorAll('.test-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      testAnswers[btn.dataset.qid] = btn.dataset.opt;
      renderTestQuestion(index + 1);
    });
  });
}

async function submitTest() {
  const res = await fetch('/api/check-test', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: testAnswers })
  });
  const data = await res.json();
  
  const container = document.getElementById('test-content');
  if (data.passed) {
    container.innerHTML = `<h2>Ты справился. ${data.score}/7.</h2><p>Теперь ты слушатель. Спасибо, что ты здесь.</p><button onclick="window.location.reload()" class="btn-primary">Вернуться</button>`;
    window.currentUser.is_listener = true;
  } else {
    container.innerHTML = `
      <h2>Ты набрал ${data.score} из 7. Нужно 6.</h2>
      <p>Пересмотри Шаг ${data.wrongStep} и попробуй снова. Мы в тебя верим.</p>
      <button id="retry-course" class="btn-primary">Пройти курс заново</button>
    `;
    document.getElementById('retry-course').addEventListener('click', () => {
      currentStep = 0;
      renderCourseStep();
      showScreen('course-screen');
    });
  }
}
