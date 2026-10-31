export const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function api(path, method = 'GET', body) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

export const BACKGROUNDS = [
  '#0079bf', '#d29034', '#519839', '#b04632', '#89609e', '#cd5a91', '#4bbf6b', '#00aecc',
  'linear-gradient(135deg,#0c66e4,#8f7ee7)', 'linear-gradient(135deg,#ff7e5f,#feb47b)', 'linear-gradient(135deg,#11998e,#38ef7d)',
];
export const LABEL_COLORS = ['#4bce97', '#f5cd47', '#fea362', '#f87168', '#9f8fef', '#579dff', '#60c6d2', '#e774bb'];

export function dueInfo(c) {
  if (!c.due) return null;
  const d = new Date(c.due);
  const cls = c.dueDone ? 'done' : d < new Date() ? 'overdue' : d - Date.now() < 864e5 ? 'soon' : '';
  return { cls, text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
}
export const toDateInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
