import { useEffect, useState } from 'react';
import { api, BACKGROUNDS } from './api.js';
import Icon from './Icons.jsx';

export default function Boards({ onOpen }) {
  const [boards, setBoards] = useState(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [bg, setBg] = useState(BACKGROUNDS[0]);
  const [err, setErr] = useState('');

  useEffect(() => { api('/boards').then(setBoards).catch((e) => setErr(e.message)); }, []);
  const create = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const b = await api('/boards', 'POST', { name, background: bg });
      onOpen(b._id);
    } catch (x) { setErr(x.message); }
  };

  return (
    <main className="page">
      <h2><Icon name="board" size={20} /> Your boards</h2>
      {err && <p className="error">{err}</p>}
      <div className="tiles">
        {(boards || []).map((b, i) => (
          <button key={b._id} className="tile" style={{ background: b.background, animationDelay: `${i * 50}ms` }} onClick={() => onOpen(b._id)}>
            <strong>{b.name}</strong>
            <span><Icon name="users" size={14} /> {b.members.length}</span>
          </button>
        ))}
        {!creating ? (
          <button className="tile new" onClick={() => setCreating(true)}><Icon name="plus" /> Create new board</button>
        ) : (
          <form className="tile new create-form" onSubmit={create}>
            <input autoFocus placeholder="Board title" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="swatches">
              {BACKGROUNDS.map((b) => (
                <button type="button" key={b} aria-label="Pick background" className={`swatch ${bg === b ? 'on' : ''}`} style={{ background: b }} onClick={() => setBg(b)} />
              ))}
            </div>
            <div className="row">
              <button className="primary" disabled={!name.trim()}>Create board</button>
              <button type="button" className="ghost" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
      {boards && boards.length === 0 && !creating && <p className="muted">You have no boards yet. Create one to start organising work in lists and cards.</p>}
    </main>
  );
}
