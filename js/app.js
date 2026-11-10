
// ===================================
// TimeFlow - Main Application
// ===================================

// الساعة والتاريخ
function updateClock() {
    const now = new Date();

    document.getElementById("current-time").textContent =
        now.toLocaleTimeString("ar", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

    document.getElementById("current-date").textContent =
        now.toLocaleDateString("ar", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
}

updateClock();
setInterval(updateClock, 1000);


// ===================================
// TimeFlow - Supabase Connection
// ===================================

const timeFlowDB = window.timeFlowSupabase;
const timeFlowUser = window.timeFlowUser;


// ===================================
// TimeFlow - Tasks
// ===================================

let tasks = [];

// تحميل المهام الخاصة بالمستخدم
async function loadTasks() {
    const taskList = document.getElementById("task-list");
    try {
        if (!timeFlowUser) throw new Error("لم يتم العثور على جلسة المستخدم.");
        tasks = await window.TimeFlowOffline.list("tasks", "created_at");
        renderTasks();
    } catch (error) {
        console.error("خطأ تحميل المهام:", error);
        taskList.textContent = "تعذر تحميل المهام المحفوظة على هذا الجهاز.";
    }
}

// عرض المهام
function renderTasks() {
    const taskList = document.getElementById("task-list");
    taskList.innerHTML = "";

    if (tasks.length === 0) {
        const emptyMessage = document.createElement("p");

        emptyMessage.textContent =
            "لا توجد مهام حالياً. أضف مهمتك الأولى!";

        taskList.appendChild(emptyMessage);
    }

    tasks.forEach(task => {
        const item = document.createElement("div");
        item.className = "task-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(task.completed);

        // تحديث حالة المهمة
        checkbox.addEventListener("change", async () => {
            const previousValue = task.completed;
            const newValue = checkbox.checked;

            checkbox.disabled = true;

            try {
                await window.TimeFlowOffline.update("tasks", task.id, { completed: newValue });
                task.completed = newValue;
                renderTasks();

            } catch (error) {
                checkbox.checked = previousValue;
                checkbox.disabled = false;

                alert("تعذر تحديث المهمة: " + error.message);
            }
        });

        const info = document.createElement("div");

        const title = document.createElement("h3");
        title.textContent = task.title;

        const details = document.createElement("p");

        details.textContent =
            `${task.category || "غير مصنف"} • أولوية ${task.priority || "متوسطة"}`;

        info.appendChild(title);
        info.appendChild(details);

        const status = document.createElement("span");

        status.className = task.completed
            ? "task-status completed"
            : "task-status pending";

        status.textContent = task.completed
            ? "مكتملة"
            : "قيد الانتظار";

        // زر الحذف
        const deleteButton = document.createElement("button");

        deleteButton.textContent = "حذف";
        deleteButton.className = "delete-btn";

        deleteButton.addEventListener("click", async () => {
            deleteButton.disabled = true;

            try {
                await window.TimeFlowOffline.remove("tasks", task.id);
                tasks = tasks.filter(t => t.id !== task.id);
                renderTasks();

            } catch (error) {
                deleteButton.disabled = false;

                alert("تعذر حذف المهمة: " + error.message);
            }
        });

        item.appendChild(checkbox);
        item.appendChild(info);
        item.appendChild(status);
        item.appendChild(deleteButton);

        taskList.appendChild(item);
    });

    updateStatistics();
}


// تحديث الإحصائيات
function updateStatistics() {
    updateAnalytics();

    const total = tasks.length;

    const completed = tasks.filter(
        task => task.completed
    ).length;

    const remaining = total - completed;

    const percentage = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    document.getElementById("total-tasks").textContent = total;

    document.getElementById("completed-tasks").textContent =
        completed;

    document.getElementById("remaining-tasks").textContent =
        remaining;

    document.getElementById("progress-percent").textContent =
        percentage + "%";

    document.getElementById("progress-fill").style.width =
        percentage + "%";

    document.getElementById("progress-text").textContent =
        `أنجزت ${completed} من أصل ${total} مهام`;
}


// إضافة مهمة جديدة
document.getElementById("add-task-btn")
    .addEventListener("click", async () => {

        const title = prompt("اكتب اسم المهمة:");

        if (!title || !title.trim()) return;

        const category = prompt(
            "حدد نوع المهمة: دراسة أو عمل أو شخصي",
            "شخصي"
        ) || "شخصي";

        const priority = prompt(
            "حدد الأولوية: عالية أو متوسطة أو منخفضة",
            "متوسطة"
        ) || "متوسطة";

        const newTask = {
            user_id: timeFlowUser.id,
            title: title.trim(),
            category: category.trim(),
            priority: priority.trim(),
            completed: false,
            created_at: new Date().toISOString()
        };

        try {
            const savedTask = await window.TimeFlowOffline.insert("tasks", newTask);
            tasks.unshift(savedTask);
            renderTasks();
            alert(navigator.onLine ? "تم حفظ المهمة على الجهاز وستتم مزامنتها." : "تم حفظ المهمة على الجهاز، وستتم مزامنتها عند عودة الإنترنت.");
        } catch (error) {
            console.error("خطأ إضافة المهمة:", error);
            alert("تعذر حفظ المهمة محلياً: " + error.message);
        }
    });


// تحميل المهام عند تشغيل التطبيق
loadTasks();


// ===================================
// TimeFlow - Pomodoro Timer
// ===================================

const timerDisplay = document.getElementById("timer-display");
const timerLabel = document.getElementById("timer-label");

const timerModes = {
    focus: {
        seconds: 25 * 60,
        label: "وقت التركيز"
    },

    short: {
        seconds: 5 * 60,
        label: "استراحة قصيرة"
    },

    long: {
        seconds: 15 * 60,
        label: "استراحة طويلة"
    }
};

let selectedMode = "focus";
let remainingSeconds = timerModes.focus.seconds;
let timerInterval = null;


function displayTimer() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    timerDisplay.textContent =
        String(minutes).padStart(2, "0") + ":" +
        String(seconds).padStart(2, "0");
}


function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}


function startTimer() {
    if (timerInterval !== null) return;

    if (remainingSeconds <= 0) return;

    timerInterval = setInterval(() => {
        remainingSeconds--;

        displayTimer();

        if (remainingSeconds <= 0) {
            stopTimer();

            timerDisplay.textContent = "00:00";

            alert("أحسنت! انتهت الجلسة بنجاح 🎉");
        }

    }, 1000);
}


function pauseTimer() {
    stopTimer();
}


function resetTimer() {
    stopTimer();

    remainingSeconds = timerModes[selectedMode].seconds;

    displayTimer();
}


function changeTimerMode(mode) {
    if (!timerModes[mode]) return;

    selectedMode = mode;

    timerLabel.textContent = timerModes[mode].label;

    document.querySelectorAll(".mode-btn").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.mode === mode
        );
    });

    resetTimer();
}


// أزرار المؤقت
document.getElementById("start-timer")
    .addEventListener("click", startTimer);

document.getElementById("pause-timer")
    .addEventListener("click", pauseTimer);

document.getElementById("reset-timer")
    .addEventListener("click", resetTimer);


// اختيار نوع الجلسة
document.querySelectorAll(".mode-btn").forEach(button => {
    button.addEventListener("click", () => {
        changeTimerMode(button.dataset.mode);
    });
});


// عرض الوقت الأولي
displayTimer();


// ===================================
// TimeFlow - Smart Calendar with Supabase
// ===================================

const calendarGrid = document.getElementById("calendar-grid");
const calendarMonth = document.getElementById("calendar-month");
const selectedDateTitle = document.getElementById("selected-date-title");
const calendarEvents = document.getElementById("calendar-events");

let calendarDate = new Date();
let selectedDate = new Date();

let events = [];

const weekdays = [
    "الأحد", "الإثنين", "الثلاثاء",
    "الأربعاء", "الخميس", "الجمعة", "السبت"
];


// تحويل التاريخ إلى مفتاح ثابت
function getDateKey(date) {
    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// استخراج تاريخ الموعد
function getEventDate(event) {
    return new Date(event.starts_at);
}


// استخراج مفتاح تاريخ الموعد
function getEventDateKey(event) {
    return getDateKey(getEventDate(event));
}


// استخراج وقت الموعد
function getEventTime(event) {
    const date = getEventDate(event);

    return date.toLocaleTimeString("ar", {
        hour: "2-digit",
        minute: "2-digit"
    });
}


// تحميل المواعيد من Supabase
async function loadEvents() {
    try {
        if (!timeFlowUser) throw new Error("لم يتم العثور على جلسة المستخدم.");
        events = await window.TimeFlowOffline.list("events", "starts_at");
        renderCalendar();
        renderEvents();
    } catch (error) {
        console.error("خطأ تحميل المواعيد:", error);
        calendarEvents.textContent = "تعذر تحميل المواعيد المحفوظة على هذا الجهاز.";
    }
}

// عرض التقويم
function renderCalendar() {
    calendarGrid.innerHTML = "";

    calendarMonth.textContent =
        calendarDate.toLocaleDateString("ar", {
            month: "long",
            year: "numeric"
        });

    // أسماء أيام الأسبوع
    weekdays.forEach(day => {
        const heading = document.createElement("div");

        heading.className = "calendar-day weekday";
        heading.textContent = day;

        calendarGrid.appendChild(heading);
    });

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();

    const daysInMonth = new Date(
        year,
        month + 1,
        0
    ).getDate();

    // المساحات الفارغة قبل أول يوم
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");

        calendarGrid.appendChild(empty);
    }

    // إنشاء الأيام
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);

        const dateKey = getDateKey(date);

        const button = document.createElement("button");

        button.className = "calendar-day";
        button.textContent = day;

        if (dateKey === getDateKey(new Date())) {
            button.classList.add("today");
        }

        if (dateKey === getDateKey(selectedDate)) {
            button.classList.add("selected");
        }

        if (
            events.some(event =>
                getEventDateKey(event) === dateKey
            )
        ) {
            button.classList.add("has-event");
        }

        button.addEventListener("click", () => {
            selectedDate = date;

            renderCalendar();
            renderEvents();
        });

        calendarGrid.appendChild(button);
    }
}


// عرض مواعيد اليوم المختار
function renderEvents() {
    const dateKey = getDateKey(selectedDate);

    selectedDateTitle.textContent =
        "مواعيد " + selectedDate.toLocaleDateString("ar", {
            weekday: "long",
            day: "numeric",
            month: "long"
        });

    calendarEvents.innerHTML = "";

    const dailyEvents = events.filter(
        event => getEventDateKey(event) === dateKey
    );

    if (dailyEvents.length === 0) {
        const empty = document.createElement("p");

        empty.className = "empty-events";

        empty.textContent = "لا توجد مواعيد لهذا اليوم.";

        calendarEvents.appendChild(empty);

        return;
    }

    dailyEvents.forEach(event => {
        const item = document.createElement("div");

        item.className = "event-item";

        const title = document.createElement("strong");

        title.textContent = event.title;

        const time = document.createElement("span");

        time.textContent = getEventTime(event);

        const deleteButton = document.createElement("button");

        deleteButton.className = "delete-btn";
        deleteButton.textContent = "حذف";

        // حذف الموعد من Supabase
        deleteButton.addEventListener("click", async () => {
            deleteButton.disabled = true;

            try {
                await window.TimeFlowOffline.remove("events", event.id);
                events = events.filter(e => e.id !== event.id);

                renderCalendar();
                renderEvents();

            } catch (error) {
                console.error("خطأ حذف الموعد:", error);

                deleteButton.disabled = false;

                alert("تعذر حذف الموعد: " + error.message);
            }
        });

        item.appendChild(title);
        item.appendChild(time);
        item.appendChild(deleteButton);

        calendarEvents.appendChild(item);
    });
}


// إضافة موعد جديد
document.getElementById("add-event-btn")
    .addEventListener("click", async () => {

        const title = prompt("اكتب اسم الموعد:");

        if (!title || !title.trim()) return;

        const time = prompt(
            "اكتب وقت الموعد بصيغة 24 ساعة، مثلاً 14:30:"
        );

        if (
            !time ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(time.trim())
        ) {
            alert(
                "اكتب الوقت بصيغة صحيحة مثل 09:30 أو 14:30."
            );

            return;
        }

        const [hours, minutes] = time
            .trim()
            .split(":")
            .map(Number);

        const eventDate = new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            hours,
            minutes,
            0
        );

        const newEvent = {
            user_id: timeFlowUser.id,
            title: title.trim(),
            description: "",
            starts_at: eventDate.toISOString(),

            ends_at: new Date(
                eventDate.getTime() + 60 * 60 * 1000
            ).toISOString()
        };

        try {
            const savedEvent = await window.TimeFlowOffline.insert("events", newEvent);
            events.push(savedEvent);
            renderCalendar();
            renderEvents();
            alert(navigator.onLine ? "تم حفظ الموعد على الجهاز وستتم مزامنته." : "تم حفظ الموعد على الجهاز، وستتم مزامنته عند عودة الإنترنت.");
        } catch (error) {
            console.error("خطأ إضافة الموعد:", error);
            alert("تعذر حفظ الموعد محلياً: " + error.message);
        }
    });


// التنقل بين الشهور
document.getElementById("prev-month")
    .addEventListener("click", () => {

        calendarDate.setMonth(
            calendarDate.getMonth() - 1
        );

        renderCalendar();
    });


document.getElementById("next-month")
    .addEventListener("click", () => {

        calendarDate.setMonth(
            calendarDate.getMonth() + 1
        );

        renderCalendar();
    });


// تشغيل التقويم وتحميل المواعيد
renderCalendar();
loadEvents();


// ===================================
// TimeFlow - Analytics
// ===================================

function updateAnalytics() {
    const total = tasks.length;

    const completed = tasks.filter(
        task => task.completed
    ).length;

    const pending = total - completed;

    document.getElementById("analytics-total").textContent =
        total;

    document.getElementById("analytics-completed").textContent =
        completed;

    document.getElementById("analytics-pending").textContent =
        pending;

    const chart = document.getElementById("category-chart");

    chart.innerHTML = "";

    if (total === 0) {
        chart.textContent =
            "أضف مهامك لعرض إحصائيات التصنيفات.";

        return;
    }

    const categories = {};

    tasks.forEach(task => {
        const category = task.category || "غير مصنف";

        categories[category] =
            (categories[category] || 0) + 1;
    });

    Object.entries(categories).forEach(([name, count]) => {
        const percentage = Math.round(
            (count / total) * 100
        );

        const row = document.createElement("div");

        row.className = "category-row";

        const info = document.createElement("div");

        info.className = "category-info";

        const label = document.createElement("span");

        label.textContent = name;

        const value = document.createElement("span");

        value.textContent =
            `${count} مهمة (${percentage}%)`;

        info.appendChild(label);
        info.appendChild(value);

        const bar = document.createElement("div");

        bar.className = "category-bar";

        const fill = document.createElement("div");

        fill.className = "category-fill";
        fill.style.width = percentage + "%";

        bar.appendChild(fill);

        row.appendChild(info);
        row.appendChild(bar);

        chart.appendChild(row);
    });
}
