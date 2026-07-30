let selectedDate = "";
let selectedTime = "";
let bookings = [];

const API_URL = "https://script.google.com/macros/s/AKfycbwtUAV-2Y8ctiqnRwCw-3TRZUx3V2aPwDmFOI9Ko_equLww8gLXQBlSyWKdiLsYmVTX/exec";

const ALL_SLOTS = [
    "10:00",
    "10:45",
    "11:30",
    "12:15",
    "13:00",
    "13:45",
    "14:30"
];

const DEFAULT_OPEN_SLOTS = [
    "11:30",
    "12:15",
    "13:00"
];

const UNLOCK_RULES = {
    "13:00": "13:45",
    "13:45": "14:30",
    "11:30": "10:45",
    "10:45": "10:00"
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

        if ([6, 0, 1].includes(weekDay) || dateOnly < todayOnly) {
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
    const bookedTimes = getBookedTimes(date);
    const availableSet = new Set();

    DEFAULT_OPEN_SLOTS.forEach(slot => {
        if (!bookedTimes.includes(slot)) {
            availableSet.add(slot);
        }
    });

    bookedTimes.forEach(bookedTime => {
        const unlockedSlot = UNLOCK_RULES[bookedTime];
        if (unlockedSlot && !bookedTimes.includes(unlockedSlot)) {
            availableSet.add(unlockedSlot);
        }
    });

    return Array.from(availableSet);
}

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

function renderSlots() {
    slotsContainer.innerHTML = "";

    ALL_SLOTS.forEach((time) => {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("slot");
        button.dataset.time = time;

        if (!selectedDate) {
            button.classList.add("locked");
            button.textContent = time;
            button.disabled = true;
            slotsContainer.appendChild(button);
            return;
        }

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
        } else {
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