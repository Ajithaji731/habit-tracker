document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // DOM Elements
  const dateDisplay = document.getElementById('dateDisplay');
  const progressPercent = document.getElementById('progressPercent');
  const progressBar = document.getElementById('progressBar');
  const addHabitForm = document.getElementById('addHabitForm');
  const habitInput = document.getElementById('habitInput');
  const addBtn = document.getElementById('addBtn');
  const habitList = document.getElementById('habitList');

  // Modal Elements
  const modalOverlay = document.getElementById('modalOverlay');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalTitle = document.getElementById('modalTitle');
  const openGlobalCalendarBtn = document.getElementById('openGlobalCalendarBtn');
  const calendarGrid = document.getElementById('calendarGrid');
  const calendarMonthLabel = document.getElementById('calendarMonthLabel');
  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');

  // State
  let habits = JSON.parse(localStorage.getItem('habits')) || [];
  
  // Date State
  const actualToday = new Date();
  let currentSelectedDate = new Date(actualToday); 
  // For the calendar rendering
  let calendarViewingDate = new Date(actualToday);
  
  // Modes: 'global' (picking a date for the main view) or 'habit' (viewing a habit's streaks)
  let modalMode = 'global'; 
  let selectedHabitId = null;

  function toISO(dateObj) {
    return dateObj.getFullYear() + '-' + 
           String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + 
           String(dateObj.getDate()).padStart(2, '0');
  }

  // Save to LocalStorage
  function saveHabits() {
    localStorage.setItem('habits', JSON.stringify(habits));
    renderMainView();
  }

  // Handle Input typing for Add button state
  habitInput.addEventListener('input', () => {
    addBtn.disabled = habitInput.value.trim().length === 0;
  });

  // Handle Form Submit
  addHabitForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = habitInput.value.trim();
    if (name) {
      habits.push({
        id: crypto.randomUUID(),
        name: name,
        completedDates: []
      });
      habitInput.value = '';
      addBtn.disabled = true;
      saveHabits();
    }
  });

  // Handle Delete Habit
  window.deleteHabit = (id, event) => {
    event.stopPropagation(); // prevent opening habit calendar
    habits = habits.filter(h => h.id !== id);
    saveHabits();
  };

  // Handle Toggle Date
  window.toggleHabitDate = (id, event) => {
    event.stopPropagation(); // prevent opening habit calendar
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    const isoStr = toISO(currentSelectedDate);
    if (habit.completedDates.includes(isoStr)) {
      habit.completedDates = habit.completedDates.filter(d => d !== isoStr);
    } else {
      habit.completedDates.push(isoStr);
    }
    saveHabits();
  };

  // Open Habit Calendar
  window.openHabitCalendar = (id) => {
    const habit = habits.find(h => h.id === id);
    if(!habit) return;
    
    modalMode = 'habit';
    selectedHabitId = id;
    modalTitle.textContent = habit.name + " Streaks";
    calendarViewingDate = new Date(currentSelectedDate);
    renderCalendar();
    modalOverlay.classList.add('active');
  };

  openGlobalCalendarBtn.addEventListener('click', () => {
    modalMode = 'global';
    selectedHabitId = null;
    modalTitle.textContent = "Select Date";
    calendarViewingDate = new Date(currentSelectedDate);
    renderCalendar();
    modalOverlay.classList.add('active');
  });

  closeModalBtn.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
  });

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove('active');
    }
  });

  prevMonthBtn.addEventListener('click', () => {
    calendarViewingDate.setMonth(calendarViewingDate.getMonth() - 1);
    renderCalendar();
  });

  nextMonthBtn.addEventListener('click', () => {
    calendarViewingDate.setMonth(calendarViewingDate.getMonth() + 1);
    renderCalendar();
  });

  window.selectCalendarDate = (year, month, day) => {
    if (modalMode === 'global') {
      currentSelectedDate = new Date(year, month, day);
      modalOverlay.classList.remove('active');
      renderMainView();
    }
    // If in 'habit' mode, we just use the calendar for viewing, clicking does nothing for now.
  };

  // Render Main UI
  function renderMainView() {
    const isoStr = toISO(currentSelectedDate);
    
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    let dateStr = currentSelectedDate.toLocaleDateString('en-US', options);
    if (isoStr === toISO(actualToday)) {
      dateStr = "Today, " + dateStr;
    }
    dateDisplay.textContent = dateStr;

    // 1. Calculate Progress
    const total = habits.length;
    const completedCount = habits.filter(h => h.completedDates.includes(isoStr)).length;
    const percentage = total === 0 ? 0 : Math.round((completedCount / total) * 100);

    progressPercent.textContent = `${percentage}%`;
    progressBar.style.width = `${percentage}%`;

    // 2. Render List
    if (total === 0) {
      habitList.innerHTML = `
        <div class="empty-state">
          <i data-lucide="trending-up" class="empty-icon"></i>
          <p>No habits yet. Start tracking today!</p>
        </div>
      `;
    } else {
      habitList.innerHTML = '';
      habits.forEach((habit, index) => {
        const isCompleted = habit.completedDates.includes(isoStr);
        
        const habitEl = document.createElement('div');
        habitEl.className = 'habit-item glass-panel';
        habitEl.style.animationDelay = `${index * 0.05}s`;

        habitEl.innerHTML = `
          <div class="habit-item-left">
            <button class="habit-checkbox ${isCompleted ? 'checked' : ''}" onclick="toggleHabitDate('${habit.id}', event)">
              <i data-lucide="check"></i>
            </button>
            <span class="habit-name ${isCompleted ? 'completed' : ''}" onclick="openHabitCalendar('${habit.id}')">${escapeHtml(habit.name)}</span>
          </div>
          <div class="habit-item-right">
            <div class="habit-streak">
              <span class="streak-count">${habit.completedDates.length}</span> total
            </div>
            <button class="icon-button danger" onclick="deleteHabit('${habit.id}', event)">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;
        habitList.appendChild(habitEl);
      });
    }
    lucide.createIcons();
  }

  function renderCalendar() {
    const year = calendarViewingDate.getFullYear();
    const month = calendarViewingDate.getMonth(); // 0-11
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    calendarMonthLabel.textContent = `${monthNames[month]} ${year}`;

    // Calculate days
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let habit = null;
    if (modalMode === 'habit' && selectedHabitId) {
      habit = habits.find(h => h.id === selectedHabitId);
    }

    let html = `
      <div class="calendar-day-header">Su</div>
      <div class="calendar-day-header">Mo</div>
      <div class="calendar-day-header">Tu</div>
      <div class="calendar-day-header">We</div>
      <div class="calendar-day-header">Th</div>
      <div class="calendar-day-header">Fr</div>
      <div class="calendar-day-header">Sa</div>
    `;

    for (let i = 0; i < firstDay; i++) {
      html += `<div class="calendar-day empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      let classes = ['calendar-day'];
      const dateISO = toISO(new Date(year, month, day));
      
      if (modalMode === 'global') {
        if (dateISO === toISO(currentSelectedDate)) {
          classes.push('selected');
        }
      } else if (modalMode === 'habit' && habit) {
        if (habit.completedDates.includes(dateISO)) {
          classes.push('completed');
        }
      }

      const classString = classes.join(' ');
      html += `<div class="${classString}" onclick="selectCalendarDate(${year}, ${month}, ${day})">${day}</div>`;
    }

    calendarGrid.innerHTML = html;
    lucide.createIcons();
  }

  // Helper to prevent XSS
  function escapeHtml(unsafe) {
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  // Initial render
  renderMainView();
});
