const STORAGE_KEY_BASE = 'wheel_items_v1';
const ACCOUNT_KEY = 'wheel_account_v1';
const DEFAULT_ACCOUNT = '默认转盘';
const LEGACY_DEFAULT_ACCOUNT = '默认账号';
const DEFAULT_ITEMS = ['谢谢参与', '奶茶', '电影票', '红包'];
const CLOUD_TABLE = 'wheel_profiles';

const wheel = document.getElementById('wheel');
const ctx = wheel.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const resultEl = document.getElementById('result');
const accountBadge = document.getElementById('accountBadge');

const wheelSize = wheel.width;
const radius = wheelSize / 2;

let currentAccount = loadCurrentAccount();
let items = loadItemsForAccount(currentAccount);
let currentRotation = 0;
let spinning = false;
let highlightedWinner = -1;
let highlightTimer = null;
let audioContext = null;

function normalizeItems(list) {
  if (!Array.isArray(list)) {
    return null;
  }
  const cleaned = list.map((v) => String(v).trim()).filter(Boolean);
  return cleaned.length >= 2 ? cleaned : null;
}

function normalizeAccountName(value) {
  const cleaned = String(value ?? '').trim().slice(0, 24);
  if (cleaned === LEGACY_DEFAULT_ACCOUNT) {
    return DEFAULT_ACCOUNT;
  }
  return cleaned;
}

function storageKeyForAccount(accountName) {
  return `${STORAGE_KEY_BASE}__${accountName}`;
}

function loadCurrentAccount() {
  const savedRaw = String(localStorage.getItem(ACCOUNT_KEY) ?? '').trim();
  const saved = normalizeAccountName(savedRaw);
  if (saved) {
    if (savedRaw !== saved) {
      localStorage.setItem(ACCOUNT_KEY, saved);
    }
    return saved;
  }
  localStorage.setItem(ACCOUNT_KEY, DEFAULT_ACCOUNT);
  return DEFAULT_ACCOUNT;
}

function loadItemsForAccount(accountName) {
  try {
    const key = storageKeyForAccount(accountName);
    let raw = localStorage.getItem(key);
    if (!raw && accountName === DEFAULT_ACCOUNT) {
      raw = localStorage.getItem(storageKeyForAccount(LEGACY_DEFAULT_ACCOUNT));
    }
    if (!raw) {
      return [...DEFAULT_ITEMS];
    }
    const parsed = JSON.parse(raw);
    return normalizeItems(parsed) ?? [...DEFAULT_ITEMS];
  } catch {
    return [...DEFAULT_ITEMS];
  }
}

function updateAccountBadge() {
  accountBadge.textContent = `转盘：${currentAccount}`;
}

function safeVibrate(pattern) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
}

function getAudioContext() {
  if (audioContext) {
    return audioContext;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) {
    return null;
  }
  audioContext = new Ctor();
  return audioContext;
}

function playTone(frequency, durationMs, gainValue) {
  const ac = getAudioContext();
  if (!ac) {
    return;
  }

  if (ac.state === 'suspended') {
    ac.resume().catch(() => {});
  }

  const now = ac.currentTime;
  const duration = durationMs / 1000;
  const oscillator = ac.createOscillator();
  const gainNode = ac.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, now);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ac.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playStartFeedback() {
  safeVibrate(16);
  playTone(560, 70, 0.018);
}

function playResultFeedback() {
  safeVibrate([22, 28, 20]);
  playTone(740, 80, 0.02);
  setTimeout(() => {
    playTone(980, 90, 0.016);
  }, 85);
}

async function fetchCloudItemsByName(accountName) {
  const { data, error } = await window.supabaseClient
    .from(CLOUD_TABLE)
    .select('items')
    .eq('account_name', accountName)
    .single();
  if (error || !data) {
    return null;
  }
  const cloudItems = normalizeItems(data.items);
  return cloudItems || null;
}

async function pullItemsFromCloud(accountName) {
  if (!window.supabaseClient || spinning) {
    return false;
  }

  try {
    let cloudItems = await fetchCloudItemsByName(accountName);
    if (!cloudItems && accountName === DEFAULT_ACCOUNT) {
      cloudItems = await fetchCloudItemsByName(LEGACY_DEFAULT_ACCOUNT);
    }
    if (!cloudItems) {
      return false;
    }

    const changed = JSON.stringify(cloudItems) !== JSON.stringify(items);
    if (changed) {
      items = cloudItems;
      localStorage.setItem(storageKeyForAccount(accountName), JSON.stringify(items));
    }

    return changed;
  } catch {
    return false;
  }
}

function refreshLocalItems() {
  if (spinning) {
    return;
  }

  const latestAccount = loadCurrentAccount();
  if (latestAccount !== currentAccount) {
    currentAccount = latestAccount;
    updateAccountBadge();
  }

  items = loadItemsForAccount(currentAccount);
  drawWheel();
}

async function refreshItems() {
  if (spinning) {
    return;
  }

  refreshLocalItems();
  const changed = await pullItemsFromCloud(currentAccount);
  if (changed) {
    drawWheel();
  }
}

function sliceColor(i) {
  if (i === highlightedWinner) {
    return '#ffe9b3';
  }
  return i % 2 === 0 ? '#fbfbfc' : '#f3f3f6';
}

function drawWheel() {
  const total = items.length;
  const arc = (Math.PI * 2) / total;

  ctx.clearRect(0, 0, wheelSize, wheelSize);
  ctx.save();
  ctx.translate(radius, radius);

  for (let i = 0; i < total; i += 1) {
    const start = -Math.PI / 2 + i * arc;
    const end = start + arc;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius - 2, start, end);
    ctx.closePath();
    ctx.fillStyle = sliceColor(i);
    ctx.fill();

    ctx.strokeStyle = i === highlightedWinner ? 'rgba(255, 157, 0, 0.85)' : 'rgba(29, 29, 31, 0.32)';
    ctx.lineWidth = i === highlightedWinner ? 2.4 : 1;
    ctx.stroke();

    const textAngle = start + arc / 2;
    ctx.save();
    ctx.rotate(textAngle);
    ctx.translate(radius * 0.65, 0);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#222226';

    const fontSize = Math.max(14, Math.min(24, 90 / total + 12));
    ctx.font = `700 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const label = items[i];
    const maxChars = total > 14 ? 3 : total > 8 ? 4 : 6;
    const shown = label.length > maxChars ? `${label.slice(0, maxChars)}…` : label;
    ctx.fillText(shown, 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

function showThinking() {
  resultEl.textContent = '思考吃什么中...';
  resultEl.classList.remove('pop-in');
  resultEl.classList.add('thinking', 'show');
}

function showResult(text) {
  resultEl.textContent = text;
  resultEl.classList.remove('thinking', 'pop-in', 'show');
  requestAnimationFrame(() => {
    resultEl.classList.add('show', 'pop-in');
  });
}

function clearResult() {
  resultEl.textContent = '';
  resultEl.classList.remove('thinking', 'pop-in', 'show');
}

function clearHighlight() {
  if (highlightTimer) {
    clearTimeout(highlightTimer);
    highlightTimer = null;
  }
  highlightedWinner = -1;
}

function spin() {
  if (spinning || items.length < 2) {
    return;
  }

  clearHighlight();
  drawWheel();

  spinning = true;
  spinBtn.disabled = true;
  showThinking();
  playStartFeedback();

  const total = items.length;
  const sliceDeg = 360 / total;
  const winner = Math.floor(Math.random() * total);
  const winnerText = items[winner];

  const turns = 8 + Math.floor(Math.random() * 3);
  const settleOffset = (Math.random() - 0.5) * sliceDeg * 0.18;
  const targetDeg = 360 - (winner + 0.5) * sliceDeg + settleOffset;

  const baseRotation = ((currentRotation % 360) + 360) % 360;
  const alignDelta = (targetDeg - baseRotation + 360) % 360;

  currentRotation += turns * 360 + alignDelta;
  wheel.style.transform = `rotate(${currentRotation}deg)`;

  const onDone = () => {
    spinning = false;
    spinBtn.disabled = false;

    highlightedWinner = winner;
    drawWheel();
    showResult(winnerText);
    playResultFeedback();

    highlightTimer = setTimeout(() => {
      highlightedWinner = -1;
      drawWheel();
      highlightTimer = null;
    }, 1300);
  };

  wheel.addEventListener('transitionend', onDone, { once: true });
}

window.addEventListener('storage', (e) => {
  if (!e.key) {
    return;
  }
  if (e.key === ACCOUNT_KEY || e.key.startsWith(`${STORAGE_KEY_BASE}__`)) {
    refreshLocalItems();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !spinning) {
    refreshItems();
  }
});

spinBtn.addEventListener('click', spin);

(async () => {
  updateAccountBadge();
  await pullItemsFromCloud(currentAccount);
  drawWheel();
  clearResult();
})();
