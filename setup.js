const STORAGE_KEY = 'wheel_items_v1';
const DEFAULT_ITEMS = ['谢谢参与', '奶茶', '电影票', '红包'];
const CLOUD_TABLE = 'wheel_config';
const CLOUD_ROW_ID = 1;

const labelInput = document.getElementById('labelInput');
const countInput = document.getElementById('countInput');
const addBtn = document.getElementById('addBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const itemList = document.getElementById('itemList');

let items = loadItems();

function normalizeItems(list) {
  if (!Array.isArray(list)) {
    return null;
  }
  const cleaned = list.map((v) => String(v).trim()).filter(Boolean);
  return cleaned.length >= 2 ? cleaned : null;
}

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [...DEFAULT_ITEMS];
    }
    const parsed = JSON.parse(raw);
    return normalizeItems(parsed) ?? [...DEFAULT_ITEMS];
  } catch {
    return [...DEFAULT_ITEMS];
  }
}

async function pullItemsFromCloud() {
  if (!window.supabaseClient) {
    return false;
  }

  try {
    const { data, error } = await window.supabaseClient
      .from(CLOUD_TABLE)
      .select('items')
      .eq('id', CLOUD_ROW_ID)
      .single();

    if (error || !data) {
      return false;
    }

    const cloudItems = normalizeItems(data.items);
    if (!cloudItems) {
      return false;
    }

    items = cloudItems;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

async function saveItems() {
  if (items.length < 2) {
    return;
  }

  saveBtn.disabled = true;

  try {
    if (!window.supabaseClient) {
      throw new Error('Supabase not configured');
    }

    const { error } = await window.supabaseClient
      .from(CLOUD_TABLE)
      .upsert({ id: CLOUD_ROW_ID, items, updated_at: new Date().toISOString() });

    if (error) {
      throw error;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    saveBtn.textContent = '已保存到云端';
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    saveBtn.textContent = '云端失败，已保存到本机';
  }

  setTimeout(() => {
    saveBtn.textContent = '保存到转盘';
    saveBtn.disabled = false;
  }, 1200);
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

(async () => {
  await pullItemsFromCloud();
  render();
})();
