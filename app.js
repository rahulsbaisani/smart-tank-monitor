/* ============================================================
   SMART TANK MONITORING — APP LOGIC
   Mirrors Python backend: sensor generation, analysis,
   statistics, CSV export, motor control, health checks
   ============================================================ */

'use strict';

// ── CONFIG (mirrors Python CFG) ──────────────────────────────
const CFG = {
  MAX_LEVEL:    90,
  MIN_LEVEL:    20,
  PH_MIN:       6.5,
  PH_MAX:       8.5,
  TURB_MAX:     5,
  TEMP_MAX:     40,
  BATT_LOW:     50,
  INTERVAL_MS:  3000,
  HISTORY_MAX:  40,
};

// ── STATE ────────────────────────────────────────────────────
const state = {
  running:      true,
  motorOn:      false,
  intervalId:   null,
  readings:     0,
  totalAlerts:  0,
  csvRows:      [],
  history: {
    labels:  [],
    levels:  [],
    temps:   [],
    phs:     [],
  },
};

// ── UTILS ────────────────────────────────────────────────────
const rnd = (min, max, dp = 2) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(dp));

const rndInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const avg = arr =>
  arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

function fmtTime(date) {
  return date.toTimeString().slice(0, 8);
}

function fmtNum(n, dp = 2) {
  return Number(n).toFixed(dp);
}

// ── SENSOR DATA GENERATION (mirrors generate_sensor_data) ────
function generateSensorData() {
  return {
    water_level:  rndInt(0, 100),
    ph:           rnd(5.5, 9.5),
    turbidity:    rnd(1, 10),
    temperature:  rnd(20, 45),
    flow_rate:    rnd(10, 50),
    pressure:     rnd(1, 5),
    battery:      rndInt(40, 100),
  };
}

// ── ANALYZE (mirrors analyze_data) ───────────────────────────
function analyzeData(d) {
  const alerts = [];

  if (d.water_level > CFG.MAX_LEVEL) {
    alerts.push({ text: 'Overflow alert — pump stopped',    type: 'danger' });
    state.motorOn = false;
  } else if (d.water_level < CFG.MIN_LEVEL) {
    alerts.push({ text: 'Low water level — pump running',  type: 'warn' });
    state.motorOn = true;
  } else {
    state.motorOn = false;
  }

  if (d.ph < CFG.PH_MIN)  alerts.push({ text: 'Water too acidic (pH ' + d.ph + ')',        type: 'warn' });
  if (d.ph > CFG.PH_MAX)  alerts.push({ text: 'Water too alkaline (pH ' + d.ph + ')',      type: 'warn' });
  if (d.turbidity > CFG.TURB_MAX) alerts.push({ text: 'Dirty water detected (' + d.turbidity + ' NTU)', type: 'danger' });
  if (d.temperature > CFG.TEMP_MAX) alerts.push({ text: 'High temperature (' + d.temperature + '°C)', type: 'warn' });
  if (d.battery < CFG.BATT_LOW) alerts.push({ text: 'Low system battery (' + d.battery + '%)',      type: 'warn' });

  return alerts;
}

// ── SENSOR HEALTH (mirrors sensor_health_check) ──────────────
function sensorHealthCheck() {
  const sensors = ['Ultrasonic', 'pH Sensor', 'Turbidity', 'Temperature'];
  return sensors.map(name => ({
    name,
    ok: Math.random() < 0.88,
  }));
}

// ── CHART SETUP ──────────────────────────────────────────────
let chart = null;

function initChart() {
  const ctx = document.getElementById('histChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: state.history.labels,
      datasets: [{
        label: 'Level %',
        data: state.history.levels,
        borderColor:     '#00e5c3',
        backgroundColor: 'rgba(0,229,195,0.06)',
        borderWidth: 2,
        pointRadius: 2.5,
        pointBackgroundColor: '#00e5c3',
        fill: true,
        tension: 0.45,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#0d1117',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: '#7a8a99',
        bodyColor: '#e8edf2',
        titleFont: { family: 'Space Mono', size: 10 },
        bodyFont:  { family: 'Space Mono', size: 12 },
        callbacks: { label: ctx => ' ' + ctx.parsed.y + '%' },
      }},
      scales: {
        x: { display: false },
        y: {
          min: 0, max: 100,
          grid:   { color: 'rgba(255,255,255,0.04)' },
          border: { color: 'rgba(255,255,255,0.06)' },
          ticks: {
            color: '#445566',
            font: { family: 'Space Mono', size: 9 },
            stepSize: 25,
            callback: v => v + '%',
          },
        },
      },
    },
  });
}

// ── DOM HELPERS ──────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function setClass(element, cls) {
  element.className = element.className.replace(/\b(ok|warn|danger)\b/g, '').trim();
  if (cls) element.classList.add(cls);
}

// Alert icons
const ICONS = {
  ok:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>',
  warn:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  danger: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
};

// ── UPDATE TANK VISUAL ────────────────────────────────────────
function updateTank(level, alerts) {
  const fill    = el('tankFill');
  const pct     = el('tankPct');
  const tag     = el('levelTag');
  const status  = el('tankStatus');

  fill.style.height = Math.min(100, level) + '%';
  pct.textContent   = level + '%';

  const isOverflow = level > CFG.MAX_LEVEL;
  const isLow      = level < CFG.MIN_LEVEL;

  fill.className = 'tank-fill' + (isOverflow ? ' danger' : isLow ? ' warn' : '');

  if (isOverflow) {
    tag.textContent = 'OVERFLOW';
    setClass(tag, 'danger');
    status.textContent = 'Overflow risk';
  } else if (isLow) {
    tag.textContent = 'LOW';
    setClass(tag, 'warn');
    status.textContent = 'Refilling…';
  } else {
    tag.textContent = 'NORMAL';
    setClass(tag, '');
    status.textContent = 'Stable';
  }
}

// ── UPDATE METRIC CARD ────────────────────────────────────────
function updateMetric(id, valueId, barId, statusId, value, pct, statusText, stateClass) {
  const card = el(id);
  setClass(card, stateClass);
  el(valueId).textContent = value;
  el(barId).style.width   = Math.min(100, Math.max(0, pct)) + '%';
  el(statusId).textContent = statusText;
}

// ── UPDATE ALERTS ─────────────────────────────────────────────
function updateAlerts(alerts) {
  const list  = el('alertsList');
  const count = el('alertCount');

  count.textContent = alerts.length;

  if (alerts.length === 0) {
    list.innerHTML = `<div class="alert-ok">${ICONS.ok} All parameters within normal range</div>`;
    return;
  }

  list.innerHTML = alerts.map(a =>
    `<div class="alert-item ${a.type}">${ICONS[a.type] || ''} ${a.text}</div>`
  ).join('');
}

// ── UPDATE OVERALL BADGE ──────────────────────────────────────
function updateBadge(alerts) {
  const badge = el('overallBadge');
  const hasDanger = alerts.some(a => a.type === 'danger');
  const hasWarn   = alerts.some(a => a.type === 'warn');

  if (hasDanger)      { badge.textContent = '⚠ ALERT'; setClass(badge, 'danger'); }
  else if (hasWarn)   { badge.textContent = '! WARNING'; setClass(badge, 'warn'); }
  else                { badge.textContent = 'ALL NORMAL'; setClass(badge, ''); }
}

// ── LOG EVENT ─────────────────────────────────────────────────
function logEvent(msg, type = 'ok') {
  const logList = el('logList');
  const empty   = logList.querySelector('.log-empty');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <span class="log-time">${fmtTime(new Date())}</span>
    <span class="log-msg ${type}">${msg}</span>
  `;
  logList.prepend(entry);

  // keep log trimmed
  const entries = logList.querySelectorAll('.log-entry');
  if (entries.length > 80) entries[entries.length - 1].remove();
}

// ── UPDATE SENSOR HEALTH ──────────────────────────────────────
function updateHealth(health) {
  const grid      = el('healthGrid');
  const healthTag = el('healthTag');
  const allOk     = health.every(h => h.ok);

  healthTag.textContent = allOk ? 'ALL OK' : 'FAULT DETECTED';
  setClass(healthTag, allOk ? '' : 'danger');

  grid.innerHTML = health.map(h => `
    <div class="health-item ${h.ok ? '' : 'error'}">
      <span class="health-name">${h.name}</span>
      <span class="health-dot ${h.ok ? '' : 'error'}" title="${h.ok ? 'OK' : 'Error'}"></span>
    </div>
  `).join('');

  if (!allOk) {
    const faulted = health.filter(h => !h.ok).map(h => h.name).join(', ');
    logEvent('Sensor fault: ' + faulted, 'danger');
  }
}

// ── UPDATE STATS ──────────────────────────────────────────────
function updateStats() {
  const h = state.history;
  if (h.levels.length === 0) return;

  el('avgLevel').textContent  = fmtNum(avg(h.levels), 1) + '%';
  el('maxLevel').textContent  = Math.max(...h.levels) + '%';
  el('minLevel').textContent  = Math.min(...h.levels) + '%';
  el('avgTemp').textContent   = fmtNum(avg(h.temps), 1) + '°C';
  el('avgPH').textContent     = fmtNum(avg(h.phs), 2);
  el('totalAlerts').textContent = state.totalAlerts;
  el('readingsTag').textContent = state.readings + ' readings';
}

// ── CSV EXPORT (mirrors save_to_csv) ─────────────────────────
function saveToCSV(data, alerts) {
  state.csvRows.push([
    new Date().toISOString(),
    data.water_level,
    data.ph,
    data.turbidity,
    data.temperature,
    data.flow_rate,
    data.pressure,
    data.battery,
    alerts.length ? alerts.map(a => a.text).join('; ') : 'Normal',
  ]);
}

function exportCSV() {
  if (state.csvRows.length === 0) return;

  const header = ['Timestamp','Water Level','pH','Turbidity','Temperature','Flow Rate','Pressure','Battery','Alerts'];
  const rows   = [header, ...state.csvRows];
  const csv    = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob   = new Blob([csv], { type: 'text/csv' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = 'smart_tank_data_' + Date.now() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  logEvent('CSV exported — ' + state.csvRows.length + ' rows', 'ok');
}

// ── CLOCK ─────────────────────────────────────────────────────
function updateClock() {
  el('topbarTime').textContent = fmtTime(new Date());
}

setInterval(updateClock, 1000);
updateClock();

// ── MAIN UPDATE LOOP (mirrors the monitoring loop) ────────────
function updateDashboard() {
  const data   = generateSensorData();
  const alerts = analyzeData(data);
  const health = sensorHealthCheck();
  const now    = new Date();

  state.readings++;
  state.totalAlerts += alerts.length;

  // Push history
  const label = fmtTime(now);
  state.history.labels.push(label);
  state.history.levels.push(data.water_level);
  state.history.temps.push(data.temperature);
  state.history.phs.push(data.ph);

  if (state.history.labels.length > CFG.HISTORY_MAX) {
    state.history.labels.shift();
    state.history.levels.shift();
    state.history.temps.shift();
    state.history.phs.shift();
  }

  // ── Tank ──
  updateTank(data.water_level, alerts);

  // ── Flow & Pressure ──
  el('flowVal').textContent  = fmtNum(data.flow_rate, 1) + ' L/min';
  el('pressVal').textContent = fmtNum(data.pressure, 2) + ' Bar';

  // ── Motor ──
  const motorBadge = el('motorBadge');
  motorBadge.textContent = state.motorOn ? 'ON' : 'OFF';
  motorBadge.className   = 'motor-status' + (state.motorOn ? ' on' : '');

  // ── pH ──
  const phOk  = data.ph >= CFG.PH_MIN && data.ph <= CFG.PH_MAX;
  const phPct = ((data.ph - 5.5) / 4) * 100;
  updateMetric('mcPH', 'phVal', 'phBar', 'phStatus',
    fmtNum(data.ph, 2), phPct,
    phOk ? 'Normal' : data.ph < CFG.PH_MIN ? 'Acidic' : 'Alkaline',
    phOk ? 'ok' : 'warn'
  );

  // ── Turbidity ──
  const turbOk  = data.turbidity <= CFG.TURB_MAX;
  const turbPct = (data.turbidity / 10) * 100;
  updateMetric('mcTurb', 'turbVal', 'turbBar', 'turbStatus',
    fmtNum(data.turbidity, 2), turbPct,
    turbOk ? 'Clear' : 'Contaminated',
    turbOk ? 'ok' : 'danger'
  );

  // ── Temperature ──
  const tempOk  = data.temperature <= CFG.TEMP_MAX;
  const tempPct = ((data.temperature - 20) / 25) * 100;
  updateMetric('mcTemp', 'tempVal', 'tempBar', 'tempStatus',
    fmtNum(data.temperature, 1), tempPct,
    tempOk ? 'Normal' : 'Overheated',
    tempOk ? 'ok' : 'warn'
  );

  // ── Battery ──
  const battOk  = data.battery >= CFG.BATT_LOW;
  updateMetric('mcBatt', 'battVal', 'battBar', 'battStatus',
    data.battery, data.battery,
    battOk ? 'Healthy' : 'Low',
    battOk ? 'ok' : 'warn'
  );

  // ── Alerts ──
  updateAlerts(alerts);
  updateBadge(alerts);

  // ── Health ──
  updateHealth(health);

  // ── Chart ──
  if (chart) chart.update('none');

  // ── Stats ──
  updateStats();

  // ── CSV row ──
  saveToCSV(data, alerts);

  // ── Event log ──
  if (alerts.length === 0) {
    if (state.readings % 5 === 1) logEvent('Readings normal — level ' + data.water_level + '%', 'ok');
  } else {
    alerts.forEach(a => logEvent(a.text, a.type));
  }
}

// ── PAUSE / RESUME ────────────────────────────────────────────
function toggleMonitoring() {
  state.running = !state.running;

  const liveDot   = el('liveDot');
  const liveLabel = el('liveLabel');
  const pauseIcon = el('pauseIcon');
  const playIcon  = el('playIcon');

  if (state.running) {
    state.intervalId = setInterval(updateDashboard, CFG.INTERVAL_MS);
    updateDashboard();
    liveDot.classList.remove('paused');
    liveLabel.textContent = 'LIVE MONITORING';
    pauseIcon.style.display = '';
    playIcon.style.display  = 'none';
    logEvent('Monitoring resumed', 'ok');
  } else {
    clearInterval(state.intervalId);
    liveDot.classList.add('paused');
    liveLabel.textContent = 'PAUSED';
    pauseIcon.style.display = 'none';
    playIcon.style.display  = '';
    logEvent('Monitoring paused', 'warn');
  }
}

// ── BOOT ─────────────────────────────────────────────────────
function init() {
  initChart();
  updateDashboard();
  state.intervalId = setInterval(updateDashboard, CFG.INTERVAL_MS);

  el('pauseBtn').addEventListener('click', toggleMonitoring);
  el('csvBtn').addEventListener('click', exportCSV);
  el('clearLog').addEventListener('click', () => {
    el('logList').innerHTML = '<div class="log-empty">Log cleared…</div>';
  });
}

document.addEventListener('DOMContentLoaded', init);
