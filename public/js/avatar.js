export function initAvatar() {
  const colors = [
    { name: 'STEAMED MILK', hex: '#D9D3CC' },
    { name: 'DOVETAIL', hex: '#B6ADA5' },
    { name: 'GATEWAY GRAY', hex: '#7B7167' },
    { name: 'MUDDLED BASIL', hex: '#5E6E5E' },
    { name: 'NUTHATCH', hex: '#8B9A8B' }
  ];
  const emojis = ['😚', '😌', '😊', '💋', '🫂', '😺', '😸', '😽', '🌸', '🌺', '🌊', '🪐', '🐚', '🪷', '🪽', '🦢', '🕊️', '🦌', '🩰', '🎧', '🩹', '🎀', '🤍', '🪩', '🕯️'];

  // Инициализация значений по умолчанию
  window.selectedAvatarType = 'emoji';
  window.selectedAvatarBg = colors[0].hex;
  window.selectedAvatarContent = '🌸';

  const bgSlider = document.getElementById('avatar-bg');
  const contentInput = document.getElementById('avatar-content');
  const customizer = document.getElementById('avatar-customizer');

  // Обработчик переключения типа
  document.querySelectorAll('.avatar-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Убираем active у всех кнопок
      document.querySelectorAll('.avatar-type-btn').forEach(b => b.classList.remove('active'));
      // Добавляем active к текущей
      btn.classList.add('active');
      
      window.selectedAvatarType = btn.dataset.type;
      
      // Показываем/скрываем кастомизатор
      if (window.selectedAvatarType === 'auto') {
        customizer.classList.add('hidden');
        // Выбираем случайные значения
        window.selectedAvatarBg = colors[Math.floor(Math.random() * colors.length)].hex;
        window.selectedAvatarContent = emojis[Math.floor(Math.random() * emojis.length)];
        bgSlider.value = colors.findIndex(c => c.hex === window.selectedAvatarBg);
        contentInput.value = '';
      } else {
        customizer.classList.remove('hidden');
        // Обновляем плейсхолдер в зависимости от типа
        contentInput.placeholder = window.selectedAvatarType === 'emoji' ? '🌸' : 'A';
      }
      
      updatePreview();
    });
  });

  // Обработчик ползунка цветов
  bgSlider.addEventListener('input', () => {
    const colorIndex = parseInt(bgSlider.value);
    window.selectedAvatarBg = colors[colorIndex].hex;
    updatePreview();
  });

  // Обработчик ввода в круглое поле
  contentInput.addEventListener('input', (e) => {
    window.selectedAvatarContent = e.target.value.toUpperCase();
    updatePreview();
  });

  function updatePreview() {
    const preview = document.getElementById('avatar-preview');
    preview.style.backgroundColor = window.selectedAvatarBg;
    preview.style.color = isDark(window.selectedAvatarBg) ? '#F5F5F5' : '#2C2C2C';
    preview.textContent = window.selectedAvatarContent;
  }

  function isDark(color) {
    return ['#7B7167', '#5E6E5E', '#8B9A8B'].includes(color);
  }

  // Первоначальное обновление превью
  updatePreview();
}
