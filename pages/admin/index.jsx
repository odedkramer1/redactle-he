/**
 * /pages/admin/index.jsx
 * Admin UI with clear errors and connection test.
 */
import { useEffect, useMemo, useState } from 'react';

function useAdminFetch(setLastError) {
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
    let json = null;
    try { json = await res.json(); } catch {}
    if (!res.ok) {
      const msg = json?.error || `Request failed (${res.status})`;
      setLastError(msg);
      throw new Error(msg);
    }
    setLastError('');
    return json;
  }
  return { token, saveToken, call };
}

export default function AdminPage() {
  const [lastError, setLastError] = useState('');
  const [loginValue, setLoginValue] = useState('');
  const { token, saveToken, call } = useAdminFetch(setLastError);

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
  const [connected, setConnected] = useState(false);

  const canUse = Boolean(token);

  async function testConnection() {
    try {
      const data = await call('/api/admin/introspect');
      setModels(data.models || []);
      setConnected(true);
      if (!selectedModel && data.models && data.models[0]) setSelectedModel(data.models[0].name);
    } catch (e) {
      setConnected(false);
    }
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

  useEffect(() => { if (canUse) testConnection().catch(() => {}); }, [canUse]);
  useEffect(() => { if (canUse && selectedModel) loadData(true).catch(() => {}); }, [canUse, selectedModel, take]);

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
    try {
      if (!selectedModel) return;
      if (editId == null) {
        await call('/api/admin/records', { method: 'POST', body: JSON.stringify({ model: selectedModel, data: formData }) });
      } else {
        await call('/api/admin/records', { method: 'PUT', body: JSON.stringify({ model: selectedModel, id: editId, data: formData }) });
      }
      setFormData({});
      setEditId(null);
      await loadData(true);
      alert('נשמר בהצלחה');
    } catch (e) {
      alert('שגיאה בשמירה: ' + (e?.message || ''));
    }
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
    try {
      if (!confirm('למחוק את הרשומה הזו?')) return;
      await call('/api/admin/records', { method: 'DELETE', body: JSON.stringify({ model: selectedModel, id: row[idFieldName] }) });
      await loadData();
      alert('נמחק');
    } catch (e) {
      alert('שגיאה במחיקה: ' + (e?.message || ''));
    }
  }

  if (!canUse) {
    return (
      <div style={{ maxWidth: 680, margin: '40px auto', fontFamily: 'system-ui, Arial, sans-serif' }}>
        <h1>Admin – כניסה</h1>
        <p>הדבק כאן את ה־ADMIN_TOKEN שהגדרת ב־Environment:</p>
        <input
          type="password"
          placeholder="ADMIN_TOKEN"
          value={loginValue}
          onChange={(e) => setLoginValue(e.target.value)}
          style={{ width: '100%', padding: 8 }}
          onKeyDown={(e) => { if (e.key === 'Enter') saveToken(loginValue); }}
        />
        <button style={{ marginTop: 12 }} onClick={() => saveToken(loginValue)}>היכנס</button>
        <p style={{ marginTop: 24, color: '#666' }}>
          טיפ: את הטוקן מגדירים כ־<code>ADMIN_TOKEN</code> גם ב־Vercel וגם אצלך מקומית בקובץ <code>.env.local</code>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '30px auto', fontFamily: 'system-ui, Arial, sans-serif' }}>
      <h1>ניהול דאטה – Admin</h1>

      <div style={{ padding: 10, border: '1px solid #eee', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>סטטוס: {connected ? 'מחובר ✓' : 'לא מחובר'}</span>
        <button onClick={testConnection}>בדיקת חיבור</button>
        <span style={{ marginInlineStart: 'auto' }}>
          <button onClick={() => { localStorage.removeItem('ADMIN_TOKEN'); location.reload(); }}>התנתק</button>
        </span>
      </div>

      {lastError ? (
        <div style={{ background: '#fee', color: '#900', padding: 12, border: '1px solid #fbb', borderRadius: 8, marginTop: 12 }}>
          שגיאה: {lastError}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
        <label>מודל:</label>
        <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
          {models.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
        </select>
        <button onClick={() => loadData(true)}>רענן</button>
      </div>

      <hr style={{ margin: '16px 0' }} />

      <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8, marginBottom: 20 }}>
        <h3>{editId == null ? 'הוספת רשומה' : `עריכת רשומה #${editId}`}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))', gap: 12 }}>
          {scalarFields
            .filter((f) => f !== idFieldName)
            .map((fname) => {
              const fdef = models.find(m => m.name === selectedModel)?.scalarFields.find(s => s.name === fname);
              const type = fdef?.type || 'String';
              const t = type;
              const val = formData[fname] ?? '';
              if (t === 'Boolean') {
                return (
                  <label key={fname} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={!!val} onChange={(e) => setFormData((d) => ({ ...d, [fname]: e.target.checked }))} />
                    <span>{fname} <small style={{ color: '#888' }}>({type})</small></span>
                  </label>
                );
              }
              if (t === 'Json') {
                return (
                  <label key={fname} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>{fname} <small style={{ color: '#888' }}>({type})</small></span>
                    <textarea rows={4} value={typeof val === 'string' ? val : JSON.stringify(val ?? '', null, 2)} onChange={(e) => setFormData((d) => ({ ...d, [fname]: e.target.value }))} />
                  </label>
                );
              }
              if (t === 'Int' || t === 'BigInt' || t === 'Float' || t === 'Decimal') {
                return (
                  <label key={fname} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>{fname} <small style={{ color: '#888' }}>({type})</small></span>
                    <input type="number" value={val} onChange={(e) => setFormData((d) => ({ ...d, [fname]: e.target.value }))} />
                  </label>
                );
              }
              if (t === 'DateTime') {
                return (
                  <label key={fname} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>{fname} <small style={{ color: '#888' }}>({type})</small></span>
                    <input type="datetime-local" value={val ? new Date(val).toISOString().slice(0, 16) : ''} onChange={(e) => setFormData((d) => ({ ...d, [fname]: e.target.value }))} />
                  </label>
                );
              }
              return (
                <label key={fname} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>{fname} <small style={{ color: '#888' }}>({type})</small></span>
                  <input type="text" value={val} onChange={(e) => setFormData((d) => ({ ...d, [fname]: e.target.value }))} />
                </label>
              );
            })}
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
          <button disabled={skip === 0} onClick={() => { const n = Math.max(0, skip - take); setSkip(n); loadData().catch(() => {}); }}>קודם</button>
          <button disabled={skip + take >= total} onClick={() => { const n = skip + take; setSkip(n); loadData().catch(() => {}); }}>הבא</button>
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
