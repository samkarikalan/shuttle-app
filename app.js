/* ===== SHUTTLE APP — app.js ===== */

'use strict';

/* ── State ── */
const STATE = {
  slots:     JSON.parse(localStorage.getItem('shuttle_slots')  || '[]'),
  checklist: JSON.parse(localStorage.getItem('shuttle_checks') || '[]'),
  activePage: 'home',
};

function saveSlots()  { localStorage.setItem('shuttle_slots',  JSON.stringify(STATE.slots));     }
function saveChecks() { localStorage.setItem('shuttle_checks', JSON.stringify(STATE.checklist)); }

/* ── Your 4 halls ── */
const HALLS = [
  { name: '臨海町コミュニティ会館',  romaji: 'Rinkaichou',  query: '臨海町' },
  { name: '北葛西コミュニティ会館',  romaji: 'Kitakasai',   query: '北葛西' },
  { name: '西葛西コミュニティ会館',  romaji: 'Nishikasai',  query: '西葛西' },
  { name: '長島コミュニティ会館',    romaji: 'Nagashima',   query: '長島'   },
];

/* ── Credentials (stored locally only) ── */
function saveCreds(id, pw) {
  localStorage.setItem('shuttle_uid', id);
  localStorage.setItem('shuttle_upw', pw);
}

function loadCreds() {
  return {
    id: localStorage.getItem('shuttle_uid') || '',
    pw: localStorage.getItem('shuttle_upw') || '',
  };
}

function clearCreds() {
  localStorage.removeItem('shuttle_uid');
  localStorage.removeItem('shuttle_upw');
}

function hasCreds() {
  const { id, pw } = loadCreds();
  return id.length > 0 && pw.length > 0;
}

/* ── Login screen ── */
function initLogin() {
  const { id, pw } = loadCreds();
  if (id) document.getElementById('loginId').value = id;
  if (pw) document.getElementById('loginPw').value = pw;

  // If creds already saved, skip login screen — just show app
  if (hasCreds()) {
    hideLogin();
  }
}

function showLogin() {
  const { id, pw } = loadCreds();
  document.getElementById('loginId').value = id;
  document.getElementById('loginPw').value = pw;
  document.getElementById('loginScreen').classList.remove('hidden');
}

function hideLogin() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('headerLoginBtn').style.display = 'block';
}

function doLogin() {
  const id = document.getElementById('loginId').value.trim();
  const pw = document.getElementById('loginPw').value;
  const remember = document.getElementById('rememberMe').checked;

  if (!id || !pw) {
    showToast('Please enter your ID and password');
    return;
  }

  if (remember) {
    saveCreds(id, pw);
  } else {
    clearCreds();
  }

  hideLogin();

  // Build えどねっと URL with pre-filled credentials via query params (auto-submit via JS)
  // Opens the site — user sees it pre-filled
  const baseUrl = 'https://www.shisetsuyoyaku.city.edogawa.tokyo.jp/user/Home';
  const win = window.open(baseUrl, '_blank');

  // After a short delay, inject credentials into the opened page
  // (works only if same origin — otherwise user sees fields pre-filled from their saved creds)
  showToast('Opening えどねっと…');
}

function launchEdonet() {
  if (!hasCreds()) {
    showLogin();
    return;
  }
  const baseUrl = 'https://www.shisetsuyoyaku.city.edogawa.tokyo.jp/user/Home';
  window.open(baseUrl, '_blank');
  showToast('Opening えどねっと…');
}


/* ── Lottery schedule helpers ── */
function now()         { return new Date(); }
function pad(n)        { return String(n).padStart(2, '0'); }

function getLotteryWindow() {
  const d = now();
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const hour = d.getHours();

  const openDate    = new Date(y, m, 1,  9,  0, 0);
  const closeDate   = new Date(y, m, 10, 22,  0, 0);

  if (d < closeDate) {
    return { open: openDate, close: closeDate, month: m, year: y };
  } else {
    const nm = m + 1 > 11 ? 0 : m + 1;
    const ny = m + 1 > 11 ? y + 1 : y;
    return {
      open:  new Date(ny, nm, 1,  9, 0, 0),
      close: new Date(ny, nm, 10, 22, 0, 0),
      month: nm,
      year: ny
    };
  }
}

function isWindowOpen() {
  const d = now();
  const { open, close } = getLotteryWindow();
  return d >= open && d <= close;
}

function getVacancyDates() {
  const { year, month } = getLotteryWindow();
  // After lottery closes we show same month vacancy, else current upcoming
  return {
    central: new Date(year, month, 25, 12, 0, 0),
    outer:   new Date(year, month, 26, 12, 0, 0),
  };
}

function getCountdownTarget() {
  if (isWindowOpen()) return getLotteryWindow().close;
  return getLotteryWindow().open;
}

/* ── Countdown ── */
function updateCountdown() {
  const target = getCountdownTarget();
  const diff   = target - now();
  if (diff <= 0) { updateCountdown(); return; }

  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins  = Math.floor((diff % 3600000)  / 60000);
  const secs  = Math.floor((diff % 60000)    / 1000);

  document.getElementById('cdDays').textContent  = pad(days);
  document.getElementById('cdHours').textContent = pad(hours);
  document.getElementById('cdMins').textContent  = pad(mins);
  document.getElementById('cdSecs').textContent  = pad(secs);

  const lbl = isWindowOpen()
    ? `Until deadline — apply now!`
    : `Until lottery opens`;
  document.getElementById('cdLabel').textContent = lbl;
}

/* ── Status pill ── */
function updateStatus() {
  const pill = document.getElementById('statusPill');
  const dot  = document.getElementById('statusDot');
  const txt  = document.getElementById('statusText');
  const d = now().getDate();

  if (isWindowOpen()) {
    const daysLeft = Math.ceil((getLotteryWindow().close - now()) / 86400000);
    txt.textContent = `Lottery OPEN · ${daysLeft}d left`;
    dot.className = 'status-dot';
  } else if (d > 10 && d < 25) {
    txt.textContent = 'Awaiting results — check Messages';
    dot.className = 'status-dot orange';
  } else if (d >= 25) {
    txt.textContent = 'Vacancy slots now open!';
    dot.className = 'status-dot orange';
  } else {
    txt.textContent = 'Lottery window closed';
    dot.className = 'status-dot red';
  }
}

/* ── Calendar ── */
function buildCalendar() {
  const DAYS = ['S','M','T','W','T','F','S'];
  const container = document.getElementById('calContainer');
  const { year, month } = getLotteryWindow();
  const today = now();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  let html = DAYS.map(d => `<div class="cal-dow">${d}</div>`).join('');

  // Empty leading cells
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-cell dim"></div>`;
  }

  for (let d = 1; d <= totalDays; d++) {
    let cls = 'cal-cell';
    const isToday = (today.getFullYear() === year && today.getMonth() === month && today.getDate() === d);

    if (isToday)          cls += ' today';
    else if (d === 1)     cls += ' open';
    else if (d === 10)    cls += ' deadline';
    else if (d === 25 || d === 26) cls += ' vacancy';
    else if (d >= 2 && d <= 9)    cls += ' in-window';

    html += `<div class="${cls}">${d}</div>`;
  }

  container.innerHTML = html;
}

/* ── Checklist ── */
const STEPS = [
  {
    title: 'Confirm registration is valid',
    desc: 'Log in and check your account expiry. Registrations expiring March 2026 must renew from Jan 5.',
    link: { href: 'https://www.shisetsuyoyaku.city.edogawa.tokyo.jp/user/Home', text: 'Open えどねっと →' }
  },
  {
    title: 'Log in during the 1st–10th window',
    desc: 'Sports lottery: 1st 9 AM → 10th 10 PM. You must apply within this window each month.',
  },
  {
    title: 'Search バドミントン by purpose',
    desc: '空き照会・申込 → 利用目的 → 屋内スポーツ → バドミントン. Select multiple districts for more options.',
  },
  {
    title: 'Apply across all 5 districts',
    desc: '中央・小松川・葛西・小岩・東部. Weekday mornings have the lowest competition.',
  },
  {
    title: 'Check メッセージ after results',
    desc: 'After the 10th: 予約完了 = booked ✓. No action needed — auto approved. 予約取消 = cancelled.',
  },
  {
    title: 'Watch vacancy on 25th/26th at noon',
    desc: 'Central/Komatsu/Kasai → 25th noon. Koiwa/Tobu/Shikahone → 26th noon. Be ready!',
  },
];

function renderChecklist() {
  const container = document.getElementById('checklistContainer');
  container.innerHTML = STEPS.map((s, i) => {
    const done = STATE.checklist.includes(i);
    return `
      <div class="step-item ${done ? 'done' : ''}" id="step-${i}">
        <div class="step-num">${done ? '✓' : i + 1}</div>
        <div class="step-body">
          <div class="step-title">${s.title}</div>
          <div class="step-desc">${s.desc}</div>
          ${s.link ? `<div class="step-link"><a href="${s.link.href}" target="_blank">${s.link.text}</a></div>` : ''}
        </div>
        <button class="check-btn ${done ? 'done' : ''}" onclick="toggleStep(${i})">${done ? '✓' : ''}</button>
      </div>
    `;
  }).join('');

  updateProgress();
}

function toggleStep(i) {
  if (STATE.checklist.includes(i)) {
    STATE.checklist = STATE.checklist.filter(x => x !== i);
  } else {
    STATE.checklist.push(i);
  }
  saveChecks();
  renderChecklist();
}

function updateProgress() {
  const done = STATE.checklist.length;
  const total = STEPS.length;
  document.getElementById('progressText').textContent = `${done} of ${total} complete`;
  document.getElementById('progressFill').style.width = `${(done / total) * 100}%`;
}

/* ── Slot Tracker ── */

function addSlot() {
  const fac  = document.getElementById('slotFacility').value;
  const date = document.getElementById('slotDate').value;
  if (!fac || !date) { showToast('Select a hall and date'); return; }

  STATE.slots.unshift({ id: Date.now(), facility: fac, date, status: 'pending' });
  saveSlots();
  renderSlots();
  renderStats();
  document.getElementById('slotFacility').value = '';
  document.getElementById('slotDate').value = '';
  showToast('Application logged ✓');
}

function updateSlotStatus(id, status) {
  const s = STATE.slots.find(s => s.id === id);
  if (s) { s.status = status; saveSlots(); renderSlots(); renderStats(); }
}

function deleteSlot(id) {
  STATE.slots = STATE.slots.filter(s => s.id !== id);
  saveSlots();
  renderSlots();
  renderStats();
}

function renderSlots() {
  const container = document.getElementById('slotList');
  if (STATE.slots.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📋</div>
        No applications tracked yet.<br>Add your first entry above.
      </div>`;
    return;
  }

  container.innerHTML = STATE.slots.map(s => {
    const dt = new Date(s.date);
    const dateStr = dt.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
    const timeStr = dt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const badgeCls = s.status === 'won' ? 'badge-won' : s.status === 'lost' ? 'badge-lost' : 'badge-pending';
    const badgeTxt = s.status === 'won' ? '✓ Won' : s.status === 'lost' ? '✗ Lost' : '⏳ Pending';

    const actionBtns = s.status === 'pending' ? `
      <button class="btn-status btn-won"  onclick="updateSlotStatus(${s.id}, 'won')">Won</button>
      <button class="btn-status btn-lost" onclick="updateSlotStatus(${s.id}, 'lost')">Lost</button>
    ` : '';

    return `
      <div class="slot-item">
        <div class="slot-facility">${s.facility}</div>
        <div class="slot-date">${dateStr} ${timeStr}</div>
        <div class="slot-actions">
          <span class="badge ${badgeCls}">${badgeTxt}</span>
          ${actionBtns}
        </div>
        <button class="btn-del" onclick="deleteSlot(${s.id})">✕</button>
      </div>
    `;
  }).join('');
}

function renderStats() {
  const total   = STATE.slots.length;
  const won     = STATE.slots.filter(s => s.status === 'won').length;
  const pending = STATE.slots.filter(s => s.status === 'pending').length;

  document.getElementById('statTotal').textContent   = total;
  document.getElementById('statWon').textContent     = won;
  document.getElementById('statPending').textContent = pending;
}

/* ── Live Slots (from GitHub Pages static JSON) ── */
const REPO_OWNER = 'samkarikalan';
const REPO_NAME  = 'shuttle-app';
const DATA_URL   = `https://${REPO_OWNER}.github.io/${REPO_NAME}/slots_data.json`;

async function fetchLiveSlots() {
  const container = document.getElementById('liveSlots');
  const lastEl    = document.getElementById('lastScraped');
  try {
    const res  = await fetch(DATA_URL + '?t=' + Date.now(), { signal: AbortSignal.timeout(8000) });
    const data = await res.json();

    if (data.status === 'pending' || !data.scraped_at) {
      container.innerHTML = `<div class="empty"><div class="empty-icon">⏳</div>First scrape not run yet.<br>Go to GitHub Actions and run the workflow manually.</div>`;
      return;
    }

    if (data.slots.length === 0) {
      container.innerHTML = `<div class="empty"><div class="empty-icon">😔</div>No available slots right now for your 4 halls.<br><span style="font-size:11px">Checked: ${data.scraped_at_jst}</span></div>`;
    } else {
      container.innerHTML = data.slots.map(s => `
        <div class="slot-item">
          <div class="slot-facility">${s.hall}</div>
          <div class="slot-date">${s.info}</div>
          <div class="slot-actions">
            <span class="badge badge-won">○ Available</span>
          </div>
        </div>
      `).join('');
    }

    if (data.scraped_at_jst) {
      lastEl.textContent = `Updated: ${data.scraped_at_jst}`;
    }

  } catch (e) {
    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📡</div>
        Could not load slot data.<br>
        <span style="font-size:11px;color:var(--muted)">Check internet or GitHub Pages is enabled.</span>
      </div>`;
  }
}

async function refreshSlots() {
  const btn = document.getElementById('refreshBtn');
  btn.textContent = '…';
  btn.disabled = true;
  await fetchLiveSlots();
  showToast('Data refreshed ✓');
  btn.textContent = '↻ Refresh';
  btn.disabled = false;
}


function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

/* ── Tab navigation ── */
function switchPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.getElementById('tab-' + id).classList.add('active');
  STATE.activePage = id;
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  buildCalendar();
  updateStatus();
  updateCountdown();
  setInterval(updateCountdown, 1000);
  setInterval(updateStatus, 30000);
  renderChecklist();
  renderSlots();
  renderStats();
  switchPage('home');
  fetchLiveSlots();
  setInterval(fetchLiveSlots, 60000); // refresh display every minute
});
