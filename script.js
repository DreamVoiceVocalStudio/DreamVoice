let selectedDate = "";
let selectedTime = "";
let bookings = [];

const API_URL = "https://script.google.com/macros/s/AKfycbwtUAV-2Y8ctiqnRwCw-3TRZUx3V2aPwDmFOI9Ko_equLww8gLXQBlSyWKdiLsYmVTX/exec";

// Графік роботи (день тижня -> дозволені часи)
// 0 = неділя, 1 = понеділок, ..., 6 = субота
const SCHEDULE = {
    1: ["17:00", "17:45", "18:30", "19:15", "20:00"],      // Понеділок
    2: ["13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30", "18:15", "19:00", "19:45"],  // Вівторок
    3: ["17:00", "17:45", "18:30", "19:15", "20:00"],      // Середа
    4: ["13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30", "18:15", "19:00", "19:45"],  // Четвер
    5: ["17:00", "17:45", "18:30", "19:15", "20:00"]       // П'ятниця
    // Субота (6) і неділя (0) - вихідні
};

// Спочатку доступні слоти
const DEFAULT_OPEN_SLOTS = {
    1: ["17:45", "18:30"],      // Понеділок
    2: ["15:15", "16:00", "16:45", "17:30"],  // Вівторок
    3: ["17:45", "18:30"],      // Середа
    4: ["15:15", "16:00", "16:45", "17:30"],  // Четвер
    5: ["17:45", "18:30"]       // П'ятниця
};

// Правила розблокування слотів
// Понеділок, середа, п'ятниця: 17:45 → 18:30 → 19:15 → 20:00
// Вівторок, четвер: 15:15 → 16:00 → 16:45 → 17:30 → 18:15 → 19:00 → 19:45
const UNLOCK_RULES = {
    // Понеділок, середа, п'ятниця
    "17:45": "18:30",
    "18:30": "19:15",
    "19:15": "20:00",
    
    // Вівторок, четвер
    "15:15": "16:00",
    "16:00": "16:45",
    "16:45": "17:30",
    "17:30": "18:15",
    "18:15": "19:00",
    "19:00": "19:45"
};

const calendarDays = document.querySelector("#calendarDays");
const monthYear = document.querySelector("#monthYear");
const prevMonth = document.querySelector("#prevMonth");
const nextMonth = document.querySelector("#nextMonth");
const slotsContainer = document.querySelector("#slotsContainer");
const bookingForm = document.querySelector("#bookingForm");
const confirmBtn = document.querySelector("#confirmBtn");
const nameInput = document.querySelector("#name");
const phoneInput = document.querySelector("#phone");
const selectedInfo = document.querySelector("#selectedInfo");
const statusMessage = document.querySelector("#statusMessage");
const successPopup = document.querySelector("#successPopup");
const closePopup = document.querySelector("#closePopup");
const successText = document.querySelector("#successText");

let currentDate = new Date();

async function loadBookings() {
    try {
        const response = await fetch(API_URL, {
            method: "GET"
        });

        const data = await response.json();

        if (Array.isArray(data)) {
            bookings = data;
        } else {
            bookings = [];
            console.error("Некоректна відповідь сервера:", data);
            setStatus("Некоректна відповідь сервера.", "error");
        }
    } catch (error) {
        console.error("Помилка завантаження:", error);
        bookings = [];
        setStatus("Не вдалося завантажити бронювання.", "error");
    }
}

// Отримати дозволені часи для дня тижня
function getAllowedSlots(date) {
    const weekDay = date.getDay();
    return SCHEDULE[weekDay] || [];
}

function renderCalendar() {
    calendarDays.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    monthYear.textContent = new Date(year, month).toLocaleString("uk-UA", {
        month: "long",
        year: "numeric"
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const start = firstDay === 0 ? 7 : firstDay;

    for (let i = 1; i < start; i++) {
        const empty = document.createElement("div");
        empty.className = "calendar-day empty";
        calendarDays.appendChild(empty);
    }

    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (let day = 1; day <= daysInMonth; day++) {
        const button = document.createElement("button");
        button.className = "calendar-day";
        button.type = "button";
        button.textContent = day;

        const dateObj = new Date(year, month, day);
        const weekDay = dateObj.getDay();
        const dateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        const formattedDate = formatDate(dateObj);

        // Перевірка: чи це робочий день і чи це не в минулому
        const allowedSlots = getAllowedSlots(dateObj);
        const isWorkingDay = allowedSlots.length > 0;
        const isPast = dateOnly < todayOnly;

        if (!isWorkingDay || isPast) {
            button.classList.add("disabled");
            button.disabled = true;
        }

        if (formattedDate === selectedDate) {
            button.classList.add("selected");
        }

        if (!button.disabled) {
            button.addEventListener("click", () => {
                selectedDate = formattedDate;
                selectedTime = "";
                clearStatus();
                renderCalendar();
                renderSlots();
                updateSelectedInfo();
            });
        }

        calendarDays.appendChild(button);
    }
}

function getBookedTimes(date) {
    return bookings
        .filter(item => item.date === date)
        .map(item => item.time);
}

function getAvailableSlots(date) {
    // Отримаємо дату як об'єкт
    const [day, month, year] = date.split(".").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const weekDay = dateObj.getDay();

    // Отримуємо дозволені часи для цього дня
    const allowedSlots = getAllowedSlots(dateObj);
    const defaultOpenSlots = DEFAULT_OPEN_SLOTS[weekDay] || [];
    const bookedTimes = getBookedTimes(date);

    const availableSet = new Set();

    // Додаємо дозволені за замовчуванням слоти
    defaultOpenSlots.forEach(slot => {
        if (allowedSlots.includes(slot) && !bookedTimes.includes(slot)) {
            availableSet.add(slot);
        }
    });

    // Розблокуємо слоти за правилами
    bookedTimes.forEach(bookedTime => {
        const unlockedSlot = UNLOCK_RULES[bookedTime];
        if (unlockedSlot && 
            allowedSlots.includes(unlockedSlot) && 
            !bookedTimes.includes(unlockedSlot)) {
            availableSet.add(unlockedSlot);
        }
    });

    return Array.from(availableSet).sort();
}

function getSlotState(date, time) {
    // Отримаємо дату як об'єкт
    const [day, month, year] = date.split(".").map(Number);
    const dateObj = new Date(year, month - 1, day);
    
    const allowedSlots = getAllowedSlots(dateObj);
    const bookedTimes = getBookedTimes(date);

    // Якщо час не дозволено в цей день
    if (!allowedSlots.includes(time)) {
        return "hidden"; // Не показуємо цей час
    }

    if (bookedTimes.includes(time)) {
        return "booked";
    }

    const availableSlots = getAvailableSlots(date);

    if (availableSlots.includes(time)) {
        return "available";
    }

    return "locked";
}

function renderSlots() {
    slotsContainer.innerHTML = "";

    if (!selectedDate) {
        const message = document.createElement("p");
        message.style.color = "#999";
        message.textContent = "Оберіть дату для перегляду доступних часів";
        slotsContainer.appendChild(message);
        return;
    }

    // Отримаємо дату як об'єкт
    const [day, month, year] = selectedDate.split(".").map(Number);
    const dateObj = new Date(year, month - 1, day);
    
    const allowedSlots = getAllowedSlots(dateObj);

    if (allowedSlots.length === 0) {
        const message = document.createElement("p");
        message.style.color = "#999";
        message.textContent = "Цей день не є робочим днем";
        slotsContainer.appendChild(message);
        return;
    }

    // Показуємо тільки дозволені часи для цього дня
    allowedSlots.forEach((time) => {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("slot");
        button.dataset.time = time;

        const state = getSlotState(selectedDate, time);

        if (state === "booked") {
            button.classList.add("booked");
            button.textContent = `${time} — зайнято`;
            button.disabled = true;
        } else if (state === "available") {
            button.classList.add("available");
            button.textContent = time;
            button.disabled = false;

            if (selectedTime === time) {
                button.classList.add("selected");
            }

            button.addEventListener("click", () => {
                selectedTime = time;
                clearStatus();
                renderSlots();
                updateSelectedInfo();
            });
        } else if (state === "locked") {
            button.classList.add("locked");
            button.textContent = time;
            button.disabled = true;
        }

        slotsContainer.appendChild(button);
    });
}

function updateSelectedInfo() {
    if (selectedDate && selectedTime) {
        selectedInfo.textContent = `Обрано: ${selectedDate} о ${selectedTime}`;
    } else if (selectedDate) {
        selectedInfo.textContent = `Обрана дата: ${selectedDate}. Тепер виберіть час.`;
    } else {
        selectedInfo.textContent = "";
    }
}

function setStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "status-message";

    if (type) {
        statusMessage.classList.add(type);
    }
}

function clearStatus() {
    statusMessage.textContent = "";
    statusMessage.className = "status-message";
}

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
}

prevMonth.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    selectedDate = "";
    selectedTime = "";
    renderCalendar();
    renderSlots();
    updateSelectedInfo();
    clearStatus();
});

nextMonth.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    selectedDate = "";
    selectedTime = "";
    renderCalendar();
    renderSlots();
    updateSelectedInfo();
    clearStatus();
});

bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();

    clearStatus();

    if (!selectedDate) {
        setStatus("Оберіть дату 🤎", "error");
        return;
    }

    if (!selectedTime) {
        setStatus("Оберіть час уроку 🤎", "error");
        return;
    }

    if (!name || !phone) {
        setStatus("Заповніть ім'я та телефон 🤎", "error");
        return;
    }

    const currentState = getSlotState(selectedDate, selectedTime);

    if (currentState !== "available") {
        setStatus("Цей слот уже недоступний. Оберіть інший час.", "error");
        selectedTime = "";
        renderSlots();
        updateSelectedInfo();
        return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Збереження...";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
                date: selectedDate,
                time: selectedTime,
                name: name,
                phone: phone
            })
        });

        const rawText = await response.text();
        console.log("RAW RESPONSE:", rawText);

        let result;
        try {
            result = JSON.parse(rawText);
        } catch (parseError) {
            throw new Error("Сервер повернув не JSON: " + rawText);
        }

        if (!result.success) {
            setStatus(result.message || "Не вдалося зберегти бронювання.", "error");
            return;
        }

        await loadBookings();

        successText.innerHTML = `Ваш урок успішно заброньовано на <b>${selectedDate}</b> о <b>${selectedTime}</b>.<br>До зустрічі у DreamVoice Vocal Studio`;
        successPopup.classList.add("show");

        nameInput.value = "";
        phoneInput.value = "";
        selectedTime = "";

        renderSlots();
        updateSelectedInfo();
        setStatus("Бронювання успішно збережено.", "success");
    } catch (error) {
        console.error("Помилка відправки:", error);
        setStatus("Помилка з'єднання: " + error.message, "error");
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Підтвердити запис";
    }
});

closePopup.addEventListener("click", () => {
    successPopup.classList.remove("show");
});

document.addEventListener("DOMContentLoaded", async () => {
    await loadBookings();
    renderCalendar();
    renderSlots();
    updateSelectedInfo();
});
