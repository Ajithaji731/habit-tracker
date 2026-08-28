const GAS_URL = 'https://script.google.com/macros/s/AKfycbwTLJ5PSqaSlghakcqWW7s5-0GhBrC9KhUl5cUMfmwkkphNEiarrbEWYglYnnOcCXzo2w/exec';

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  // Screens
  const loginScreen = document.getElementById('loginScreen');
  const loadingScreen = document.getElementById('loadingScreen');
  const appScreen = document.getElementById('appScreen');
  
  // Login
  const loginForm = document.getElementById('loginForm');
  const userIdInput = document.getElementById('userIdInput');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');
  
  // App Elements
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
  const habitStats = document.getElementById('habitStats');
  const statCurrentStreak = document.getElementById('statCurrentStreak');
  const statTotalDays = document.getElementById('statTotalDays');
  
  // Calendar Elements
  const openGlobalCalendarBtn = document.getElementById('openGlobalCalendarBtn');
  const calendarGrid = document.getElementById('calendarGrid');
  const calendarMonthLabel = document.getElementById('calendarMonthLabel');
  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  
  // Toast
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  // State
  let habits = [];
  let currentUserId = localStorage.getItem('habitUserId') || null;
  const loginTimeStr = localStorage.getItem('habitLoginTime');
  const loginTime = loginTimeStr ? parseInt(loginTimeStr, 10) : 0;
  
  // Check if session is older than 10 minutes (600,000 ms)
  if (currentUserId && (Date.now() - loginTime > 600000)) {
    currentUserId = null;
    localStorage.removeItem('habitUserId');
    localStorage.removeItem('habitLoginTime');
  }
  const actualToday = new Date();
  let currentSelectedDate = new Date(actualToday); 
  let calendarViewingDate = new Date(actualToday);
  
  // Modes: 'global' or 'habit'
  let modalMode = 'global'; 
  let selectedHabitId = null;

  // --- Background Pre-fetching for 0s Instant Login ---
  let prefetchPromise = null;
  function startPrefetch(pin = "2108") {
    if (!GAS_URL) return;
    prefetchPromise = fetch(`${GAS_URL}?userId=${pin}&t=${Date.now()}`)
      .then(res => res.ok ? res.json() : null)
      .catch(err => { console.warn("Prefetch warning", err); return null; });
  }

  // Init
  if (currentUserId) {
    showLoading();
    fetchHabits(currentUserId);
  } else {
    startPrefetch("2108");
  }

  // --- Login Logic ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = userIdInput.value.trim();
    if (!id) return;
    
    if (!GAS_URL) {
      completeLogin(id);
      return;
    }
    
    try {
      let data = null;
      // If pre-fetch already ran and resolved while typing PIN, use it instantly (0s wait!)
      if (id === "2108" && prefetchPromise) {
        data = await prefetchPromise;
      }
      
      if (!data) {
        showLoading();
        const response = await fetch(`${GAS_URL}?userId=${id}&t=${Date.now()}`);
        if (!response.ok) throw new Error('Network response was not ok');
        data = await response.json();
      }
      
      if (data && data.error === "Unauthorized") {
        hideLoading();
        loginScreen.classList.remove('hidden');
        loginError.textContent = 'Wrong ID. Please try again.';
        loginError.classList.remove('hidden');
        setTimeout(() => loginError.classList.add('hidden'), 3000);
        return;
      }
      
      habits = Array.isArray(data) ? data : [];
      completeLogin(id);
    } catch (err) {
      console.error("Login verification failed:", err);
      hideLoading();
      loginScreen.classList.remove('hidden');
      loginError.textContent = 'Wrong ID or Connection failed.';
      loginError.classList.remove('hidden');
      setTimeout(() => loginError.classList.add('hidden'), 3000);
    }
  });

  function completeLogin(id) {
    currentUserId = id;
    localStorage.setItem('habitUserId', currentUserId);
    localStorage.setItem('habitLoginTime', Date.now().toString());
    loginError.classList.add('hidden');
    
    loginScreen.classList.add('hidden');
    loadingScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    
    // In offline mode (or if array was empty), load local fallback
    if (habits.length === 0) {
      const localData = localStorage.getItem('habits_fallback_' + id);
      if (localData) habits = JSON.parse(localData);
    }
    
    renderMainView();
  }

  logoutBtn.addEventListener('click', () => {
    currentUserId = null;
    localStorage.removeItem('habitUserId');
    localStorage.removeItem('habitLoginTime');
    habits = [];
    appScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    userIdInput.value = '';
  });

  // --- API Calls ---
  async function fetchHabits(userId) {
    if (!GAS_URL) {
      // Fallback for local testing if URL isn't set
      console.warn("GAS_URL is not set. Using local storage as fallback.");
      const localData = localStorage.getItem('habits_fallback_' + userId);
      habits = localData ? JSON.parse(localData) : [];
      hideLoading();
      renderMainView();
      return;
    }

    try {
      const response = await fetch(`${GAS_URL}?userId=${userId}&t=${Date.now()}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      
      if (data.error === "Unauthorized") {
         // Session expired or ID changed
         document.getElementById('logoutBtn').click();
         return;
      }
      
      habits = Array.isArray(data) ? data : [];
    } catch (err) {
      console.error(err);
      showToast('Failed to sync. Working offline.');
      const localData = localStorage.getItem('habits_fallback_' + userId);
      habits = localData ? JSON.parse(localData) : [];
    }
    hideLoading();
    renderMainView();
  }

  async function saveHabits() {
    renderMainView(); // Update UI optimistically
    
    if (!GAS_URL) {
      localStorage.setItem('habits_fallback_' + currentUserId, JSON.stringify(habits));
      return;
    }

    try {
      const payload = { userId: currentUserId, habits: habits };
      await fetch(GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error(err);
      showToast('Error saving data!');
      localStorage.setItem('habits_fallback_' + currentUserId, JSON.stringify(habits));
    }
  }

  // --- UI Helpers ---
  function showLoading() {
    loginScreen.classList.add('hidden');
    appScreen.classList.add('hidden');
    loadingScreen.classList.remove('hidden');
  }

  function hideLoading() {
    loadingScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
  }

  function showToast(msg) {
    toastMsg.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  }

  function toISO(dateObj) {
    return dateObj.getFullYear() + '-' + 
           String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + 
           String(dateObj.getDate()).padStart(2, '0');
  }
  
  function calculateCurrentStreak(completedDates) {
    if (!completedDates || completedDates.length === 0) return 0;
    
    // Sort dates descending
    const sorted = [...completedDates].sort((a, b) => new Date(b) - new Date(a));
    
    let streak = 0;
    let checkDate = new Date(actualToday);
    checkDate.setHours(0,0,0,0);
    
    // Check if today is completed
    const todayISO = toISO(checkDate);
    let todayCompleted = sorted.includes(todayISO);
    
    if (!todayCompleted) {
      // If today is not completed, streak might still be active from yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    let currentCheckISO = toISO(checkDate);
    
    while (sorted.includes(currentCheckISO)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      currentCheckISO = toISO(checkDate);
    }
    
    return streak;
  }

  // --- Habit Logic ---
  addHabitForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = habitInput.value.trim();
    if (name) {
      // Safe ID generation in case crypto.randomUUID is not available
      const newId = (window.crypto && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : Date.now().toString(36) + Math.random().toString(36).substring(2);
        
      habits.push({
        id: newId,
        name: name,
        completedDates: []
      });
      habitInput.value = '';
      saveHabits();
    } else {
      // If they just clicked + without typing, focus the input box
      habitInput.focus();
    }
  });

  window.toggleHabitDate = (id, event) => {
    event.stopPropagation();
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    const isoStr = toISO(currentSelectedDate);
    if (habit.completedDates.includes(isoStr)) {
      habit.completedDates = habit.completedDates.filter(d => d !== isoStr);
    } else {
      habit.completedDates.push(isoStr);
      // Play a tiny haptic-like animation on the check
      const icon = event.currentTarget.querySelector('i');
      if (icon) {
        icon.style.transform = 'scale(1.2)';
        setTimeout(() => icon.style.transform = '', 200);
      }
    }
    saveHabits();
  };

  window.deleteHabit = (id, event) => {
    event.stopPropagation();
    if (confirm("Delete this habit?")) {
      habits = habits.filter(h => h.id !== id);
      saveHabits();
    }
  };

  window.openHabitCalendar = (id) => {
    const habit = habits.find(h => h.id === id);
    if(!habit) return;
    
    modalMode = 'habit';
    selectedHabitId = id;
    modalTitle.textContent = habit.name;
    
    // Update Stats
    habitStats.classList.remove('hidden');
    statCurrentStreak.textContent = calculateCurrentStreak(habit.completedDates);
    statTotalDays.textContent = habit.completedDates.length;
    
    calendarViewingDate = new Date(currentSelectedDate);
    renderCalendar();
    modalOverlay.classList.remove('hidden');
  };

  // --- Calendar Global ---
  openGlobalCalendarBtn.addEventListener('click', () => {
    modalMode = 'global';
    selectedHabitId = null;
    modalTitle.textContent = "Select Date";
    habitStats.classList.add('hidden');
    
    calendarViewingDate = new Date(currentSelectedDate);
    renderCalendar();
    modalOverlay.classList.remove('hidden');
  });

  closeModalBtn.addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
  });

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.add('hidden');
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
      modalOverlay.classList.add('hidden');
      renderMainView();
    }
  };

  // --- Rendering ---
  function renderMainView() {
    const isoStr = toISO(currentSelectedDate);
    
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    let dateStr = currentSelectedDate.toLocaleDateString('en-US', options);
    if (isoStr === toISO(actualToday)) {
      dateStr = "Today, " + dateStr;
    } else {
       // Check if yesterday or tomorrow
       const yest = new Date(actualToday); yest.setDate(yest.getDate() - 1);
       const tom = new Date(actualToday); tom.setDate(tom.getDate() + 1);
       if (isoStr === toISO(yest)) dateStr = "Yesterday, " + dateStr;
       if (isoStr === toISO(tom)) dateStr = "Tomorrow, " + dateStr;
    }
    dateDisplay.textContent = dateStr;

    const total = habits.length;
    const completedCount = habits.filter(h => h.completedDates.includes(isoStr)).length;
    const percentage = total === 0 ? 0 : Math.round((completedCount / total) * 100);

    progressPercent.textContent = `${percentage}%`;
    progressBar.style.width = `${percentage}%`;

    if (total === 0) {
      habitList.innerHTML = `
        <div class="empty-state">
          <i data-lucide="sprout" class="empty-icon"></i>
          <p>No habits yet. Start tracking today!</p>
        </div>
      `;
    } else {
      habitList.innerHTML = '';
      habits.forEach((habit, index) => {
        const isCompleted = habit.completedDates.includes(isoStr);
        const streak = calculateCurrentStreak(habit.completedDates);
        
        const habitEl = document.createElement('div');
        habitEl.className = 'habit-item';
        habitEl.style.animationDelay = `${index * 0.05}s`;
        habitEl.onclick = () => openHabitCalendar(habit.id);

        habitEl.innerHTML = `
          <div class="habit-item-left">
            <button class="habit-checkbox ${isCompleted ? 'checked' : ''}" onclick="toggleHabitDate('${habit.id}', event)">
              <i data-lucide="check"></i>
            </button>
            <span class="habit-name ${isCompleted ? 'completed' : ''}">${escapeHtml(habit.name)}</span>
          </div>
          <div class="habit-item-right">
            ${streak > 0 ? `
              <div class="streak-badge">
                <i data-lucide="flame" style="width: 14px; height: 14px;"></i>
                ${streak}
              </div>
            ` : ''}
            <button class="icon-btn sm danger-hover" onclick="deleteHabit('${habit.id}', event)" title="Delete Habit">
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
    const month = calendarViewingDate.getMonth(); 
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    calendarMonthLabel.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
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
  }

  function escapeHtml(unsafe) {
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }
  // Auto-refresh when tab gains focus or user switches back to this tab
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && currentUserId) {
      fetchHabits(currentUserId);
    }
  });
  window.addEventListener("focus", () => {
    if (currentUserId) {
      fetchHabits(currentUserId);
    }
  });
});
