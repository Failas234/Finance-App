/**
 * app.js
 * Simple finance tracker using localStorage.
 * Key points: robust input validation, try/catch around storage ops, import/export JSON/CSV.
 */

/* === Config === */
const STORAGE_KEY = 'finance_txns_v1';

/* === Helpers === */
const $ = (id) => document.getElementById(id);
const fmtIDR = (n) => 'Rp ' + Number(n).toLocaleString('id-ID', {maximumFractionDigits:2});
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
const safeParse = (v, d=[]) => { try { return JSON.parse(v); } catch(e){ return d; } };

/* === Storage layer === */
function loadTxns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? safeParse(raw, []) : [];
  } catch (e) {
    alert('Gagal membaca localStorage. Cek pengaturan browser. ' + e.message);
    return [];
  }
}
function saveTxns(arr) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    return true;
  } catch (e) {
    alert('Gagal menyimpan data ke localStorage. Silakan ekspor data Anda. ' + e.message);
    return false;
  }
}

/* === App state === */
let txns = loadTxns();
let editId = null;

/* === UI rendering === */
function renderSummary() {
  const income = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const balance = income - expense;
  $('total-income').textContent = fmtIDR(income.toFixed(2));
  $('total-expense').textContent = fmtIDR(expense.toFixed(2));
  $('balance').textContent = fmtIDR(balance.toFixed(2));
}

function createTxnElem(txn) {
  const wrapper = document.createElement('div');
  wrapper.className = 'txn';
  const left = document.createElement('div'); left.className='left';
  const badge = document.createElement('div'); badge.className = 'type-badge ' + (txn.type==='income' ? 'type-income' : 'type-expense');
  badge.textContent = txn.type==='income' ? 'Pemasukan' : 'Pengeluaran';
  const meta = document.createElement('div'); meta.className='meta';
  meta.innerHTML = `<div><strong>${txn.category || '-'}</strong> • ${new Date(txn.date).toLocaleDateString('id-ID')}</div><div>${txn.note || ''}</div>`;
  left.appendChild(badge); left.appendChild(meta);
  const right = document.createElement('div'); right.className='right';
  const amount = document.createElement('div'); amount.className='amount'; amount.textContent = fmtIDR(txn.amount.toFixed(2));
  const actions = document.createElement('div'); actions.className='actions';
  const btnEdit = document.createElement('button'); btnEdit.textContent='Edit'; btnEdit.onclick = ()=> startEdit(txn.id);
  const btnDel = document.createElement('button'); btnDel.textContent='Hapus'; btnDel.className='danger'; btnDel.onclick = ()=> removeTxn(txn.id);
  actions.appendChild(btnEdit); actions.appendChild(btnDel);
  right.appendChild(amount); right.appendChild(actions);
  wrapper.appendChild(left); wrapper.appendChild(right);
  return wrapper;
}

function renderTxns(filtered=null) {
  const list = $('txns-list'); list.innerHTML = '';
  const rendered = (filtered || txns).slice().sort((a,b)=> new Date(b.date) - new Date(a.date));
  if (rendered.length === 0) {
    list.innerHTML = '<p class="muted">Belum ada transaksi.</p>';
    $('monthly-summary').innerHTML = '<p class="muted">Belum ada data untuk ringkasan.</p>';
    return;
  }
  for (const t of rendered) list.appendChild(createTxnElem(t));
  renderMonthlySummary(rendered);
}

function renderMonthlySummary(list) {
  // Aggregate by YYYY-MM
  const map = {};
  list.forEach(t=>{
    const d = new Date(t.date);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    if (!map[key]) map[key] = {income:0, expense:0};
    map[key][t.type] += t.amount;
  });
  const keys = Object.keys(map).sort().reverse();
  const container = $('monthly-summary'); container.innerHTML = '';
  if (keys.length === 0) { container.innerHTML = '<p class="muted">Belum ada data.</p>'; return; }
  // find max for scaling bars
  const max = Math.max(...keys.map(k=>map[k].income + map[k].expense));
  keys.forEach(k=>{
    const row = document.createElement('div'); row.className='month-row';
    const label = document.createElement('div'); label.style.minWidth='120px';
    const [y,m] = k.split('-'); label.textContent = `${m}/${y}`;
    const barWrap = document.createElement('div'); barWrap.className='bar';
    const total = map[k].income + map[k].expense;
    const pct = max ? Math.round((total / max) * 100) : 0;
    const bar = document.createElement('span');
    bar.style.width = pct + '%';
    bar.style.background = 'linear-gradient(90deg, rgba(34,197,94,0.7), rgba(37,99,235,0.7))';
    barWrap.appendChild(bar);
    const right = document.createElement('div'); right.style.minWidth='160px'; right.className='meta';
    right.innerHTML = `<div>In: ${fmtIDR(map[k].income.toFixed(2))} • Out: ${fmtIDR(map[k].expense.toFixed(2))}</div><div>Total: ${fmtIDR(total.toFixed(2))}</div>`;
    row.appendChild(label); row.appendChild(barWrap); row.appendChild(right);
    container.appendChild(row);
  });
}

/* === CRUD operations === */
function addTxn(data) {
  txns.push(data);
  saveTxns(txns);
  renderSummary();
  renderTxns();
}

function updateTxn(id, patch) {
  const idx = txns.findIndex(t=>t.id===id);
  if (idx === -1) return false;
  txns[idx] = { ...txns[idx], ...patch };
  saveTxns(txns);
  return true;
}

function removeTxn(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  txns = txns.filter(t=>t.id !== id);
  saveTxns(txns);
  renderSummary();
  renderTxns();
}

/* === Form handling === */
function resetForm() {
  $('txn-form').reset();
  $('date').valueAsDate = new Date();
  editId = null;
  $('save-btn').textContent = 'Tambah';
}
function startEdit(id) {
  const t = txns.find(x=>x.id===id);
  if (!t) return alert('Transaksi tidak ditemukan.');
  $('type').value = t.type;
  $('amount').value = t.amount;
  $('date').value = new Date(t.date).toISOString().slice(0,10);
  $('category').value = t.category;
  $('note').value = t.note;
  editId = id;
  $('save-btn').textContent = 'Simpan Perubahan';
}

/* === Export / Import === */
function exportJSON() {
  const data = JSON.stringify(txns, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download = 'finance_backup.json'; a.click();
  URL.revokeObjectURL(url);
}
function exportCSV() {
  const header = ['id','date','type','amount','category','note'];
  const rows = txns.map(t => [t.id, t.date, t.type, t.amount, `"${(t.category||'').replace(/"/g,'""')}"`, `"${(t.note||'').replace(/"/g,'""')}"`]);
  const csv = [header, ...rows].map(r=>r.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download = 'finance_data.csv'; a.click();
  URL.revokeObjectURL(url);
}
function importJSONFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = safeParse(e.target.result, null);
      if (!Array.isArray(parsed)) return alert('Format file tidak valid (expected array).');
      // Basic validation on entries
      const ok = parsed.every(p => p.id && p.date && p.type && typeof p.amount === 'number');
      if (!ok) return alert('Data tidak lengkap atau format salah.');
      txns = parsed;
      saveTxns(txns);
      renderSummary();
      renderTxns();
      alert('Impor berhasil.');
    } catch (err) {
      alert('Gagal impor: ' + err.message);
    }
  };
  reader.readAsText(file);
}

/* === Filters === */
function applyFilter() {
  const ftype = $('filter-type').value;
  const from = $('filter-from').value ? new Date($('filter-from').value) : null;
  const to = $('filter-to').value ? new Date($('filter-to').value) : null;
  let filtered = txns.slice();
  if (ftype !== 'all') filtered = filtered.filter(t => t.type === ftype);
  if (from) filtered = filtered.filter(t => new Date(t.date) >= from);
  if (to) {
    const tEnd = new Date($('filter-to').value); tEnd.setHours(23,59,59,999);
    filtered = filtered.filter(t => new Date(t.date) <= tEnd);
  }
  renderTxns(filtered);
}

/* === Init & event wiring === */
function setup() {
  // default date
  $('date').valueAsDate = new Date();

  // form submit
  $('txn-form').addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const type = $('type').value;
    const amount = parseFloat($('amount').value);
    const dateVal = $('date').value;
    const category = $('category').value.trim();
    const note = $('note').value.trim();
    if (!dateVal || isNaN(amount) || amount <= 0) return alert('Isi tanggal dan jumlah yang valid (>0).');
    const payload = {
      id: editId || uid(),
      date: new Date(dateVal).toISOString(),
      type, amount: +amount, category, note
    };
    if (editId) {
      updateTxn(editId, payload);
      editId = null;
      $('save-btn').textContent = 'Tambah';
    } else {
      addTxn(payload);
    }
    $('txn-form').reset();
    $('date').valueAsDate = new Date();
  });

  $('clear-form').addEventListener('click', resetForm);

  $('export-json').addEventListener('click', exportJSON);
  $('export-csv').addEventListener('click', exportCSV);
  $('import-json').addEventListener('change', (e)=>{
    const f = e.target.files[0];
    if (f) importJSONFile(f);
    e.target.value = '';
  });

  $('apply-filter').addEventListener('click', applyFilter);
  $('reset-filter').addEventListener('click', ()=>{
    $('filter-type').value='all'; $('filter-from').value=''; $('filter-to').value=''; renderTxns();
  });

  $('clear-all').addEventListener('click', ()=>{
    if (!confirm('Hapus semua transaksi? Tindakan ini tidak bisa dibatalkan.')) return;
    txns = []; saveTxns(txns); renderSummary(); renderTxns();
  });

  // initial render
  renderSummary(); renderTxns();
}

document.addEventListener('DOMContentLoaded', setup);
