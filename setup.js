const STORAGE_KEY_BASE = 'wheel_items_v1';
const ACCOUNT_KEY = 'wheel_account_v1';
const ACCOUNT_LIST_KEY = 'wheel_accounts_v1';
const DEFAULT_ACCOUNT = '默认转盘';
const LEGACY_DEFAULT_ACCOUNT = '默认账号';
const DEFAULT_ITEMS = ['谢谢参与', '奶茶', '电影票', '红包'];
const CLOUD_TABLE = 'wheel_profiles';

const labelInput = document.getElementById('labelInput');
const countInput = document.getElementById('countInput');
const addBtn = document.getElementById('addBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const itemList = document.getElementById('itemList');
const accountOpenBtn = document.getElementById('accountOpenBtn');
const accountModal = document.getElementById('accountModal');
const accountBackdrop = document.getElementById('accountBackdrop');
const accountCloseBtn = document.getElementById('accountCloseBtn');
const accountPicker = document.getElementById('accountPicker');
const accountPickerBtn = document.getElementById('accountPickerBtn');
const accountPickerLabel = document.getElementById('accountPickerLabel');
const accountPickerList = document.getElementById('accountPickerList');
const switchAccountBtn = document.getElementById('switchAccountBtn');
const newAccountInput = document.getElementById('newAccountInput');
const registerAccountBtn = document.getElementById('registerAccountBtn');
const accountInfo = document.getElementById('accountInfo');

let accounts = loadAccountList();
let currentAccount = loadCurrentAccount();
let pendingAccount = currentAccount;
let items = loadItemsForAccount(currentAccount);
const initialSavedAccount = normalizeAccountName(localStorage.getItem(ACCOUNT_KEY));
let shouldAutoPickInitialWheel = !initialSavedAccount;

let dragFromIndex = null;
let touchDragIndex = null;
let touchTargetIndex = null;

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

function loadAccountList() {
  try {
    const raw = localStorage.getItem(ACCOUNT_LIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const mapped = Array.isArray(parsed)
      ? parsed.map((name) => normalizeAccountName(name)).filter(Boolean)
      : [];
    const cleaned = [...new Set(mapped)];
    if (!cleaned.includes(DEFAULT_ACCOUNT)) {
      cleaned.unshift(DEFAULT_ACCOUNT);
    }
    return cleaned;
  } catch {
    return [DEFAULT_ACCOUNT];
  }
}

function persistAccountList() {
  localStorage.setItem(ACCOUNT_LIST_KEY, JSON.stringify(accounts));
}

function loadCurrentAccount() {
  const savedRaw = String(localStorage.getItem(ACCOUNT_KEY) ?? '').trim();
  const saved = normalizeAccountName(savedRaw);
  if (saved && accounts.includes(saved)) {
    if (savedRaw !== saved) {
      localStorage.setItem(ACCOUNT_KEY, saved);
    }
    return saved;
  }
  localStorage.setItem(ACCOUNT_KEY, accounts[0]);
  return accounts[0];
}

function setCurrentAccount(name) {
  currentAccount = name;
  localStorage.setItem(ACCOUNT_KEY, currentAccount);
  accountInfo.textContent = `当前转盘：${currentAccount}`;
}

function loadItemsForAccount(accountName) {
  try {
    let raw = localStorage.getItem(storageKeyForAccount(accountName));
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

function persistItemsForAccount(accountName, accountItems) {
  localStorage.setItem(storageKeyForAccount(accountName), JSON.stringify(accountItems));
}

async function openAccountModal() {
  await syncAccountsFromCloud();
  renderAccountState();
  accountModal.classList.add('show');
  accountModal.setAttribute('aria-hidden', 'false');
}

function closeAccountModal() {
  closePicker();
  accountModal.classList.remove('show');
  accountModal.setAttribute('aria-hidden', 'true');
}

function openPicker() {
  accountPickerList.hidden = false;
  accountPickerBtn.setAttribute('aria-expanded', 'true');
}

function closePicker() {
  accountPickerList.hidden = true;
  accountPickerBtn.setAttribute('aria-expanded', 'false');
}

function togglePicker() {
  if (accountPickerList.hidden) {
    openPicker();
  } else {
    closePicker();
  }
}

function setPendingAccount(name) {
  pendingAccount = name;
  accountPickerLabel.textContent = pendingAccount;
  const buttons = accountPickerList.querySelectorAll('.picker-item');
  buttons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.account === pendingAccount);
  });
}

function renderAccountPicker() {
  accountPickerList.innerHTML = '';
  accounts.forEach((name) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-item';
    btn.dataset.account = name;
    btn.textContent = name;
    btn.addEventListener('click', () => {
      setPendingAccount(name);
      closePicker();
    });
    li.appendChild(btn);
    accountPickerList.appendChild(li);
  });
  setPendingAccount(pendingAccount);
}

async function syncAccountsFromCloud() {
  if (!window.supabaseClient) {
    return false;
  }

  try {
    const { data, error } = await window.supabaseClient
      .from(CLOUD_TABLE)
      .select('account_name, updated_at')
      .order('updated_at', { ascending: false });

    if (error || !Array.isArray(data)) {
      return false;
    }

    const cloudNames = [
      ...new Set(data.map((row) => normalizeAccountName(row.account_name)).filter(Boolean)),
    ];

    const merged = [DEFAULT_ACCOUNT];
    cloudNames.forEach((name) => {
      if (name !== DEFAULT_ACCOUNT && !merged.includes(name)) {
        merged.push(name);
      }
    });
    accounts.forEach((name) => {
      if (name !== DEFAULT_ACCOUNT && !merged.includes(name)) {
        merged.push(name);
      }
    });

    accounts = merged;
    persistAccountList();

    if (!accounts.includes(currentAccount)) {
      setCurrentAccount(DEFAULT_ACCOUNT);
    }

    if (shouldAutoPickInitialWheel) {
      const firstCloudAccount = accounts.find((name) => name !== DEFAULT_ACCOUNT);
      if (firstCloudAccount) {
        setCurrentAccount(firstCloudAccount);
      }
      shouldAutoPickInitialWheel = false;
    }

    pendingAccount = currentAccount;
    return true;
  } catch {
    return false;
  }
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
  if (!window.supabaseClient) {
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

    items = cloudItems;
    persistItemsForAccount(accountName, items);
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

    const payload = {
      account_name: currentAccount,
      items,
      updated_at: new Date().toISOString(),
    };

    const { error } = await window.supabaseClient
      .from(CLOUD_TABLE)
      .upsert(payload, { onConflict: 'account_name' });

    if (error) {
      throw error;
    }

    persistItemsForAccount(currentAccount, items);
    saveBtn.textContent = '已保存到云端';
  } catch {
    persistItemsForAccount(currentAccount, items);
    saveBtn.textContent = '云端失败，已保存到本机';
  }

  setTimeout(() => {
    saveBtn.textContent = '保存到转盘';
    saveBtn.disabled = false;
  }, 1200);
}

function renderAccountState() {
  accountInfo.textContent = `当前转盘：${currentAccount}`;
  pendingAccount = currentAccount;
  renderAccountPicker();
}

async function switchAccount() {
  const next = normalizeAccountName(pendingAccount);
  if (!next || next === currentAccount) {
    closeAccountModal();
    return;
  }

  setCurrentAccount(next);
  items = loadItemsForAccount(currentAccount);
  render();
  await pullItemsFromCloud(currentAccount);
  render();
  renderAccountState();
  closeAccountModal();
}

async function registerAccount() {
  const name = normalizeAccountName(newAccountInput.value);
  if (!name) {
    newAccountInput.focus();
    return;
  }

  if (!accounts.includes(name)) {
    accounts.push(name);
    persistAccountList();
  }

  setCurrentAccount(name);
  renderAccountState();

  const localItems = loadItemsForAccount(name);
  items = localItems;
  render();

  let hasCloudData = false;
  try {
    if (window.supabaseClient) {
      let cloudItems = await fetchCloudItemsByName(name);
      if (!cloudItems && name === DEFAULT_ACCOUNT) {
        cloudItems = await fetchCloudItemsByName(LEGACY_DEFAULT_ACCOUNT);
      }
      if (cloudItems) {
        hasCloudData = true;
        items = cloudItems;
        persistItemsForAccount(name, items);
      }
    }
  } catch {
    hasCloudData = false;
  }

  if (!hasCloudData) {
    items = localItems;
    persistItemsForAccount(name, items);
    if (window.supabaseClient) {
      await window.supabaseClient.from(CLOUD_TABLE).upsert(
        {
          account_name: name,
          items,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_name' }
      );
    }
  }

  render();
  newAccountInput.value = '';
  closeAccountModal();
}

function clearDragState() {
  itemList.querySelectorAll('.dragging, .drag-over, .touch-over').forEach((el) => {
    el.classList.remove('dragging', 'drag-over', 'touch-over');
  });
}

function moveItem(fromIndex, toIndex) {
  if (fromIndex === null || toIndex === null || fromIndex === toIndex) {
    return;
  }
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return;
  }
  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
}

function bindDragEvents(li, index, handle) {
  li.draggable = true;
  li.dataset.index = String(index);

  li.addEventListener('dragstart', (e) => {
    dragFromIndex = index;
    li.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  });

  li.addEventListener('dragover', (e) => {
    e.preventDefault();
    li.classList.add('drag-over');
  });

  li.addEventListener('dragleave', () => {
    li.classList.remove('drag-over');
  });

  li.addEventListener('drop', (e) => {
    e.preventDefault();
    const toIndex = index;
    moveItem(dragFromIndex, toIndex);
    dragFromIndex = null;
    render();
  });

  li.addEventListener('dragend', () => {
    dragFromIndex = null;
    clearDragState();
  });

  handle.addEventListener('touchstart', () => {
    touchDragIndex = index;
    touchTargetIndex = index;
    li.classList.add('dragging');
  }, { passive: true });

  handle.addEventListener('touchmove', (e) => {
    if (touchDragIndex === null) {
      return;
    }
    const point = e.touches[0];
    const target = document.elementFromPoint(point.clientX, point.clientY)?.closest('.item');
    clearDragState();
    li.classList.add('dragging');
    if (target && target.dataset.index) {
      touchTargetIndex = Number.parseInt(target.dataset.index, 10);
      target.classList.add('touch-over');
    }
    e.preventDefault();
  }, { passive: false });

  handle.addEventListener('touchend', () => {
    moveItem(touchDragIndex, touchTargetIndex);
    touchDragIndex = null;
    touchTargetIndex = null;
    render();
  }, { passive: true });
}

function render() {
  itemList.innerHTML = '';
  const total = items.length;

  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'item';

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'drag-handle';
    handle.textContent = '≡';
    handle.setAttribute('aria-label', '拖拽排序');

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

    bindDragEvents(li, index, handle);

    li.append(handle, name, prob, del);
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
accountOpenBtn.addEventListener('click', openAccountModal);
accountCloseBtn.addEventListener('click', closeAccountModal);
accountBackdrop.addEventListener('click', closeAccountModal);
accountPickerBtn.addEventListener('click', togglePicker);
switchAccountBtn.addEventListener('click', switchAccount);
registerAccountBtn.addEventListener('click', registerAccount);
labelInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addItems();
  }
});
newAccountInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    registerAccount();
  }
});
document.addEventListener('click', (e) => {
  if (!accountPicker.contains(e.target) && !accountPickerList.hidden) {
    closePicker();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && accountModal.classList.contains('show')) {
    closeAccountModal();
  }
});

(async () => {
  await syncAccountsFromCloud();
  renderAccountState();
  await pullItemsFromCloud(currentAccount);
  render();
})();

