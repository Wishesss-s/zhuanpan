const STORAGE_KEY_BASE = 'wheel_items_v1';
const ACCOUNT_KEY = 'wheel_account_v1';
const DEFAULT_ACCOUNT = '默认账号';
const DEFAULT_ITEMS = ['谢谢参与', '奶茶', '电影票', '红包'];
const CLOUD_TABLE = 'wheel_profiles';

const wheel = document.getElementById('wheel');
const ctx = wheel.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const resultEl = document.getElementById('result');

const wheelSize = wheel.width;
const radius = wheelSize / 2;

let currentAccount = loadCurrentAccount();
let items = loadItemsForAccount(currentAccount);
let currentRotation = 0;
let spinning = false;

function normalizeItems(list) {
  if (!Array.isArray(list)) {
    return null;
  }
  const cleaned = list.map((v) => String(v).trim()).filter(Boolean);
  return cleaned.length >= 2 ? cleaned : null;
}

function normalizeAccountName(value) {
  return String(value ?? '').trim().slice(0, 24);
}

function storageKeyForAccount(accountName) {
  return `${STORAGE_KEY_BASE}__${accountName}`;
}

function loadCurrentAccount() {
  const saved = normalizeAccountName(localStorage.getItem(ACCOUNT_KEY));
  return saved || DEFAULT_ACCOUNT;
}

function loadItemsForAccount(accountName) {
  try {
    const raw = localStorage.getItem(storageKeyForAccount(accountName));
    if (!raw) {
      return [...DEFAULT_ITEMS];
    }
    const parsed = JSON.parse(raw);
    return normalizeItems(parsed) ?? [...DEFAULT_ITEMS];
  } catch {
    return [...DEFAULT_ITEMS];
  }
}

async function pullItemsFromCloud(accountName) {
  if (!window.supabaseClient || spinning) {
    return false;
  }

  try {
    const { data, error } = await window.supabaseClient
      .from(CLOUD_TABLE)
      .select('items')
      .eq('account_name', accountName)
      .single();

    if (error || !data) {
      return false;
    }

    const cloudItems = normalizeItems(data.items);
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

    ctx.strokeStyle = 'rgba(29, 29, 31, 0.32)';
    ctx.lineWidth = 1;
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

function spin() {
  if (spinning || items.length < 2) {
    return;
  }

  spinning = true;
  spinBtn.disabled = true;
  showThinking();

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
    showResult(winnerText);
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
  await pullItemsFromCloud(currentAccount);
  drawWheel();
  clearResult();
})();
