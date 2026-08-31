const API_URL = "https://script.google.com/macros/s/AKfycbzmPk3tczWGN8BmIgrGKK7SP02iplTkXdw87TKmgcGPbU197JR_9ipitVdwwj0BU4FAdQ/exec";

// Графік роботи (0 = Неділя, 1 = Понеділок, ..., 6 = Субота)
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
let currentMonth = new Date();
let selectedDate = null;
let selectedTime = null;
let bookingsCache = [];

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function getMondayBasedDay(date) {
  return (date.getDay() + 6) % 7;
}

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

function isSlotBooked(date, time, bookings) {
  return bookings.some(b => b.date === date && b.time === time);
}

async function getAvailableSlots(dateStr) {
  const dayOfWeek = new Date(dateStr.split('.').reverse().join('-')).getDay();
  const schedule = SCHEDULE[dayOfWeek];
  if (!schedule) return [];

  const bookings = await loadBookings();
  return schedule.slots.filter(slot => !isSlotBooked(dateStr, slot, bookings));
}

function renderCalendar() {
  const monthYearEl = document.getElementById("monthYear");
  const calendarDaysEl = document.getElementById("calendarDays");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  monthYearEl.textContent = currentMonth.toLocaleDateString("uk-UA", { month: "long", year: "numeric" });

  calendarDaysEl.innerHTML = "";

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startOffset = getMondayBasedDay(firstDay);

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    calendarDaysEl.appendChild(empty);
  }

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

    if (selectedDate === dateStr) {
      btn.classList.add("selected");
    }

    btn.textContent = day;
    calendarDaysEl.appendChild(btn);
  }
}

async function selectDate(dateStr) {
  selectedDate = dateStr;
  selectedTime = null;
  updateSelectedInfo();

  document.querySelectorAll(".calendar-day").forEach(btn => {
    btn.classList.remove("selected");
    if (btn.textContent == new Date(dateStr.split('.').reverse().join('-')).getDate()) {
      btn.classList.add("selected");
    }
  });

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

function selectTime(time) {
  selectedTime = time;
  updateSelectedInfo();

  document.querySelectorAll(".slot").forEach(btn => {
    btn.classList.remove("selected");
    if (btn.textContent === time) {
      btn.classList.add("selected");
    }
  });
}

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

function toggleSchedule() {
  const details = document.getElementById("scheduleDetails");
  const toggleBtn = document.getElementById("scheduleToggle");
  const isHidden = details.style.display === "none";
  details.style.display = isHidden ? "block" : "none";
  toggleBtn.classList.toggle("active", isHidden);
}

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
      const popup = document.getElementById("successPopup");
      const successText = document.getElementById("successText");
      successText.innerHTML = `✅ Бронювання успішно збережено!<br><b>${selectedDate} о ${selectedTime}</b><br>Ім'я: ${name}<br>Телефон: ${phone}`;
      popup.classList.add("show");

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

function closePopup() {
  document.getElementById("successPopup").classList.remove("show");
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Ініціалізація додатку...");

  document.getElementById("prevMonth").addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  });

  document.getElementById("scheduleToggle").addEventListener("click", toggleSchedule);

  document.getElementById("bookingForm").addEventListener("submit", submitBooking);

  document.getElementById("closePopup").addEventListener("click", closePopup);

  renderCalendar();
  loadBookings().then(() => console.log("Бронювання завантажено"));
});
