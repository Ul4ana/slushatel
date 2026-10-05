export function initAvatar() {
  const colors = [
    { name: 'STEAMED MILK', hex: '#D9D3CC' },
    { name: 'DOVETAIL', hex: '#B6ADA5' },
    { name: 'GATEWAY GRAY', hex: '#7B7167' },
    { name: 'MUDDLED BASIL', hex: '#5E6E5E' },
    { name: 'NUTHATCH', hex: '#8B9A8B' }
  ];
  const emojis = ['😚', '😌', '😊', '💋', '🫂', '😺', '😸', '😽', '🌸', '🌺', '🌊', '🪐', '🐚', '🪷', '🪽', '🦢', '🕊️', '🦌', '🩰', '🎧', '🩹', '🎀', '🤍', '🪩', '🕯️'];

  window.selectedAvatarType = 'auto';
  window.selectedAvatarBg = colors[Math.floor(Math.random() * colors.length)].hex;
  window.selectedAvatarContent = emojis[Math.floor(Math.random() * emojis.length)];

  const bgSelect = document.getElementById('avatar-bg');
  colors.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.hex;
    opt.textContent = c.name;
    bgSelect.appendChild(opt);
  });

  document.querySelectorAll('.avatar-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      window.selectedAvatarType = btn.dataset.type;
      document.getElementById('avatar-customizer').classList.toggle('hidden', window.selectedAvatarType === 'auto');
      updatePreview();
    });
  });

  bgSelect.addEventListener('change', () => {
    window.selectedAvatarBg = bgSelect.value;
    updatePreview();
  });

  document.getElementById('avatar-content').addEventListener('input', (e) => {
    window.selectedAvatarContent = e.target.value.toUpperCase();
    updatePreview();
  });

  function updatePreview() {
    if (window.selectedAvatarType === 'auto') {
      window.selectedAvatarBg = colors[Math.floor(Math.random() * colors.length)].hex;
      window.selectedAvatarContent = emojis[Math.floor(Math.random() * emojis.length)];
    }
    const preview = document.getElementById('avatar-preview');
    preview.style.backgroundColor = window.selectedAvatarBg;
    preview.style.color = isDark(window.selectedAvatarBg) ? '#F5F5F5' : '#2C2C2C';
    preview.textContent = window.selectedAvatarContent;
  }

  function isDark(color) {
    return ['#7B7167', '#5E6E5E', '#8B9A8B'].includes(color);
  }

  updatePreview();
}
