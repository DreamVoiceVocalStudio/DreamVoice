const API_URL = "https://script.google.com/macros/s/AKfycbzmPk3tczWGN8BmIgrGKK7SP02iplTkXdw87TKmgcGPbU197JR_9ipitVdwwj0BU4FAdQ/exec";

// Графік роботи (індекс дня тижня: 0 = Неділя, 1 = Понеділок, ..., 6 = Субота)
const SCHEDULE = {
  0: null, // Неділя – вихідний
  1: { slots: ["17:00", "17:45", "18:30", "19:15", "20:00"], name: "Понеділок" },
  2: { slots: ["13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30", "18:15", "19:00", "19:45"], name: "Вівторок" },
  3: { slots: ["17:00", "17:45", "18:30", "19:15", "20:00"], name: "Середа" },
  4: { slots: ["13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30", "18:15", "19:00", "19:45"], name: "Четвер" },
  5: { slots: ["17:00", "17:45", "18:30", "19:15", "20:00"], name: "П'ятниця" },
  6: null  // Субота – вихідний
};

// Стан додатку
let currentMonth = new Date();      // Поточний відображуваний місяць
let selectedDate = null;            // Вибрана дата (рядок "ДД.ММ.РРРР")
let selectedTime = null;            // Вибраний час (рядок "ГГ:ХХ")
let bookingsCache = [];             // Кеш бронювань, щоб не завантажувати щоразу

// ===== ДОПОМІЖНІ ФУНКЦІЇ =====

// Форматування дати у "ДД.ММ.РРРР"
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Отримання дня тижня з урахуванням, що тиждень починається з понеділка (0 = Пн, 6 = Нд)
function getMondayBasedDay(date) {
  return (date.getDay() + 6) % 7;
}

// Завантаження бронювань з API
async function loadBookings() {
  try {
    const response = await fetch(API_URL, { method: "GET" });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    if (!result.success) {
      console.error("Помилка сервера:", result.message);
      return [];
    }
    bookingsCache = result.data || [];
    return bookingsCache;
  } catch (error) {
    console.error("Помилка завантаження бронювань:", error);
    return [];
  }
}

// Перевірка, чи слот зайнятий
function isSlotBooked(date, time, bookings) {
  return bookings.some(b => b.date === date && b.time === time);
}

// Отримання доступних слотів для дати
async function getAvailableSlots(dateStr) {
  const dayOfWeek = new Date(dateStr.split('.').reverse().join('-')).getDay(); // перетворення "ДД.ММ.РРРР" у Date
  const schedule = SCHEDULE[dayOfWeek];
  if (!schedule) return [];

  const bookings = await loadBookings();
  return schedule.slots.filter(slot => !isSlotBooked(dateStr, slot, bookings));
}

// ===== КАЛЕНДАР =====

// Відображення календаря для поточного місяця
function renderCalendar() {
  const monthYearEl = document.getElementById("monthYear");
  const calendarDaysEl = document.getElementById("calendarDays");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-11

  // Оновлення заголовка місяця
  monthYearEl.textContent = currentMonth.toLocaleDateString("uk-UA", { month: "long", year: "numeric" });

  // Очищення контейнера днів
  calendarDaysEl.innerHTML = "";

  // Перший день місяця та кількість днів
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Зсув для початку з понеділка
  const startOffset = getMondayBasedDay(firstDay);

  // Додавання порожніх комірок перед першим днем
  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    calendarDaysEl.appendChild(empty);
  }

  // Додавання кнопок для кожного дня місяця
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = formatDate(date);
    const dayOfWeek = date.getDay();
    const isWorkday = SCHEDULE[dayOfWeek] !== null;
    const isPast = date < today;

    const btn = document.createElement("button");
    btn.className = "calendar-day";
    if (!isWorkday || isPast) {
      btn.classList.add("disabled");
      btn.disabled = true;
    } else {
      btn.addEventListener("click", () => selectDate(dateStr));
    }

    // Підсвічування вибраної дати
    if (selectedDate === dateStr) {
      btn.classList.add("selected");
    }

    btn.textContent = day;
    calendarDaysEl.appendChild(btn);
  }
}

// Вибір дати
async function selectDate(dateStr) {
  selectedDate = dateStr;
  selectedTime = null; // скидаємо час при зміні дати
  updateSelectedInfo();

  // Оновлення підсвічування
  document.querySelectorAll(".calendar-day").forEach(btn => {
    btn.classList.remove("selected");
    if (btn.textContent == new Date(dateStr.split('.').reverse().join('-')).getDate()) {
      btn.classList.add("selected");
    }
  });

  // Завантаження доступних слотів
  const slotsContainer = document.getElementById("slotsContainer");
  slotsContainer.innerHTML = "<p>Завантаження слотів...</p>";

  try {
    const availableSlots = await getAvailableSlots(dateStr);
    slotsContainer.innerHTML = "";

    if (availableSlots.length === 0) {
      slotsContainer.innerHTML = "<p>Немає доступних слотів на цю дату</p>";
      return;
    }

    availableSlots.forEach(slot => {
      const btn = document.createElement("button");
      btn.className = "slot available";
      btn.textContent = slot;
      btn.addEventListener("click", () => selectTime(slot));
      slotsContainer.appendChild(btn);
    });
  } catch (error) {
    console.error("Помилка отримання слотів:", error);
    slotsContainer.innerHTML = "<p>Помилка завантаження слотів</p>";
  }
}

// Вибір часу
function selectTime(time) {
  selectedTime = time;
  updateSelectedInfo();

  // Підсвічування вибраного слота
  document.querySelectorAll(".slot").forEach(btn => {
    btn.classList.remove("selected");
    if (btn.textContent === time) {
      btn.classList.add("selected");
    }
  });
}

// Оновлення інформації про вибір
function updateSelectedInfo() {
  const infoEl = document.getElementById("selectedInfo");
  if (selectedDate && selectedTime) {
    infoEl.textContent = `Вибрано: ${selectedDate} о ${selectedTime}`;
  } else if (selectedDate) {
    infoEl.textContent = `Вибрана дата: ${selectedDate}. Оберіть час.`;
  } else {
    infoEl.textContent = "";
  }
}

// ===== ПЕРЕМИКАННЯ ГРАФІКУ =====

function toggleSchedule() {
  const details = document.getElementById("scheduleDetails");
  const toggleBtn = document.getElementById("scheduleToggle");
  const isHidden = details.style.display === "none";
  details.style.display = isHidden ? "block" : "none";
  toggleBtn.classList.toggle("active", isHidden);
}

// ===== ВІДПРАВКА БРОНЮВАННЯ =====

async function submitBooking(event) {
  event.preventDefault();
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const statusMsg = document.getElementById("statusMessage");

  if (!name || !phone || !selectedDate || !selectedTime) {
    statusMsg.textContent = "Будь ласка, заповніть усі поля та оберіть дату й час.";
    statusMsg.className = "status-message error";
    return;
  }

  const confirmBtn = document.getElementById("confirmBtn");
  confirmBtn.disabled = true;
  statusMsg.textContent = "Надсилання...";
  statusMsg.className = "status-message";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify({
        date: selectedDate,
        time: selectedTime,
        name: name,
        phone: phone
      })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();

    if (result.success) {
      // Успіх – показуємо попап
      const popup = document.getElementById("successPopup");
      const successText = document.getElementById("successText");
      successText.innerHTML = `✅ Бронювання успішно збережено!<br><b>${selectedDate} о ${selectedTime}</b><br>Ім'я: ${name}<br>Телефон: ${phone}`;
      popup.classList.add("show");

      // Скидання форми та вибору
      document.getElementById("bookingForm").reset();
      selectedDate = null;
      selectedTime = null;
      updateSelectedInfo();
      document.getElementById("slotsContainer").innerHTML = "";
      renderCalendar();
    } else {
      statusMsg.textContent = `Помилка: ${result.message}`;
      statusMsg.className = "status-message error";
    }
  } catch (error) {
    console.error("Помилка відправки:", error);
    statusMsg.textContent = "Помилка збереження. Спробуйте пізніше.";
    statusMsg.className = "status-message error";
  } finally {
    confirmBtn.disabled = false;
  }
}

// Закриття попапу
function closePopup() {
  document.getElementById("successPopup").classList.remove("show");
}

// ===== ІНІЦІАЛІЗАЦІЯ =====

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Ініціалізація додатку...");

  // Навігація по місяцях
  document.getElementById("prevMonth").addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  });

  // Перемикання графіку
  document.getElementById("scheduleToggle").addEventListener("click", toggleSchedule);

  // Форма
  document.getElementById("bookingForm").addEventListener("submit", submitBooking);

  // Закриття попапу
  document.getElementById("closePopup").addEventListener("click", closePopup);

  // Початкове відображення календаря та завантаження бронювань
  renderCalendar();
  loadBookings().then(() => console.log("Бронювання завантажено"));
});
