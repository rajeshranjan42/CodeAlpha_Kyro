import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, BASE } from './api.js';
import Boards from './Boards.jsx';
import Board from './Board.jsx';
import Icon, { Avatar } from './Icons.jsx';
import { registerSW, pushState, enablePush, disablePush, testPush } from './push.js';

function OtpInput({ onChange }) {
  const [d, setD] = useState(Array(6).fill(''));
  const refs = useRef([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const update = (a) => { setD(a); onChange(a.join('')); };
  const type = (i, v) => {
    const ch = v.replace(/\D/g, '').slice(-1);
    const a = [...d]; a[i] = ch; update(a);
    if (ch && i < 5) refs.current[i + 1].focus();
  };
  const paste = (e) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!t) return;
    e.preventDefault();
    update(Array.from({ length: 6 }, (_, i) => t[i] || ''));
    refs.current[Math.min(t.length, 5)].focus();
  };
  return (
    <div className="otp" onPaste={paste}>
      {d.map((v, i) => (
        <input key={i} ref={(el) => (refs.current[i] = el)} value={v} inputMode="numeric" maxLength={1} aria-label={`Digit ${i + 1}`}
          autoComplete={i === 0 ? 'one-time-code' : 'off'} onFocus={(e) => e.target.select()}
          onChange={(e) => type(i, e.target.value)}
          onKeyDown={(e) => e.key === 'Backspace' && !d[i] && i > 0 && refs.current[i - 1].focus()} />
      ))}
    </div>
  );
}

function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState('form');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const finish = (d) => { localStorage.setItem('token', d.token); onAuth(d.user); };
  const run = async (fn) => { setErr(''); setBusy(true); try { await fn(); } catch (x) { setErr(x.message); } finally { setBusy(false); } };
  const submit = (e) => { e.preventDefault(); run(async () => {
    const d = await api(`/auth/${mode}`, 'POST', f);
    if (d.otpSent) { setStep('otp'); setWait(30); setInfo(d.message || ''); } else finish(d);
  }); };
  const verify = (e) => { e.preventDefault(); run(async () => finish(await api('/auth/verify-otp', 'POST', { email: f.email, otp }))); };
  const resend = () => run(async () => { await api('/auth/resend-otp', 'POST', { email: f.email }); setWait(30); setInfo('A new code is on its way.'); });

  return (
    <div className="auth-wrap">
      <div className="auth-card" key={step}>
        <div className="logo"><img src="/logo.svg" alt="" width="40" height="40" /> Kyro</div>
        {step === 'form' ? (
          <form onSubmit={submit}>
            <h2>{mode === 'login' ? 'Log in to continue' : 'Sign up for your account'}</h2>
            {mode === 'register' && <input placeholder="Full name" value={f.name} onChange={set('name')} />}
            <input placeholder="Email" type="email" value={f.email} onChange={set('email')} />
            <div className="pw">
              <input placeholder="Password (6+ characters)" type={show ? 'text' : 'password'} value={f.password} onChange={set('password')} />
              <button type="button" className="ghost icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
                <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
              </button>
            </div>
            {err && <p key={err} className="error shake">{err}</p>}
            <button className="primary wide" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Continue' : 'Sign up'}</button>
            <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
              {mode === 'login' ? 'Create an account' : 'Already have an account? Log in'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <h2><Icon name="mail" size={20} /> Check your email</h2>
            <p className="muted">Enter the 6-digit code sent to <b>{f.email}</b>.</p>
            {info && <p className="info">{info}</p>}
            <OtpInput onChange={setOtp} />
            {err && <p key={err} className="error shake">{err}</p>}
            <button className="primary wide" disabled={busy || otp.length < 6}>Verify and continue</button>
            <button type="button" className="link" disabled={wait > 0 || busy} onClick={resend}>{wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</button>
            <button type="button" className="link" onClick={() => { setStep('form'); setErr(''); }}>Use a different email</button>
          </form>
        )}
      </div>
    </div>
  );
}

function Bell({ items, onRead, onOpen, ring }) {
  const [open, setOpen] = useState(false);
  const [ps, setPs] = useState('off');
  const [msg, setMsg] = useState('');
  const unread = items.filter((n) => !n.read).length;
  useEffect(() => { pushState().then(setPs); }, []);
  const toggle = () => { setOpen(!open); if (!open && unread) onRead(); };
  const act = (fn, ok) => async () => {
    setMsg('');
    try { await fn(); if (ok) setMsg(ok); } catch (x) { setMsg(x.message); }
    setPs(await pushState());
  };
  return (
    <div className="bell">
      <button className={`glass icon-btn ${ring ? 'ring' : ''}`} onClick={toggle} aria-label="Notifications">
        <Icon name="bell" size={18} />{unread > 0 && <b className="badge">{unread}</b>}
      </button>
      {open && (
        <div className="drop">
          <h4>Notifications</h4>
          <div className="push">
            {ps === 'unsupported' && <p className="muted">Device notifications need a supported browser. On iPhone, open the site in Safari, tap Share, then Add to Home Screen, and open it from there.</p>}
            {ps === 'denied' && <p className="muted">Notifications are blocked for this site. Allow them in your browser or phone settings, then reload.</p>}
            {ps === 'off' && <button className="primary wide" onClick={act(enablePush, 'Device notifications are on.')}><Icon name="bell" />Turn on device notifications</button>}
            {ps === 'on' && <div className="row"><span className="muted" style={{ flex: 1 }}>Device notifications are on</span><button onClick={act(testPush, 'Test sent. Check your notification panel.')}>Send test</button><button onClick={act(disablePush)}>Turn off</button></div>}
            {msg && <p className="muted">{msg}</p>}
          </div>
          {items.length === 0 && <p className="muted pad">You are all caught up.</p>}
          {items.map((n) => (
            <button key={n._id} className={`note ${n.read ? '' : 'unread'}`} onClick={() => { setOpen(false); onOpen(n); }}>
              {n.text}<span className="muted">{new Date(n.createdAt).toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [socket, setSocket] = useState(null);
  const [view, setView] = useState({ boardId: null, cardId: null });
  const [bg, setBg] = useState('');
  const [items, setItems] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [ring, setRing] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) return setReady(true);
    api('/auth/me').then(setUser).catch(() => localStorage.removeItem('token')).finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!user) return;
    api('/notifications').then(setItems).catch(() => {});
    const s = io(BASE, { auth: { token: localStorage.getItem('token') } });
    s.on('notification', (n) => {
      setItems((p) => [n, ...p]);
      setToasts((p) => [...p, n]);
      setRing(true); setTimeout(() => setRing(false), 1200);
      setTimeout(() => setToasts((p) => p.filter((t) => t._id !== n._id)), 6000);
    });
    setSocket(s);
    return () => s.disconnect();
  }, [user]);

  useEffect(() => {
    registerSW();
    const onMsg = (e) => e.data?.type === 'open' && setView({ boardId: e.data.boardId || null, cardId: e.data.cardId || null });
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, []);
  useEffect(() => {
    if (!user) return;
    const p = new URLSearchParams(location.search);
    if (p.get('board')) { setView({ boardId: p.get('board'), cardId: p.get('card') }); history.replaceState({}, '', '/'); }
  }, [user]);

  if (!ready) return null;
  if (!user) return <Auth onAuth={setUser} />;

  const openBoard = (boardId, cardId = null) => setView({ boardId, cardId });
  const home = () => { setView({ boardId: null, cardId: null }); setBg(''); };
  const logout = async () => { await disablePush().catch(() => {}); localStorage.removeItem('token'); setUser(null); setSocket(null); home(); };
  const readAll = () => { api('/notifications/read', 'POST'); setItems((p) => p.map((n) => ({ ...n, read: true }))); };
  const openNote = (n) => n.boardId && openBoard(n.boardId, n.cardId);

  return (
    <div className="app" style={view.boardId && bg ? { background: bg } : undefined}>
      <header className="top">
        <button className="glass brand" onClick={home}><img src="/logo.svg" alt="" width="24" height="24" />Kyro</button>
        <span className="spacer" />
        <Bell items={items} onRead={readAll} onOpen={openNote} ring={ring} />
        <span className="who"><Avatar user={user} size={28} /><span className="hide-sm">{user.name}</span></span>
        <button className="glass icon-btn" onClick={logout} aria-label="Log out"><Icon name="logout" size={18} /></button>
      </header>
      {view.boardId && socket
        ? <Board key={view.boardId} boardId={view.boardId} socket={socket} me={user} initialCardId={view.cardId} onBg={setBg} onLeave={home} />
        : <Boards onOpen={openBoard} />}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <button key={t._id} className="toast" onClick={() => { setToasts((p) => p.filter((x) => x._id !== t._id)); openNote(t); }}>
            <Icon name="bell" size={16} /><span>{t.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}