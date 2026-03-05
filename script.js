const STORAGE_KEY = 'wheel_items_v1';
const DEFAULT_ITEMS = ['谢谢参与', '奶茶', '电影票', '红包'];

const wheel = document.getElementById('wheel');
const ctx = wheel.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const resultEl = document.getElementById('result');

const wheelSize = wheel.width;
const radius = wheelSize / 2;

let items = loadItems();
let currentRotation = 0;
let spinning = false;

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [...DEFAULT_ITEMS];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 2) {
      return [...DEFAULT_ITEMS];
    }
    const cleaned = parsed.map((v) => String(v).trim()).filter(Boolean);
    return cleaned.length >= 2 ? cleaned : [...DEFAULT_ITEMS];
  } catch {
    return [...DEFAULT_ITEMS];
  }
}

function refreshItems() {
  items = loadItems();
  drawWheel();
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

function showResult(text) {
  resultEl.textContent = text;
  resultEl.classList.remove('show');
  requestAnimationFrame(() => {
    resultEl.classList.add('show');
  });
}

function clearResult() {
  resultEl.textContent = '';
  resultEl.classList.remove('show');
}

function spin() {
  if (spinning || items.length < 2) {
    return;
  }

  spinning = true;
  spinBtn.disabled = true;
  clearResult();

  const total = items.length;
  const sliceDeg = 360 / total;

  // 每个扇区概率一致
  const winner = Math.floor(Math.random() * total);

  const turns = 8 + Math.floor(Math.random() * 3);
  const settleOffset = (Math.random() - 0.5) * sliceDeg * 0.18;
  const targetDeg = 360 - (winner + 0.5) * sliceDeg + settleOffset;

  currentRotation += turns * 360 + targetDeg;
  wheel.style.transform = `rotate(${currentRotation}deg)`;

  const onDone = () => {
    spinning = false;
    spinBtn.disabled = false;
    showResult(items[winner]);
  };

  wheel.addEventListener('transitionend', onDone, { once: true });
}

window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) {
    refreshItems();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !spinning) {
    refreshItems();
  }
});

spinBtn.addEventListener('click', spin);

drawWheel();
