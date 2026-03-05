const STORAGE_KEY = 'wheel_items_v1';
const DEFAULT_ITEMS = ['谢谢参与', '奶茶', '电影票', '红包'];

const labelInput = document.getElementById('labelInput');
const countInput = document.getElementById('countInput');
const addBtn = document.getElementById('addBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const itemList = document.getElementById('itemList');

let items = loadItems();

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

function saveItems() {
  if (items.length < 2) {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  saveBtn.textContent = '已保存';
  setTimeout(() => {
    saveBtn.textContent = '保存到转盘';
  }, 1000);
}

function render() {
  itemList.innerHTML = '';
  const total = items.length;

  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'item';

    const name = document.createElement('span');
    name.textContent = `${index + 1}. ${item}`;

    const prob = document.createElement('span');
    prob.className = 'badge';
    prob.textContent = `几率 ${((1 / total) * 100).toFixed(2)}%`;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      if (items.length <= 2) {
        return;
      }
      items.splice(index, 1);
      render();
    });

    li.append(name, prob, del);
    itemList.appendChild(li);
  });
}

function addItems() {
  const label = labelInput.value.trim();
  const count = Number.parseInt(countInput.value, 10) || 1;
  if (!label) {
    labelInput.focus();
    return;
  }

  const safeCount = Math.min(Math.max(count, 1), 100);
  for (let i = 0; i < safeCount; i += 1) {
    items.push(label);
  }

  labelInput.value = '';
  countInput.value = '1';
  render();
}

function resetDefault() {
  items = [...DEFAULT_ITEMS];
  render();
}

addBtn.addEventListener('click', addItems);
saveBtn.addEventListener('click', saveItems);
resetBtn.addEventListener('click', resetDefault);
labelInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addItems();
  }
});

render();
