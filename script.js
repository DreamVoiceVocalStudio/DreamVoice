const API_URL = "https://script.google.com/macros/s/AKfycbzmPk3tczWGN8BmIgrGKK7SP02iplTkXdw87TKmgcGPbU197JR_9ipitVdwwj0BU4FAdQ/exec";

// Конфигурация расписания
const SCHEDULE = {
  0: null, // Воскресенье - выходной
  1: { slots: ["13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30", "18:15", "19:00", "19:45"], name: "Вторник" }, // Вторник
  2: { slots: ["17:00", "17:45", "18:30", "19:15", "20:00"], name: "Среда" }, // Среда
  3: { slots: ["13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30", "18:15", "19:00", "19:45"], name: "Четверг" }, // Четверг
  4: { slots: ["17:00", "17:45", "18:30", "19:15", "20:00"], name: "Пятница" }, // Пятница
  5: null, // Суббота - выходной
  6: { slots: ["17:00", "17:45", "18:30", "19:15", "20:00"], name: "Понедельник" } // Понедельник
};

// ===== ЗАГРУЗКА БРОНИРОВАНИЙ =====
async function loadBookings() {
  try {
    console.log("🔄 Загрузка бронирований...");
    
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Ответ от сервера:", result);

    if (!result.success) {
      console.error("❌ Ошибка сервера:", result.message);
      return [];
    }

    const bookings = result.data || [];
    console.log("📋 Загруженные бронирования:", bookings);
    
    return bookings;
  } catch (error) {
    console.error("❌ Ошибка при загрузке бронирований:", error);
    alert("Ошибка при загрузке расписания. Пожалуйста, попробуйте позже.");
    return [];
  }
}

// ===== ПРОВЕРКА ДОСТУПНОСТИ СЛОТА =====
function isSlotBooked(date, time, bookings) {
  return bookings.some(booking => 
    booking.date === date && booking.time === time
  );
}

// ===== ПОЛУЧЕНИЕ ДОСТУПНЫХ СЛОТОВ =====
async function getAvailableSlots(selectedDate) {
  const bookings = await loadBookings();
  const dayOfWeek = new Date(selectedDate).getDay();
  
  if (!SCHEDULE[dayOfWeek]) {
    return []; // День не рабочий
  }

  const availableSlots = SCHEDULE[dayOfWeek].slots.filter(slot => 
    !isSlotBooked(selectedDate, slot, bookings)
  );

  return availableSlots;
}

// ===== ИНИЦИАЛИЗАЦИЯ КАЛЕНДАРЯ =====
function initCalendar() {
  const calendarDiv = document.getElementById("calendar");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  calendarDiv.innerHTML = "";

  // Генерируем календарь на 30 дней
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    
    const dayOfWeek = date.getDay();
    const dateStr = date.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });
    
    // Проверяем, рабочий ли день
    const isWorkday = SCHEDULE[dayOfWeek] !== null;
    const dayName = SCHEDULE[dayOfWeek]?.name || "Вихідний";
    
    const button = document.createElement("button");
    button.className = `calendar-btn ${isWorkday ? "workday" : "holiday"}`;
    button.textContent = `${dateStr}\n${dayName}`;
    
    if (isWorkday) {
      button.onclick = () => selectDate(dateStr);
    } else {
      button.disabled = true;
    }
    
    calendarDiv.appendChild(button);
  }
}

// ===== ВЫБОР ДАТЫ =====
async function selectDate(dateStr) {
  const timeSlotsDiv = document.getElementById("timeSlots");
  const selectedDateInput = document.getElementById("selectedDate");
  
  selectedDateInput.value = dateStr;
  
  console.log("📅 Выбрана дата:", dateStr);
  
  const availableSlots = await getAvailableSlots(dateStr);
  
  timeSlotsDiv.innerHTML = "";
  
  if (availableSlots.length === 0) {
    timeSlotsDiv.innerHTML = "<p>Нет доступных слотов на эту дату</p>";
    return;
  }
  
  availableSlots.forEach(slot => {
    const button = document.createElement("button");
    button.className = "time-btn";
    button.textContent = slot;
    button.onclick = () => selectTime(slot);
    timeSlotsDiv.appendChild(button);
  });
}

// ===== ВЫБОР ВРЕМЕНИ =====
function selectTime(time) {
  const selectedTimeInput = document.getElementById("selectedTime");
  selectedTimeInput.value = time;
  console.log("⏰ Выбрано время:", time);
}

// ===== ОТПРАВКА БРОНИРОВАНИЯ =====
document.getElementById("bookingForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const date = document.getElementById("selectedDate").value;
  const time = document.getElementById("selectedTime").value;
  
  if (!name || !phone || !date || !time) {
    alert("Пожалуйста, заполните все поля");
    return;
  }
  
  try {
    console.log("📤 Отправка бронирования...");
    
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      },
      body: JSON.stringify({
        date: date,
        time: time,
        name: name,
        phone: phone
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Ответ от сервера:", result);

    if (result.success) {
      alert("✅ Бронирование успешно сохранено!");
      document.getElementById("bookingForm").reset();
      document.getElementById("selectedDate").value = "";
      document.getElementById("selectedTime").value = "";
      document.getElementById("timeSlots").innerHTML = "";
      
      // Перезагружаем календарь
      initCalendar();
    } else {
      alert("❌ Ошибка: " + result.message);
    }
  } catch (error) {
    console.error("❌ Ошибка при отправке бронирования:", error);
    alert("❌ Ошибка при сохранении бронирования. Пожалуйста, попробуйте позже.");
  }
});

// ===== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ =====
document.addEventListener("DOMContentLoaded", function() {
  console.log("🚀 Инициализация приложения...");
  initCalendar();
  loadBookings();
});

// ===== ТЕСТИРОВАНИЕ API =====
async function testAPI() {
  console.log("🧪 Тестирование API...");
  try {
    // Тест GET
    console.log("📥 Тестирование GET...");
    const getResponse = await fetch(API_URL);
    const getText = await getResponse.text();
    console.log("GET Response:", getText);
    
    // Тест POST
    console.log("📤 Тестирование POST...");
    const postResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      },
      body: JSON.stringify({
        date: "15.01.2025",
        time: "17:00",
        name: "Тест",
        phone: "+380991234567"
      })
    });
    
    const postText = await postResponse.text();
    console.log("POST Response:", postText);
  } catch (error) {
    console.error("❌ API Test Error:", error);
  }
}
