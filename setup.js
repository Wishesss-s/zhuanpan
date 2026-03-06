const STORAGE_KEY_BASE = 'wheel_items_v1';
const ACCOUNT_KEY = 'wheel_account_v1';
const ACCOUNT_LIST_KEY = 'wheel_accounts_v1';
const DEFAULT_ACCOUNT = '默认账号';
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

function loadAccountList() {
  try {
    const raw = localStorage.getItem(ACCOUNT_LIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const cleaned = Array.isArray(parsed)
      ? [...new Set(parsed.map(normalizeAccountName).filter(Boolean))]
      : [];
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
  const saved = normalizeAccountName(localStorage.getItem(ACCOUNT_KEY));
  if (saved && accounts.includes(saved)) {
    return saved;
  }
  localStorage.setItem(ACCOUNT_KEY, accounts[0]);
  return accounts[0];
}

function setCurrentAccount(name) {
  currentAccount = name;
  localStorage.setItem(ACCOUNT_KEY, currentAccount);
  accountInfo.textContent = `当前账号：${currentAccount}`;
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

function persistItemsForAccount(accountName, accountItems) {
  localStorage.setItem(storageKeyForAccount(accountName), JSON.stringify(accountItems));
}

function openAccountModal() {
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

async function pullItemsFromCloud(accountName) {
  if (!window.supabaseClient) {
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
  accountInfo.textContent = `当前账号：${currentAccount}`;
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
      const { data, error } = await window.supabaseClient
        .from(CLOUD_TABLE)
        .select('items')
        .eq('account_name', name)
        .single();

      if (!error && data && normalizeItems(data.items)) {
        hasCloudData = true;
        items = normalizeItems(data.items);
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
  renderAccountState();
  await pullItemsFromCloud(currentAccount);
  render();
})();
