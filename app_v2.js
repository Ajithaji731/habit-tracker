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

  // Purge any old habit caches from localStorage
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("habits_fallback_") || key.startsWith("habits_") || key.startsWith("leo_cached_"))) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {}

  // --- Background Pre-fetching for Fast Login ---
  let prefetchPromise = null;
  function startPrefetch(pin = "2108") {
    if (!GAS_URL) return;
    prefetchPromise = fetch(`${GAS_URL}?userId=${pin}&t=${Date.now()}`).then(res => res.ok ? res.json() : null)
      .catch(err => { console.warn("Prefetch warning", err); return null; });
  }

  // Init - Always show loading and fetch 100% fresh live data from cloud
  if (currentUserId) {
    showLoading();
    fetchHabits(currentUserId);
  } else {
    startPrefetch("2108");
  }

  // --- Login Logic ---
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = userIdInput.value.trim();
    if (!id) return;

    showLoading();
    
    if (!GAS_URL) {
      completeLogin(id);
      return;
    }

    try {
      let data = null;
      if (id === "2108" && prefetchPromise) {
        data = await prefetchPromise;
      }
      
      if (!data) {
        const response = await fetch(`${GAS_URL}?userId=${id}&t=${Date.now()}`);
        if (!response.ok) throw new Error("Network response was not ok");
        data = await response.json();
      }
      
      if (data && data.error === "Unauthorized") {
        hideLoading();
        loginScreen.classList.remove("hidden");
        loginError.textContent = "Wrong ID. Please try again.";
        loginError.classList.remove("hidden");
        setTimeout(() => loginError.classList.add("hidden"), 3000);
        return;
      }
      
      habits = Array.isArray(data) ? data : [];
      completeLogin(id);
    } catch (err) {
      console.error("Login verification failed:", err);
      hideLoading();
      loginScreen.classList.remove("hidden");
      loginError.textContent = "Connection error. Please check internet and try again.";
      loginError.classList.remove("hidden");
      setTimeout(() => loginError.classList.add("hidden"), 3000);
    }
  });

  function completeLogin(id) {
    currentUserId = id;
    localStorage.setItem("habitUserId", currentUserId);
    localStorage.setItem("habitLoginTime", Date.now().toString());
    loginError.classList.add("hidden");
    
    loginScreen.classList.add("hidden");
    loadingScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    
    renderMainView();
  }

  logoutBtn.addEventListener("click", () => {
    currentUserId = null;
    localStorage.removeItem("habitUserId");
    localStorage.removeItem("habitLoginTime");
    habits = [];
    appScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    userIdInput.value = "";
  });

  // --- API Calls & Pure Cloud Live Sync ---
  let isFetching = false;
  async function fetchHabits(userId, showFeedback = false) {
    if (!GAS_URL) {
      hideLoading();
      renderMainView();
      return;
    }

    if (isFetching) return;
    isFetching = true;

    const syncBtn = document.getElementById("syncBtn");
    if (syncBtn) syncBtn.classList.add("spinning");

    try {
      const response = await fetch(`${GAS_URL}?userId=${userId}&t=${Date.now()}`);
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      
      if (data && data.error === "Unauthorized") {
         document.getElementById("logoutBtn").click();
         return;
      }
      
      if (Array.isArray(data)) {
        habits = data;
        renderMainView();
        if (showFeedback) showToast("Live Sync Complete ✅");
      }
    } catch (err) {
      console.warn("fetchHabits sync error:", err);
      if (showFeedback) showToast("Offline: Could not reach cloud");
    } finally {
      isFetching = false;
      if (syncBtn) syncBtn.classList.remove("spinning");
      hideLoading();
    }
  }

  async function saveHabits() {
    renderMainView(); // Update UI optimistically
    if (!GAS_URL) return;

    try {
      const payload = { userId: currentUserId, habits: habits };
      await fetch(GAS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (err) {
      console.error(err);
      showToast("Sync error saving to cloud");
    }
  }

  // Sync Button in Header
  const syncBtn = document.getElementById("syncBtn");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => {
      if (currentUserId) {
        fetchHabits(currentUserId, true);
      }
    });
  }

  // Auto-sync when switching back to tab/app on phone or computer
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && currentUserId) {
      fetchHabits(currentUserId, false);
    }
  });

  window.addEventListener("focus", () => {
    if (currentUserId) {
      fetchHabits(currentUserId, false);
    }
  });

  window.addEventListener("pageshow", () => {
    if (currentUserId) {
      fetchHabits(currentUserId, false);
    }
  });

  // Periodic background check every 6 seconds when tab is actively open
  setInterval(() => {
    if (currentUserId && document.visibilityState === "visible") {
      fetchHabits(currentUserId, false);
    }
  }, 6000);

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

  // ==========================================
  // --- Habit Analytics Dashboard (0ms) ---
  // ==========================================

  let habitChartInstance = null;
  let currentAnalyticsDays = 30;

  const openAnalyticsBtn = document.getElementById("openAnalyticsBtn");
  const analyticsModalOverlay = document.getElementById("analyticsModalOverlay");
  const closeAnalyticsBtn = document.getElementById("closeAnalyticsBtn");
  const timeframeBtns = document.querySelectorAll(".timeframe-btn");

  function getPastDatesList(daysCount) {
    const dates = [];
    const today = new Date();
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(toISO(d));
    }
    return dates;
  }

  function formatDateLabel(isoStr, totalDays) {
    try {
      const parts = isoStr.split("-");
      if (parts.length === 3) {
        const day = parseInt(parts[2], 10);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = monthNames[parseInt(parts[1], 10) - 1];
        if (totalDays > 180) {
          return month + " '" + parts[0].slice(-2);
        }
        return day + " " + month;
      }
    } catch (e) {}
    return isoStr;
  }

  function renderHabitAnalytics(days = 30) {
    currentAnalyticsDays = days;
    const pastDates = getPastDatesList(days);
    const pastDatesSet = new Set(pastDates);

    // Update Range Badge & Subtitle
    const rangeBadge = document.getElementById("chartRangeBadge");
    if (rangeBadge) rangeBadge.textContent = "Last " + days + " Days";
    const subtitle = document.getElementById("analyticsSubtitle");
    if (subtitle) {
      const fromDate = pastDates[0];
      const toDate = pastDates[pastDates.length - 1];
      subtitle.textContent = fromDate + " to " + toDate + " • " + habits.length + " Habits Tracked";
    }

    // 1. Calculate Daily Totals
    const dailyCompletions = {};
    pastDates.forEach(d => { dailyCompletions[d] = 0; });

    let totalCompletions = 0;
    const habitStats = [];

    habits.forEach(h => {
      const dates = Array.isArray(h.completedDates) ? h.completedDates : [];
      let completedInPeriod = 0;
      dates.forEach(d => {
        if (pastDatesSet.has(d)) {
          completedInPeriod++;
          dailyCompletions[d] = (dailyCompletions[d] || 0) + 1;
          totalCompletions++;
        }
      });

      const rate = Math.round((completedInPeriod / days) * 100);
      const streak = calculateCurrentStreak(dates);
      
      let statusLabel = "Need to Improve 🎯";
      let statusClass = "improve";
      if (rate >= 70) {
        statusLabel = "Crushing It 🔥";
        statusClass = "crushing";
      } else if (rate >= 40) {
        statusLabel = "Consistent ⚡";
        statusClass = "consistent";
      } else {
        statusLabel = "Need to Improve 🎯";
        statusClass = "improve";
      }

      habitStats.push({
        name: h.name,
        completedInPeriod,
        totalDays: days,
        rate,
        streak,
        statusLabel,
        statusClass
      });
    });

    // Sort habits: highest completion rate first
    habitStats.sort((a, b) => b.completedInPeriod - a.completedInPeriod);

    // 2. Update KPI Cards
    const kpiTotalDone = document.getElementById("kpiTotalDone");
    if (kpiTotalDone) kpiTotalDone.textContent = totalCompletions;

    const kpiAvgPerDay = document.getElementById("kpiAvgPerDay");
    if (kpiAvgPerDay) kpiAvgPerDay.textContent = (totalCompletions / days).toFixed(1) + " / day avg";

    const totalPossible = Math.max(1, habits.length) * days;
    const overallConsistency = Math.min(100, Math.round((totalCompletions / totalPossible) * 100));
    const kpiConsistency = document.getElementById("kpiConsistency");
    if (kpiConsistency) kpiConsistency.textContent = overallConsistency + "%";

    const kpiTopHabit = document.getElementById("kpiTopHabit");
    const kpiTopHabitSub = document.getElementById("kpiTopHabitSub");
    if (kpiTopHabit) {
      if (habitStats.length > 0 && habitStats[0].completedInPeriod > 0) {
        kpiTopHabit.textContent = habitStats[0].name;
        if (kpiTopHabitSub) kpiTopHabitSub.textContent = habitStats[0].completedInPeriod + "/" + days + " days (" + habitStats[0].rate + "%)";
      } else {
        kpiTopHabit.textContent = "None yet";
        if (kpiTopHabitSub) kpiTopHabitSub.textContent = "Start tracking today!";
      }
    }

    const kpiFocusHabit = document.getElementById("kpiFocusHabit");
    const kpiFocusHabitSub = document.getElementById("kpiFocusHabitSub");
    if (kpiFocusHabit) {
      const lowest = habitStats.filter(h => h.rate < 50).slice(-1)[0] || habitStats[habitStats.length - 1];
      if (lowest) {
        kpiFocusHabit.textContent = lowest.name;
        if (kpiFocusHabitSub) kpiFocusHabitSub.textContent = lowest.completedInPeriod + "/" + days + " days (" + lowest.rate + "%)";
      } else {
        kpiFocusHabit.textContent = "All on track!";
        if (kpiFocusHabitSub) kpiFocusHabitSub.textContent = "Keep up the momentum! 🎉";
      }
    }

    // 3. Render Trend Line Graph
    renderTrendChart(pastDates, dailyCompletions, days);

    // 4. Render Habit Breakdown List
    renderHabitBreakdownList(habitStats);
  }

  function renderTrendChart(dates, dailyMap, totalDays) {
    const canvas = document.getElementById("habitTrendCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const isMobile = window.innerWidth <= 600;
    let chartLabels = [];
    let chartData = [];
    let tooltipSubtitle = "habits completed";
    let intervalBadgeText = "Last " + totalDays + " Days";

    if (totalDays <= 30) {
      if (isMobile) {
        // Mobile 30 days: 2-day grouped intervals (15 points) for spacious, clean curve
        intervalBadgeText = "Last 30 Days (2-Day)";
        tooltipSubtitle = "habits (2-day total)";
        for (let i = 0; i < dates.length; i += 2) {
          const chunk = dates.slice(i, i + 2);
          const sum = chunk.reduce((acc, d) => acc + (dailyMap[d] || 0), 0);
          chartLabels.push(formatDateLabel(chunk[0], totalDays));
          chartData.push(sum);
        }
      } else {
        intervalBadgeText = "Last 30 Days";
        tooltipSubtitle = "habits completed";
        chartLabels = dates.map(d => formatDateLabel(d, totalDays));
        chartData = dates.map(d => dailyMap[d] || 0);
      }
    } else if (totalDays <= 90) {
      // 90 days: 3-day grouped intervals (30 points)
      intervalBadgeText = "Last 90 Days (3-Day Intervals)";
      tooltipSubtitle = "habits (3-day total)";
      for (let i = 0; i < dates.length; i += 3) {
        const chunk = dates.slice(i, i + 3);
        const sum = chunk.reduce((acc, d) => acc + (dailyMap[d] || 0), 0);
        chartLabels.push(formatDateLabel(chunk[0], totalDays));
        chartData.push(sum);
      }
    } else if (totalDays <= 180) {
      // 180 days: 7-day weekly intervals (~26 points)
      intervalBadgeText = "Last 180 Days (Weekly)";
      tooltipSubtitle = "habits (Weekly total)";
      for (let i = 0; i < dates.length; i += 7) {
        const chunk = dates.slice(i, i + 7);
        const sum = chunk.reduce((acc, d) => acc + (dailyMap[d] || 0), 0);
        chartLabels.push(formatDateLabel(chunk[0], totalDays));
        chartData.push(sum);
      }
    } else {
      // 365 days: 14-day bi-weekly intervals (26 points)
      intervalBadgeText = "Last 365 Days (Bi-Weekly)";
      tooltipSubtitle = "habits (Bi-weekly total)";
      for (let i = 0; i < dates.length; i += 14) {
        const chunk = dates.slice(i, i + 14);
        const sum = chunk.reduce((acc, d) => acc + (dailyMap[d] || 0), 0);
        chartLabels.push(formatDateLabel(chunk[0], totalDays));
        chartData.push(sum);
      }
    }

    const rangeBadge = document.getElementById("chartRangeBadge");
    if (rangeBadge) rangeBadge.textContent = intervalBadgeText;

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, "rgba(168, 85, 247, 0.45)");
    gradient.addColorStop(0.7, "rgba(59, 130, 246, 0.12)");
    gradient.addColorStop(1, "rgba(59, 130, 246, 0.0)");

    if (habitChartInstance) {
      habitChartInstance.destroy();
    }

    if (typeof Chart !== "undefined") {
      habitChartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: chartLabels,
          datasets: [{
            label: "Habits Done",
            data: chartData,
            borderColor: "#a855f7",
            borderWidth: isMobile ? 2.5 : 3,
            backgroundColor: gradient,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#c084fc",
            pointBorderColor: "#ffffff",
            pointBorderWidth: isMobile ? 1.5 : 2,
            pointRadius: isMobile ? 2.5 : 3.5,
            pointHoverRadius: isMobile ? 4.5 : 6,
            pointHoverBackgroundColor: "#38bdf8",
            pointHoverBorderColor: "#ffffff"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(24, 24, 32, 0.95)",
              titleColor: "#fafafa",
              bodyColor: "#c084fc",
              borderColor: "rgba(168, 85, 247, 0.4)",
              borderWidth: 1,
              padding: 8,
              cornerRadius: 8,
              displayColors: false,
              callbacks: {
                label: (context) => "✨ " + context.parsed.y + " " + tooltipSubtitle
              }
            }
          },
          scales: {
            x: {
              grid: {
                color: "rgba(255, 255, 255, 0.04)",
                drawBorder: false
              },
              ticks: {
                color: "#a1a1aa",
                font: { size: isMobile ? 9 : 10, family: "Outfit" },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: isMobile ? 6 : 10
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                color: "rgba(255, 255, 255, 0.06)",
                drawBorder: false
              },
              ticks: {
                color: "#a1a1aa",
                font: { size: isMobile ? 10 : 11, family: "Outfit" },
                stepSize: 1,
                precision: 0
              }
            }
          }
        }
      });
    }
  }

  function renderHabitBreakdownList(habitStats) {
    const container = document.getElementById("habitBreakdownList");
    if (!container) return;

    if (habitStats.length === 0) {
      container.innerHTML = "<div style='text-align: center; padding: 2rem; color: var(--text-muted);'>No habits tracked yet. Start tracking today! ☀️</div>";
      return;
    }

    container.innerHTML = habitStats.map(h => {
      return `
        <div class="habit-row-card">
          <div class="habit-row-top">
            <div class="habit-name-wrap">
              <span class="habit-name">${escapeHtml(h.name)}</span>
              ${h.streak > 0 ? `<span class="habit-streak-pill">${h.streak}d streak 🔥</span>` : ""}
            </div>
            <span class="habit-stat-badge badge-${h.statusClass}">${h.statusLabel}</span>
          </div>
          <div class="habit-progress-bar-bg">
            <div class="habit-progress-bar-fill fill-${h.statusClass}" style="width: ${Math.min(100, Math.max(h.rate, 3))}%;"></div>
          </div>
          <div class="habit-row-footer">
            <span><strong>${h.completedInPeriod}</strong> / ${h.totalDays} days completed</span>
            <span><strong>${h.rate}%</strong> rate</span>
          </div>
        </div>
      `;
    }).join("");
  }

  // Event Listeners for Analytics Modal and Timeframe Filter
  if (openAnalyticsBtn && analyticsModalOverlay) {
    openAnalyticsBtn.addEventListener("click", () => {
      analyticsModalOverlay.classList.remove("hidden");
      renderHabitAnalytics(currentAnalyticsDays);
      if (typeof lucide !== "undefined") lucide.createIcons();
    });
  }

  if (closeAnalyticsBtn && analyticsModalOverlay) {
    closeAnalyticsBtn.addEventListener("click", () => {
      analyticsModalOverlay.classList.add("hidden");
    });
  }

  if (analyticsModalOverlay) {
    analyticsModalOverlay.addEventListener("click", (e) => {
      if (e.target === analyticsModalOverlay) {
        analyticsModalOverlay.classList.add("hidden");
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && analyticsModalOverlay && !analyticsModalOverlay.classList.contains("hidden")) {
      analyticsModalOverlay.classList.add("hidden");
    }
  });

  timeframeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      timeframeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const days = parseInt(btn.dataset.days, 10) || 30;
      renderHabitAnalytics(days);
    });
  });

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
