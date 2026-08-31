let selectedDate = "";
let selectedTime = "";
let bookings = [];

const API_URL = "https://script.google.com/macros/s/AKfycbwtUAV-2Y8ctiqnRwCw-3TRZUx3V2aPwDmFOI9Ko_equLww8gLXQBlSyWKdiLsYmVTX/exec";

// ================================
// ГРАФІК
// ================================

const MON_WED_FRI_SLOTS = [
    "13:00",
    "13:45",
    "14:30",
    "15:15",
    "16:00",
    "16:45",
    "17:30",
    "18:15",
    "19:00",
    "19:45"
];

const TUE_THU_SLOTS = [
    "17:00",
    "17:45",
    "18:30",
    "19:15",
    "20:00"
];

const MON_WED_FRI_DEFAULT_OPEN = [
    "15:15",
    "16:00",
    "16:45",
    "17:30"
];

const TUE_THU_DEFAULT_OPEN = [
    "17:45",
    "18:30"
];

const MON_WED_FRI_UNLOCK_RULES = {
    "15:15": "14:30",
    "14:30": "13:45",
    "13:45": "13:00",
    "17:30": "18:15",
    "18:15": "19:00",
    "19:00": "19:45"
};

const TUE_THU_UNLOCK_RULES = {
    "17:45": "17:00",
    "18:30": "19:15",
    "19:15": "20:00"
};

// ================================
// ЕЛЕМЕНТИ СТОРІНКИ
// ================================

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

// ================================
// ОТРИМАННЯ БРОНЮВАНЬ
// ================================

async function loadBookings() {
    try {
        const response = await fetch(API_URL, {
            method: "GET"
        });

        const data = await response.json();

        if (Array.isArray(data)) {
            bookings = data;
        } else if (Array.isArray(data.data)) {
            bookings = data.data;
        } else {
            bookings = [];

            console.error("Некоректна відповідь сервера:", data);
            setStatus("Некоректна відповідь сервера.", "error");
        }

    } catch (error) {
        console.error("Помилка завантаження:", error);

        bookings = [];

        setStatus(
            "Не вдалося завантажити бронювання.",
            "error"
        );
    }
}

// ================================
// ВИЗНАЧЕННЯ ДНЯ ТИЖНЯ
// ================================

function getDayType(date) {
    const day = date.getDay();

    // 0 — неділя
    // 1 — понеділок
    // 2 — вівторок
    // 3 — середа
    // 4 — четвер
    // 5 — п'ятниця
    // 6 — субота

    if ([1, 3, 5].includes(day)) {
        return "monWedFri";
    }

    if ([2, 4].includes(day)) {
        return "tueThu";
    }

    return "weekend";
}

// ================================
// ОТРИМАННЯ СЛОТІВ ДЛЯ ДАТИ
// ================================

function getSlotsForDate(date) {
    const dayType = getDayType(date);

    if (dayType === "monWedFri") {
        return MON_WED_FRI_SLOTS;
    }

    if (dayType === "tueThu") {
        return TUE_THU_SLOTS;
    }

    return [];
}

// ================================
// КАЛЕНДАР
// ================================

function renderCalendar() {
    calendarDays.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    monthYear.textContent = new Date(year, month).toLocaleString(
        "uk-UA",
        {
            month: "long",
            year: "numeric"
        }
    );

    const firstDay = new Date(year, month, 1).getDay();

    const daysInMonth = new Date(
        year,
        month + 1,
        0
    ).getDate();

    const start = firstDay === 0 ? 7 : firstDay;

    for (let i = 1; i < start; i++) {
        const empty = document.createElement("div");

        empty.className = "calendar-day empty";

        calendarDays.appendChild(empty);
    }

    const today = new Date();

    const todayOnly = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    for (let day = 1; day <= daysInMonth; day++) {

        const button = document.createElement("button");

        button.className = "calendar-day";
        button.type = "button";
        button.textContent = day;

        const dateObj = new Date(
            year,
            month,
            day
        );

        const weekDay = dateObj.getDay();

        const dateOnly = new Date(
            dateObj.getFullYear(),
            dateObj.getMonth(),
            dateObj.getDate()
        );

        const formattedDate = formatDate(dateObj);

        const isWeekend = [0, 6].includes(weekDay);
        const isPast = dateOnly < todayOnly;

        if (isWeekend || isPast) {
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

// ================================
// ОТРИМАТИ ЗАЙНЯТІ ЧАСИ
// ================================

function getBookedTimes(date) {

    return bookings
        .filter(item => item.date === date)
        .map(item => item.time);
}

// ================================
// ДОСТУПНІ СЛОТИ
// ================================

function getAvailableSlots(date) {

    if (!date) {
        return [];
    }

    const dateParts = date.split(".");

    const dateObj = new Date(
        Number(dateParts[2]),
        Number(dateParts[1]) - 1,
        Number(dateParts[0])
    );

    const dayType = getDayType(dateObj);

    const bookedTimes = getBookedTimes(date);

    const availableSet = new Set();

    let defaultOpenSlots = [];
    let unlockRules = {};

    if (dayType === "monWedFri") {

        defaultOpenSlots = MON_WED_FRI_DEFAULT_OPEN;
        unlockRules = MON_WED_FRI_UNLOCK_RULES;

    } else if (dayType === "tueThu") {

        defaultOpenSlots = TUE_THU_DEFAULT_OPEN;
        unlockRules = TUE_THU_UNLOCK_RULES;

    } else {

        return [];
    }

    defaultOpenSlots.forEach(slot => {

        if (!bookedTimes.includes(slot)) {
            availableSet.add(slot);
        }
    });

    bookedTimes.forEach(bookedTime => {

        const unlockedSlot = unlockRules[bookedTime];

        if (
            unlockedSlot &&
            !bookedTimes.includes(unlockedSlot)
        ) {
            availableSet.add(unlockedSlot);
        }
    });

    return Array.from(availableSet);
}

// ================================
// СТАН СЛОТА
// ================================

function getSlotState(date, time) {

    const bookedTimes = getBookedTimes(date);

    if (bookedTimes.includes(time)) {
        return "booked";
    }

    const availableSlots = getAvailableSlots(date);

    if (availableSlots.includes(time)) {
        return "available";
    }

    return "locked";
}

// ================================
// ВІДОБРАЖЕННЯ ЧАСУ
// ================================

function renderSlots() {

    slotsContainer.innerHTML = "";

    if (!selectedDate) {
        return;
    }

    const dateParts = selectedDate.split(".");

    const selectedDateObj = new Date(
        Number(dateParts[2]),
        Number(dateParts[1]) - 1,
        Number(dateParts[0])
    );

    const allSlots = getSlotsForDate(selectedDateObj);

    if (allSlots.length === 0) {

        const message = document.createElement("p");

        message.className = "slots-note";
        message.textContent = "У цей день студія не працює.";

        slotsContainer.appendChild(message);

        return;
    }

    allSlots.forEach((time) => {

        const button = document.createElement("button");

        button.type = "button";
        button.classList.add("slot");
        button.dataset.time = time;

        const state = getSlotState(
            selectedDate,
            time
        );

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

        } else {

            button.classList.add("locked");

            button.textContent = time;

            button.disabled = true;
        }

        slotsContainer.appendChild(button);
    });
}

// ================================
// ІНФОРМАЦІЯ ПРО ВИБІР
// ================================

function updateSelectedInfo() {

    if (selectedDate && selectedTime) {

        selectedInfo.textContent =
            `Обрано: ${selectedDate} о ${selectedTime}`;

    } else if (selectedDate) {

        selectedInfo.textContent =
            `Обрана дата: ${selectedDate}. Тепер виберіть час.`;

    } else {

        selectedInfo.textContent = "";
    }
}

// ================================
// ПОВІДОМЛЕННЯ
// ================================

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

// ================================
// ФОРМАТ ДАТИ
// ================================

function formatDate(date) {

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
}

// ================================
// ПЕРЕМИКАННЯ МІСЯЦІВ
// ================================

prevMonth.addEventListener("click", () => {

    currentDate.setMonth(
        currentDate.getMonth() - 1
    );

    selectedDate = "";
    selectedTime = "";

    renderCalendar();
    renderSlots();
    updateSelectedInfo();

    clearStatus();
});

nextMonth.addEventListener("click", () => {

    currentDate.setMonth(
        currentDate.getMonth() + 1
    );

    selectedDate = "";
    selectedTime = "";

    renderCalendar();
    renderSlots();
    updateSelectedInfo();

    clearStatus();
});

// ================================
// БРОНЮВАННЯ
// ================================

bookingForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();

        clearStatus();

        if (!selectedDate) {

            setStatus(
                "Оберіть дату 🤎",
                "error"
            );

            return;
        }

        if (!selectedTime) {

            setStatus(
                "Оберіть час уроку 🤎",
                "error"
            );

            return;
        }

        if (!name || !phone) {

            setStatus(
                "Заповніть ім'я та телефон 🤎",
                "error"
            );

            return;
        }

        const currentState = getSlotState(
            selectedDate,
            selectedTime
        );

        if (currentState !== "available") {

            setStatus(
                "Цей слот уже недоступний. Оберіть інший час.",
                "error"
            );

            selectedTime = "";

            renderSlots();
            updateSelectedInfo();

            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.textContent = "Збереження...";

        try {

            const response = await fetch(
                API_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "text/plain;charset=utf-8"
                    },

                    body: JSON.stringify({
                        date: selectedDate,
                        time: selectedTime,
                        name: name,
                        phone: phone
                    })
                }
            );

            const rawText = await response.text();

            console.log(
                "RAW RESPONSE:",
                rawText
            );

            let result;

            try {

                result = JSON.parse(rawText);

            } catch (parseError) {

                throw new Error(
                    "Сервер повернув не JSON: " +
                    rawText
                );
            }

            if (!result.success) {

                setStatus(
                    result.message ||
                    "Не вдалося зберегти бронювання.",
                    "error"
                );

                return;
            }

            await loadBookings();

            const bookedDate = selectedDate;
            const bookedTime = selectedTime;

            successText.innerHTML =
                `Ваш урок успішно заброньовано на <b>${bookedDate}</b> о <b>${bookedTime}</b>.<br>До зустрічі у DreamVoice Vocal Studio`;

            successPopup.classList.add("show");

            nameInput.value = "";
            phoneInput.value = "";

            selectedTime = "";

            renderSlots();
            updateSelectedInfo();

            setStatus(
                "Бронювання успішно збережено.",
                "success"
            );

        } catch (error) {

            console.error(
                "Помилка відправки:",
                error
            );

            setStatus(
                "Помилка з'єднання: " +
                error.message,
                "error"
            );

        } finally {

            confirmBtn.disabled = false;
            confirmBtn.textContent =
                "Підтвердити запис";
        }
    }
);

// ================================
// POPUP
// ================================

closePopup.addEventListener("click", () => {

    successPopup.classList.remove("show");
});

// ================================
// ЗАПУСК
// ================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await loadBookings();

        renderCalendar();
        renderSlots();
        updateSelectedInfo();
    }
);
