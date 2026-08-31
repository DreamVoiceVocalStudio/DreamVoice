// ===== КОНФІГУРАЦІЯ =====
const API_URL = "https://script.google.com/macros/s/AKfycbyHpnVTG4pGbfjYAhTwk01pSkDF8cA7wCdsmO5Wh5mASEYkhfx8Z42GTy29gFyiKedQbQ/exec";

// Розклад: день тижня (0=нд) → масив слотів або null
const SCHEDULE = {
  0: null, // Неділя
  1: ["13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30", "18:15", "19:00", "19:45"], // Вівторок
  2: ["17:00", "17:45", "18:30", "19:15", "20:00"], // Середа
  3: ["13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30", "18:15", "19:00", "19:45"], // Четвер
  4: ["17:00", "17:45", "18:30", "19:15", "20:00"], // П'ятниця
  5: null, // Субота
  6: ["17:00", "17:45", "18:30", "19:15", "20:00"] // Понеділок
};

// ===== СТАН =====
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;        // "DD.MM.YYYY"
let selectedTime = null;
let bookings = [];              // завантажені бронювання

// ===== DOM ЕЛЕМЕНТИ =====
const monthYearEl = document.getElementById('monthYear');
const daysContainer = document.getElementById('calendarDays');
const slotsContainer = document.getElementById('slotsContainer');
const selectedInfo = document.getElementById('selectedInfo');
const statusMsg = document.getElementById('statusMessage');
const form = document.getElementById('bookingForm');
const nameInput = document.getElementById('name');
const phoneInput = document.getElementById('phone');
const selectedDateInput = document.getElementById('selectedDate');
const selectedTimeInput = document.getElementById('selectedTime');
const successPopup = document.getElementById('successPopup');
const successText = document.getElementById('successText');
const closePopupBtn = document.getElementById('closePopup');

// ===== ЗАВАНТАЖЕННЯ БРОНЮВАНЬ =====
async function loadBookings() {
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json;charset=utf-8' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    bookings = result.data || [];
    console.log('✅ Бронювань завантажено:', bookings.length);
    return bookings;
  } catch (error) {
    console.error('❌ Помилка завантаження:', error);
    statusMsg.textContent = '❌ Не вдалося завантажити розклад. Спробуйте пізніше.';
    statusMsg.className = 'status-message error';
    return [];
  }
}

// ===== ПЕРЕВІРКА, ЧИ СЛОТ ЗАБРОНЬОВАНИЙ =====
function isSlotBooked(dateStr, timeStr) {
  return bookings.some(b => b.date === dateStr && b.time === timeStr);
}

// ===== ОТРИМАННЯ ДОСТУПНИХ СЛОТІВ ДЛЯ ДАТИ =====
function getAvailableSlots(dateStr) {
  const dayOfWeek = new Date(dateStr.split('.').reverse().join('-')).getDay(); // "DD.MM.YYYY" → Date
  const slots = SCHEDULE[dayOfWeek];
  if (!slots) return [];
  return slots.filter(slot => !isSlotBooked(dateStr, slot));
}

// ===== ВІДОБРАЖЕННЯ КАЛЕНДАРЯ =====
function renderCalendar(month, year) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Пн=0, Нд=6
  const daysInMonth = lastDay.getDate();

  monthYearEl.textContent = `${firstDay.toLocaleString('uk-UA', { month: 'long' })} ${year}`;
  daysContainer.innerHTML = '';

  // Пусті клітинки до початку місяця
  for (let i = 0; i < startDayOfWeek; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day empty';
    daysContainer.appendChild(empty);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dateStr = dateObj.toLocaleDateString('uk-UA'); // "DD.MM.YYYY"
    const dayOfWeek = dateObj.getDay();
    const isWorkday = SCHEDULE[dayOfWeek] !== null;
    const isPast = dateObj < today;

    const dayEl = document.createElement('div');
    dayEl.className = `calendar-day ${isWorkday && !isPast ? 'workday' : 'disabled'}`;
    dayEl.textContent = d;

    if (isWorkday && !isPast) {
      dayEl.addEventListener('click', () => selectDate(dateStr));
    }

    // Якщо вибрана дата — підсвітити
    if (dateStr === selectedDate) {
      dayEl.classList.add('selected');
    }

    daysContainer.appendChild(dayEl);
  }
}

// ===== ВИБІР ДАТИ =====
async function selectDate(dateStr) {
  selectedDate = dateStr;
  selectedDateInput.value = dateStr;
  selectedTime = null;
  selectedTimeInput.value = '';
  selectedInfo.textContent = `📅 Обрано: ${dateStr}`;

  // Оновити підсвічування в календарі
  document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
  const allDays = document.querySelectorAll('.calendar-day.workday');
  allDays.forEach(el => {
    const d = parseInt(el.textContent);
    const dateObj = new Date(currentYear, currentMonth, d);
    if (dateObj.toLocaleDateString('uk-UA') === dateStr) {
      el.classList.add('selected');
    }
  });

  // Отримати доступні слоти
  const available = getAvailableSlots(dateStr);
  renderSlots(available);

  // Скинути повідомлення
  statusMsg.textContent = '';
  statusMsg.className = 'status-message';
}

// ===== ВІДОБРАЖЕННЯ СЛОТІВ =====
function renderSlots(slots) {
  slotsContainer.innerHTML = '';
  if (!slots || slots.length === 0) {
    slotsContainer.innerHTML = '<p style="text-align:center; color:#7a6a5f;">Немає доступних слотів на цю дату</p>';
    return;
  }

  slots.forEach(slot => {
    const btn = document.createElement('button');
    btn.className = 'slot available';
    btn.textContent = slot;
    btn.addEventListener('click', () => selectTime(slot));
    if (slot === selectedTime) {
      btn.classList.add('selected');
    }
    slotsContainer.appendChild(btn);
  });
}

// ===== ВИБІР ЧАСУ =====
function selectTime(time) {
  selectedTime = time;
  selectedTimeInput.value = time;
  selectedInfo.textContent = `📅 ${selectedDate}  ⏰ ${time}`;

  // Оновити підсвічування
  document.querySelectorAll('.slot').forEach(el => el.classList.remove('selected'));
  const slots = document.querySelectorAll('.slot');
  slots.forEach(el => {
    if (el.textContent === time) el.classList.add('selected');
  });
}

// ===== ВІДПРАВКА ФОРМИ =====
form.addEventListener('submit', async function(e) {
  e.preventDefault();

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const date = selectedDate;
  const time = selectedTime;

  if (!name || !phone) {
    statusMsg.textContent = '❌ Будь ласка, заповніть ім\'я та телефон.';
    statusMsg.className = 'status-message error';
    return;
  }
  if (!date || !time) {
    statusMsg.textContent = '❌ Оберіть дату та час.';
    statusMsg.className = 'status-message error';
    return;
  }

  // Блокуємо кнопку
  const btn = document.getElementById('confirmBtn');
  btn.disabled = true;
  btn.textContent = 'Відправка...';
  statusMsg.textContent = '⏳ Відправляємо...';
  statusMsg.className = 'status-message';

  try {
    const payload = { date, time, name, phone };
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success) {
      // Успіх
      statusMsg.textContent = '✅ Бронювання збережено!';
      statusMsg.className = 'status-message success';

      // Показати попап
      successText.innerHTML = `Ви записані на <b>${date}</b> о <b>${time}</b><br>Ім'я: ${name}<br>Телефон: ${phone}`;
      successPopup.classList.add('show');

      // Очистити форму та вибір
      nameInput.value = '';
      phoneInput.value = '';
      selectedDate = null;
      selectedTime = null;
      selectedDateInput.value = '';
      selectedTimeInput.value = '';
      selectedInfo.textContent = '';
      renderSlots([]);
      // Оновити календар (зняти виділення)
      document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
      // Перезавантажити бронювання для оновлення доступності
      await loadBookings();
      // Якщо вибрана дата залишилась, оновити слоти
      if (selectedDate) {
        const available = getAvailableSlots(selectedDate);
        renderSlots(available);
      }
    } else {
      throw new Error(result.message || 'Невідома помилка сервера');
    }
  } catch (error) {
    console.error('❌ Помилка відправки:', error);
    statusMsg.textContent = `❌ Помилка: ${error.message}`;
    statusMsg.className = 'status-message error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Підтвердити запис';
  }
});

// ===== ЗАКРИТТЯ ПОПАПА =====
closePopupBtn.addEventListener('click', () => {
  successPopup.classList.remove('show');
});

// Клік поза попапом теж закриває
successPopup.addEventListener('click', (e) => {
  if (e.target === successPopup) successPopup.classList.remove('show');
});

// ===== НАВІГАЦІЯ МІСЯЦЯМИ =====
document.getElementById('prevMonth').addEventListener('click', () => {
  if (currentMonth === 0) { currentMonth = 11; currentYear--; }
  else currentMonth--;
  renderCalendar(currentMonth, currentYear);
  // Якщо вибрана дата була в цьому місяці — можна скинути, або залишити
  // Просто очистимо вибір
  clearSelection();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  if (currentMonth === 11) { currentMonth = 0; currentYear++; }
  else currentMonth++;
  renderCalendar(currentMonth, currentYear);
  clearSelection();
});

function clearSelection() {
  selectedDate = null;
  selectedTime = null;
  selectedDateInput.value = '';
  selectedTimeInput.value = '';
  selectedInfo.textContent = '';
  renderSlots([]);
  document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
}

// ===== TOGGLE ДОДАТКОВОЇ ІНФОРМАЦІЇ =====
document.getElementById('scheduleToggle').addEventListener('click', function() {
  const details = document.getElementById('scheduleDetails');
  if (details.style.display === 'none') {
    details.style.display = 'block';
    this.classList.add('active');
  } else {
    details.style.display = 'none';
    this.classList.remove('active');
  }
});

// ===== ІНІЦІАЛІЗАЦІЯ =====
(async function init() {
  await loadBookings();
  renderCalendar(currentMonth, currentYear);
  // Якщо є вибрана дата (наприклад збережена в URL), але зараз ні
})();
