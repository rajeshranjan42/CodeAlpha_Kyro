import { useEffect, useState } from 'react';
import { api, dueInfo, toDateInput, LABEL_COLORS } from './api.js';
import Icon, { Avatar } from './Icons.jsx';

function ItemAdder({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState('');
  const add = (e) => { e.preventDefault(); if (t.trim()) onAdd(t.trim()); setT(''); };
  return open ? (
    <form onSubmit={add} className="row"><input autoFocus placeholder="Add an item" value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} /><button className="primary">Add</button><button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button></form>
  ) : <button onClick={() => setOpen(true)}>Add an item</button>;
}

function LabelEditor({ label, onSave, onDelete, onCancel }) {
  const [name, setName] = useState(label.name || '');
  const [color, setColor] = useState(label.color || LABEL_COLORS[0]);
  return (
    <div className="label-editor">
      <input autoFocus placeholder="Label name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="swatches">{LABEL_COLORS.map((c) => <button key={c} aria-label="Pick colour" className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />)}</div>
      <div className="row"><button className="primary" onClick={() => onSave({ ...label, name, color })}>Save</button>{label._id && <button className="danger" onClick={onDelete}>Delete</button>}<button className="ghost" onClick={onCancel}>Cancel</button></div>
    </div>
  );
}

export default function CardModal({ card, board, lists, socket, onClose, onPatch, onLabels, onDelete, onCopy }) {
  const [title, setTitle] = useState(card.title);
  const [desc, setDesc] = useState(card.description || '');
  const [editDesc, setEditDesc] = useState(false);
  const [pop, setPop] = useState(null);
  const [editLabel, setEditLabel] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [att, setAtt] = useState({ url: '', name: '' });
  const [date, setDate] = useState(toDateInput(card.due));
  const [err, setErr] = useState('');
  const patch = (f) => onPatch(card._id, f);

  useEffect(() => setTitle(card.title), [card.title]);
  useEffect(() => { if (!editDesc) setDesc(card.description || ''); }, [card.description]);
  useEffect(() => {
    api(`/cards/${card._id}/comments`).then(setComments).catch(() => {});
    const on = (c) => c.card === card._id && setComments((p) => (p.some((x) => x._id === c._id) ? p : [...p, c]));
    socket.on('comment:created', on);
    return () => socket.off('comment:created', on);
  }, [card._id]);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, []);

  const togglePop = (n) => setPop(pop === n ? null : n);
  const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const labels = board.labels.filter((l) => card.labels.includes(l._id));
  const mem = board.members.filter((m) => card.members.includes(m._id));
  const due = dueInfo(card);
  const updCl = (ci, fn) => patch({ checklists: card.checklists.map((cl, i) => (i === ci ? fn(cl) : cl)) });
  const saveLabel = (l) => {
    onLabels(l._id ? board.labels.map((x) => (x._id === l._id ? l : x)) : [...board.labels, { name: l.name, color: l.color }]);
    setEditLabel(null);
  };
  const sendComment = async (e) => {
    e.preventDefault();
    try { await api(`/cards/${card._id}/comments`, 'POST', { text }); setText(''); } catch (x) { setErr(x.message); }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Card details">
        {card.cover && <div className="m-cover" style={{ background: card.cover }} />}
        <button className="ghost icon-btn m-close" aria-label="Close card" onClick={onClose}><Icon name="x" size={18} /></button>
        <div className="m-head">
          <input className="m-title" value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => (title.trim() && title.trim() !== card.title ? patch({ title: title.trim() }) : setTitle(card.title))}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} aria-label="Card title" />
          <p className="muted">in list <select className="inline" value={card.list} onChange={(e) => patch({ list: e.target.value, position: Date.now() })} aria-label="Move to list">
            {lists.map((l) => <option key={l._id} value={l._id}>{l.title}</option>)}
          </select></p>
        </div>
        <div className="m-grid">
          <div className="m-main">
            {(mem.length > 0 || labels.length > 0 || due) && (
              <div className="chips">
                {mem.length > 0 && <div><h5>Members</h5><div className="row">{mem.map((m) => <Avatar key={m._id} user={m} size={32} />)}</div></div>}
                {labels.length > 0 && <div><h5>Labels</h5><div className="row wrap">{labels.map((l) => <button key={l._id} className="chip-label" style={{ background: l.color }} onClick={() => togglePop('labels')}>{l.name || '\u00A0\u00A0\u00A0'}</button>)}</div></div>}
                {due && <div><h5>Due date</h5><label className="row"><input type="checkbox" checked={card.dueDone} onChange={(e) => patch({ dueDone: e.target.checked })} /><span className={`due ${due.cls}`}>{new Date(card.due).toLocaleDateString(undefined, { dateStyle: 'medium' })}{due.cls === 'done' ? ' · Complete' : due.cls === 'overdue' ? ' · Overdue' : due.cls === 'soon' ? ' · Due soon' : ''}</span></label></div>}
              </div>
            )}
            <h4><Icon name="text" size={18} /> Description</h4>
            {editDesc ? (
              <div>
                <textarea autoFocus rows={5} placeholder="Add a more detailed description…" value={desc} onChange={(e) => setDesc(e.target.value)} />
                <div className="row"><button className="primary" onClick={() => { patch({ description: desc }); setEditDesc(false); }}>Save</button><button className="ghost" onClick={() => { setDesc(card.description || ''); setEditDesc(false); }}>Cancel</button></div>
              </div>
            ) : <button className="desc" onClick={() => setEditDesc(true)}>{card.description || 'Add a more detailed description…'}</button>}

            {card.checklists.map((cl, ci) => {
              const done = cl.items.filter((i) => i.done).length;
              const pct = cl.items.length ? Math.round((done / cl.items.length) * 100) : 0;
              return (
                <div className="cl" key={ci}>
                  <div className="row"><h4 style={{ flex: 1 }}><Icon name="checksq" size={18} /> {cl.title}</h4><button onClick={() => patch({ checklists: card.checklists.filter((_, i) => i !== ci) })}>Delete</button></div>
                  <div className="pct"><span>{pct}%</span><div className="progress"><i style={{ width: `${pct}%` }} /></div></div>
                  {cl.items.map((it, ii) => (
                    <label key={ii} className={`item ${it.done ? 'done' : ''}`}>
                      <input type="checkbox" checked={it.done} onChange={() => updCl(ci, (c) => ({ ...c, items: c.items.map((x, j) => (j === ii ? { ...x, done: !x.done } : x)) }))} />
                      <span>{it.text}</span>
                      <button type="button" className="ghost icon-btn" aria-label="Delete item" onClick={(e) => { e.preventDefault(); updCl(ci, (c) => ({ ...c, items: c.items.filter((_, j) => j !== ii) })); }}><Icon name="x" /></button>
                    </label>
                  ))}
                  <ItemAdder onAdd={(t) => updCl(ci, (c) => ({ ...c, items: [...c.items, { text: t, done: false }] }))} />
                </div>
              );
            })}

            {card.attachments.length > 0 && (
              <>
                <h4><Icon name="paperclip" size={18} /> Attachments</h4>
                {card.attachments.map((a, i) => (
                  <div key={i} className="att"><a href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>
                    <button className="ghost icon-btn" aria-label="Remove attachment" onClick={() => patch({ attachments: card.attachments.filter((_, j) => j !== i) })}><Icon name="x" /></button></div>
                ))}
              </>
            )}

            <h4><Icon name="activity" size={18} /> Comments</h4>
            <form onSubmit={sendComment} className="row"><input placeholder="Write a comment…" value={text} onChange={(e) => setText(e.target.value)} /><button className="primary" disabled={!text.trim()}><Icon name="send" />Save</button></form>
            {err && <p className="error">{err}</p>}
            {comments.length === 0 && <p className="muted">No comments yet.</p>}
            {[...comments].reverse().map((c) => (
              <div key={c._id} className="comment"><Avatar user={c.author} size={30} />
                <div><b>{c.author.name}</b> <small className="muted">{new Date(c.createdAt).toLocaleString()}</small><p>{c.text}</p></div></div>
            ))}
          </div>

          <aside className="m-side">
            <h5>Add to card</h5>
            <button className="sbtn" onClick={() => togglePop('members')}><Icon name="user" />Members</button>
            {pop === 'members' && <div className="pop-inline">{board.members.map((m) => (
              <button key={m._id} className="mrow" onClick={() => patch({ members: toggleIn(card.members, m._id) })}><Avatar user={m} size={26} /><span>{m.name}</span>{card.members.includes(m._id) && <Icon name="check" />}</button>
            ))}</div>}
            <button className="sbtn" onClick={() => togglePop('labels')}><Icon name="tag" />Labels</button>
            {pop === 'labels' && <div className="pop-inline">
              {editLabel ? <LabelEditor label={editLabel} onSave={saveLabel} onCancel={() => setEditLabel(null)}
                onDelete={() => { onLabels(board.labels.filter((x) => x._id !== editLabel._id)); setEditLabel(null); }} /> : (
                <>
                  {board.labels.map((l) => (
                    <div key={l._id} className="lrow">
                      <button className="lbl" style={{ background: l.color }} onClick={() => patch({ labels: toggleIn(card.labels, l._id) })}>{l.name || '\u00A0'}{card.labels.includes(l._id) && <Icon name="check" size={14} />}</button>
                      <button className="ghost icon-btn" aria-label="Edit label" onClick={() => setEditLabel(l)}><Icon name="edit" /></button>
                    </div>
                  ))}
                  <button onClick={() => setEditLabel({ color: LABEL_COLORS[0] })}>Create a new label</button>
                </>
              )}
            </div>}
            <button className="sbtn" onClick={() => patch({ checklists: [...card.checklists, { title: 'Checklist', items: [] }] })}><Icon name="checksq" />Checklist</button>
            <button className="sbtn" onClick={() => togglePop('dates')}><Icon name="clock" />Dates</button>
            {pop === 'dates' && <div className="pop-inline">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <div className="row"><button className="primary" disabled={!date} onClick={() => { patch({ due: new Date(`${date}T12:00:00`).toISOString(), dueDone: false }); setPop(null); }}>Save</button>
                <button onClick={() => { patch({ due: null, dueDone: false }); setDate(''); setPop(null); }}>Remove</button></div>
            </div>}
            <button className="sbtn" onClick={() => togglePop('attach')}><Icon name="paperclip" />Attachment</button>
            {pop === 'attach' && <form className="pop-inline" onSubmit={(e) => { e.preventDefault(); patch({ attachments: [...card.attachments, { url: att.url.trim(), name: att.name.trim() || att.url.trim() }] }); setAtt({ url: '', name: '' }); setPop(null); }}>
              <input required type="url" placeholder="Paste a link (https://…)" value={att.url} onChange={(e) => setAtt({ ...att, url: e.target.value })} />
              <input placeholder="Link name (optional)" value={att.name} onChange={(e) => setAtt({ ...att, name: e.target.value })} />
              <button className="primary">Attach</button></form>}
            <button className="sbtn" onClick={() => togglePop('cover')}><Icon name="image" />Cover</button>
            {pop === 'cover' && <div className="pop-inline"><div className="swatches">{LABEL_COLORS.map((c) => <button key={c} aria-label="Set cover" className={`swatch ${card.cover === c ? 'on' : ''}`} style={{ background: c }} onClick={() => patch({ cover: c })} />)}</div>
              {card.cover && <button onClick={() => patch({ cover: '' })}>Remove cover</button>}</div>}
            <h5>Actions</h5>
            <button className="sbtn" onClick={() => { onCopy(card._id); onClose(); }}><Icon name="copy" />Copy</button>
            <button className="sbtn" onClick={() => { patch({ archived: true }); onClose(); }}><Icon name="archive" />Archive</button>
            <button className="sbtn danger" onClick={() => confirm('Delete this card permanently?') && onDelete(card._id)}><Icon name="trash" />Delete</button>
          </aside>
        </div>
      </div>
    </div>
  );
}
