/**
 * /pages/admin/index.jsx
 * Lightweight admin UI for your Prisma models.
 * Protects with ADMIN_TOKEN; stores token in localStorage.
 */
import { useEffect, useMemo, useState } from 'react';

function useAdminFetch() {
  const [token, setToken] = useState('');
  useEffect(() => {
    const saved = localStorage.getItem('ADMIN_TOKEN');
    if (saved) setToken(saved);
  }, []);
  function saveToken(newTok) {
    setToken(newTok);
    localStorage.setItem('ADMIN_TOKEN', newTok);
  }
  async function call(url, init) {
    const headers = new Headers(init?.headers);
    headers.set('x-admin-token', token);
    headers.set('Content-Type', 'application/json');
    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      let msg = {};
      try { msg = await res.json(); } catch {}
      throw new Error(msg?.error || `Request failed (${res.status})`);
    }
    return res.json();
  }
  return { token, saveToken, call };
}

export default function AdminPage() {
  const { token, saveToken, call } = useAdminFetch();
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [idFieldName, setIdFieldName] = useState('id');
  const [scalarFields, setScalarFields] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [take, setTake] = useState(50);
  const [formData, setFormData] = useState({});
  const [editId, setEditId] = useState(null);

  const canUse = Boolean(token);

  async function loadModels() {
    const data = await call('/api/admin/introspect');
    setModels(data.models);
    if (!selectedModel && data.models[0]) setSelectedModel(data.models[0].name);
  }

  async function loadData(reset = false) {
    if (!selectedModel) return;
    const data = await call(`/api/admin/records?model=${encodeURIComponent(selectedModel)}&skip=${reset ? 0 : skip}&take=${take}`);
    setItems(data.items);
    setTotal(data.total);
    setIdFieldName(data.idFieldName);
    setScalarFields(data.scalarFields);
    if (reset) setSkip(0);
  }

  useEffect(() => { if (canUse) loadModels().catch(console.error); }, [canUse]);
  useEffect(() => { if (canUse && selectedModel) loadData(true).catch(console.error); }, [canUse, selectedModel, take]);

  function renderInput(field) {
    const t = field.type;
    const val = formData[field.name] ?? '';
    if (t === 'Boolean') {
      return <input type="checkbox" checked={!!val} onChange={(e) => setFormData((d) => ({ ...d, [field.name]: e.target.checked }))} />;
    }
    if (t === 'Json') {
      return <textarea rows={4} value={typeof val === 'string' ? val : JSON.stringify(val ?? '', null, 2)} onChange={(e) => setFormData((d) => ({ ...d, [field.name]: e.target.value }))} />;
    }
    if (t === 'Int' || t === 'BigInt' || t === 'Float' || t === 'Decimal') {
      return <input type="number" value={val} onChange={(e) => setFormData((d) => ({ ...d, [field.name]: e.target.value }))} />;
    }
    if (t === 'DateTime') {
      return <input type="datetime-local" value={val ? new Date(val).toISOString().slice(0, 16) : ''} onChange={(e) => setFormData((d) => ({ ...d, [field.name]: e.target.value }))} />;
    }
    return <input type="text" value={val} onChange={(e) => setFormData((d) => ({ ...d, [field.name]: e.target.value }))} />;
  }

  async function onSave() {
    if (!selectedModel) return;
    if (editId == null) {
      await call('/api/admin/records', { method: 'POST', body: JSON.stringify({ model: selectedModel, data: formData }) });
    } else {
      await call('/api/admin/records', { method: 'PUT', body: JSON.stringify({ model: selectedModel, id: editId, data: formData }) });
    }
    setFormData({});
    setEditId(null);
    await loadData(true);
  }

  function onEdit(row) {
    setEditId(row[idFieldName]);
    const allowed = new Set(scalarFields);
    const filtered = {};
    Object.keys(row).forEach((k) => { if (allowed.has(k) && k !== idFieldName) filtered[k] = row[k]; });
    setFormData(filtered);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onDelete(row) {
    if (!confirm('למחוק את הרשומה הזו?')) return;
    await call('/api/admin/records', { method: 'DELETE', body: JSON.stringify({ model: selectedModel, id: row[idFieldName] }) });
    await loadData();
  }

  if (!canUse) {
    let inputValue = '';
    return (
      <div style={{ maxWidth: 680, margin: '40px auto', fontFamily: 'system-ui, Arial, sans-serif' }}>
        <h1>Admin – כניסה</h1>
        <p>הדבק כאן את ה־ADMIN_TOKEN שהגדרת ב־Environment:</p>
        <input
          type="password"
          placeholder="ADMIN_TOKEN"
          style={{ width: '100%', padding: 8 }}
          onChange={(e) => (inputValue = e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') saveToken(inputValue); }}
        />
        <button style={{ marginTop: 12 }} onClick={() => saveToken(inputValue)}>היכנס</button>
        <p style={{ marginTop: 24, color: '#666' }}>
          טיפ: את הטוקן מגדירים כ־<code>ADMIN_TOKEN</code> גם ב־Vercel וגם אצלך מקומית בקובץ <code>.env.local</code>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '30px auto', fontFamily: 'system-ui, Arial, sans-serif' }}>
      <h1>ניהול דאטה – Admin</h1>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>מודל:</label>
        <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
          {models.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
        </select>
        <button onClick={() => loadData(true)}>רענן</button>
        <span style={{ marginInlineStart: 'auto' }}>
          <button onClick={() => { localStorage.removeItem('ADMIN_TOKEN'); location.reload(); }}>
            התנתק
          </button>
        </span>
      </div>

      <hr style={{ margin: '16px 0' }} />

      <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8, marginBottom: 20 }}>
        <h3>{editId == null ? 'הוספת רשומה' : `עריכת רשומה #${editId}`}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))', gap: 12 }}>
          {scalarFields
            .filter((f) => f !== idFieldName)
            .map((fname) => (
              <label key={fname} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>{fname}</span>
                {renderInput({ name: fname, type: (models.find(m => m.name === selectedModel)?.scalarFields.find(s => s.name === fname)?.type) || 'String' })}
              </label>
            ))}
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button onClick={onSave}>{editId == null ? 'שמור' : 'עדכן'}</button>
          {editId != null && <button onClick={() => { setEditId(null); setFormData({}); }}>ביטול</button>}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[idFieldName, ...scalarFields.filter((f) => f !== idFieldName)].map((col) => (
                <th key={col} style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>{col}</th>
              ))}
              <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={String(row[idFieldName])}>
                {[idFieldName, ...scalarFields.filter((f) => f !== idFieldName)].map((col) => (
                  <td key={col} style={{ borderBottom: '1px solid #eee', padding: 8, fontFamily: 'monospace' }}>
                    {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}
                  </td>
                ))}
                <td style={{ borderBottom: '1px solid #eee', padding: 8, whiteSpace: 'nowrap' }}>
                  <button onClick={() => onEdit(row)}>ערוך</button>{' '}
                  <button onClick={() => onDelete(row)} style={{ color: '#b00' }}>מחק</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button disabled={skip === 0} onClick={() => { setSkip(Math.max(0, skip - take)); loadData().catch(console.error); }}>קודם</button>
          <button disabled={skip + take >= total} onClick={() => { setSkip(skip + take); loadData().catch(console.error); }}>הבא</button>
          <span style={{ color: '#666' }}>
            מציג {total === 0 ? 0 : (skip + 1)}–{Math.min(skip + take, total)} מתוך {total}
          </span>
          <span style={{ marginInlineStart: 'auto' }}>
            Rows per page:{' '}
            <select value={take} onChange={(e) => setTake(Number(e.target.value))}>
              {[20, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </span>
        </div>
      </div>
    </div>
  );
}
