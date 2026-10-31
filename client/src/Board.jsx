import { Fragment, useEffect, useState } from 'react';
import { api, BACKGROUNDS, dueInfo } from './api.js';
import Icon, { Avatar } from './Icons.jsx';
import CardModal from './CardModal.jsx';

const GAP = 65536;
const between = (a, b) => (a == null && b == null ? GAP : a == null ? b / 2 : b == null ? a + GAP : (a + b) / 2);
const idxFromY = (e, el) => {
  const els = [...el.querySelectorAll('.card:not(.dragging)')];
  const i = els.findIndex((x) => { const r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
  return i < 0 ? els.length : i;
};
const idxFromX = (e, el) => {
  const els = [...el.querySelectorAll(':scope > .list:not(.dragging)')];
  const i = els.findIndex((x) => { const r = x.getBoundingClientRect(); return e.clientX < r.left + r.width / 2; });
  return i < 0 ? els.length : i;
};

function CardFace({ c, board, isDrag, onOpen, onDragStart, onDragEnd }) {
  const labels = board.labels.filter((l) => c.labels.includes(l._id));
  const mem = board.members.filter((m) => c.members.includes(m._id));
  const due = dueInfo(c);
  const total = c.checklists.reduce((n, cl) => n + cl.items.length, 0);
  const done = c.checklists.reduce((n, cl) => n + cl.items.filter((i) => i.done).length, 0);
  return (
    <article className={`card ${isDrag ? 'dragging' : ''}`} draggable onDragStart={(e) => onDragStart(e, c._id)} onDragEnd={onDragEnd} onClick={() => onOpen(c._id)}>
      {c.cover && <div className="cover" style={{ background: c.cover }} />}
      <div className="card-body">
        {labels.length > 0 && <div className="labels-bar">{labels.map((l) => <span key={l._id} className="lbar" style={{ background: l.color }} title={l.name}>{l.name}</span>)}</div>}
        <p className="card-title">{c.title}</p>
        <div className="badges">
          {due && <span className={`due ${due.cls}`}><Icon name="clock" size={13} />{due.text}</span>}
          {c.description && <span title="Has a description"><Icon name="text" size={13} /></span>}
          {total > 0 && <span className={done === total ? 'all-done' : ''}><Icon name="checksq" size={13} />{done}/{total}</span>}
          {c.attachments.length > 0 && <span><Icon name="paperclip" size={13} />{c.attachments.length}</span>}
          {mem.length > 0 && <span className="mem">{mem.map((m) => <Avatar key={m._id} user={m} size={24} />)}</span>}
        </div>
      </div>
    </article>
  );
}

function ListCol({ list, cards, dragCardId, over, isDragging, onAdd, onRename, onArchive, onOver, onDrop, onListDragStart, onDragEnd, renderCard }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [title, setTitle] = useState(list.title);
  const [editing, setEditing] = useState(false);
  useEffect(() => setTitle(list.title), [list.title]);
  const add = (e) => { e.preventDefault(); if (!text.trim()) return; onAdd(list._id, text.trim()); setText(''); };
  const here = over?.listId === list._id;
  let vi = 0;
  return (
    <section className={`list ${isDragging ? 'dragging' : ''}`} onDragOver={(e) => onOver(e, list._id)} onDrop={(e) => onDrop(e, list._id)}>
      <header draggable={!editing} onDragStart={(e) => onListDragStart(e, list._id)} onDragEnd={onDragEnd}>
        {editing ? (
          <input autoFocus className="list-title-input" value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { setEditing(false); if (title.trim() && title.trim() !== list.title) onRename(list._id, title.trim()); else setTitle(list.title); }}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
        ) : <h3 onClick={() => setEditing(true)}>{list.title}</h3>}
        <span className="count">{cards.length}</span>
        <button className="ghost icon-btn" aria-label="Archive this list" title="Archive list" onClick={() => onArchive(list._id)}><Icon name="archive" /></button>
      </header>
      <div className="cards">
        {cards.map((c) => {
          const ph = c._id !== dragCardId && here && over.index === vi;
          if (c._id !== dragCardId) vi += 1;
          return <Fragment key={c._id}>{ph && <div className="ph" />}{renderCard(c)}</Fragment>;
        })}
        {here && over.index >= vi && <div className="ph" />}
      </div>
      {adding ? (
        <form className="composer" onSubmit={add}>
          <textarea autoFocus rows={3} placeholder="Enter a title for this card…" value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) add(e); if (e.key === 'Escape') setAdding(false); }} />
          <div className="row"><button className="primary">Add card</button><button type="button" className="ghost icon-btn" aria-label="Cancel" onClick={() => setAdding(false)}><Icon name="x" size={18} /></button></div>
        </form>
      ) : <button className="add-card ghost" onClick={() => setAdding(true)}><Icon name="plus" />Add a card</button>}
    </section>
  );
}

export default function Board({ boardId, socket, me, initialCardId, onBg, onLeave }) {
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [cards, setCards] = useState([]);
  const [activity, setActivity] = useState([]);
  const [openId, setOpenId] = useState(initialCardId || null);
  const [menu, setMenu] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [flt, setFlt] = useState({ q: '', label: '', member: '', due: '' });
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [err, setErr] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [nameEdit, setNameEdit] = useState(null);
  const [invite, setInvite] = useState('');

  const load = () => api(`/boards/${boardId}`).then((d) => { setBoard(d.board); setLists(d.lists); setCards(d.cards); }).catch((e) => setErr(e.message));
  useEffect(() => { if (initialCardId) setOpenId(initialCardId); }, [initialCardId]);
  useEffect(() => {
    load();
    api(`/boards/${boardId}/activity`).then(setActivity).catch(() => {});
    const join = () => socket.emit('board:join', boardId);
    join();
    const rejoin = () => { join(); load(); }; // after a dropped connection
    const upsert = (setter) => (x) => setter((p) => (p.some((y) => y._id === x._id) ? p.map((y) => (y._id === x._id ? x : y)) : [...p, x]));
    const h = {
      'list:upsert': upsert(setLists), 'card:upsert': upsert(setCards),
      'card:deleted': ({ _id }) => setCards((p) => p.filter((c) => c._id !== _id)),
      'board:updated': () => load(), 'board:deleted': () => onLeave(),
      'activity:new': (a) => setActivity((p) => [a, ...p].slice(0, 40)),
    };
    Object.entries(h).forEach(([ev, fn]) => socket.on(ev, fn));
    socket.on('connect', rejoin);
    return () => { Object.entries(h).forEach(([ev, fn]) => socket.off(ev, fn)); socket.off('connect', rejoin); };
  }, [boardId, socket]);
  useEffect(() => { if (board) onBg(board.background); }, [board?.background]);

  const fail = (e) => { setErr(e.message); load(); };
  const patchCard = (id, f) => { setCards((p) => p.map((c) => (c._id === id ? { ...c, ...f } : c))); return api(`/cards/${id}`, 'PUT', f).catch(fail); };
  const patchList = (id, f) => { setLists((p) => p.map((l) => (l._id === id ? { ...l, ...f } : l))); return api(`/lists/${id}`, 'PUT', f).catch(fail); };
  const saveBoard = (f) => { setBoard((b) => ({ ...b, ...f })); return api(`/boards/${boardId}`, 'PUT', f).catch(fail); };
  const addCard = (list, title) => api(`/boards/${boardId}/cards`, 'POST', { list, title }).catch(fail);
  const addList = (e) => { e.preventDefault(); if (!listTitle.trim()) return; api(`/boards/${boardId}/lists`, 'POST', { title: listTitle.trim() }).catch(fail); setListTitle(''); };
  const delCard = (id) => { setOpenId(null); setCards((p) => p.filter((c) => c._id !== id)); api(`/cards/${id}`, 'DELETE').catch(fail); };
  const copyCard = (id) => api(`/cards/${id}/copy`, 'POST').catch(fail);
  const inviteMember = (e) => { e.preventDefault(); setErr(''); api(`/boards/${boardId}/members`, 'POST', { email: invite }).then(() => setInvite('')).catch((x) => setErr(x.message)); };
  const removeMember = (m) => confirm(`Remove ${m.name} from this board?`) && api(`/boards/${boardId}/members/${m._id}`, 'DELETE').catch(fail);
  const deleteBoard = () => confirm('Delete this board and everything on it? This cannot be undone.') && api(`/boards/${boardId}`, 'DELETE').catch(fail);

  if (!board) return <main className="board"><p className="muted pad">{err || 'Loading board…'}</p></main>;
  const isOwner = board.owner === me.id;
  const match = (c) =>
    (!flt.q || c.title.toLowerCase().includes(flt.q.toLowerCase())) &&
    (!flt.label || c.labels.includes(flt.label)) &&
    (!flt.member || (flt.member === 'none' ? c.members.length === 0 : c.members.includes(flt.member))) &&
    (!flt.due || (flt.due === 'overdue' ? c.due && !c.dueDone && new Date(c.due) < new Date() : flt.due === 'none' ? !c.due : !!c.due));
  const filtering = Object.values(flt).some(Boolean);
  const activeLists = lists.filter((l) => !l.archived).sort((a, b) => a.position - b.position);
  const cardsOf = (id) => cards.filter((c) => c.list === id && !c.archived).sort((a, b) => a.position - b.position);

  // --- drag and drop (mouse); touch users move cards with the "Move to list" menu in the card ---
  const startCard = (e, id) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); setTimeout(() => setDrag({ type: 'card', id }), 0); };
  const startList = (e, id) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); setTimeout(() => setDrag({ type: 'list', id }), 0); };
  const endDrag = () => { setDrag(null); setOver(null); };
  const overList = (e, listId) => {
    if (drag?.type !== 'card') return;
    e.preventDefault();
    const index = idxFromY(e, e.currentTarget);
    if (!over || over.listId !== listId || over.index !== index) setOver({ listId, index });
  };
  const dropCard = (e, listId) => {
    if (drag?.type !== 'card') return;
    e.preventDefault();
    const index = idxFromY(e, e.currentTarget);
    const others = cardsOf(listId).filter((c) => c._id !== drag.id && match(c));
    patchCard(drag.id, { list: listId, position: between(others[index - 1]?.position, others[index]?.position) });
    endDrag();
  };
  const overLists = (e) => {
    if (drag?.type !== 'list') return;
    e.preventDefault();
    const index = idxFromX(e, e.currentTarget);
    if (over?.index !== index || over?.listId) setOver({ index });
  };
  const dropList = (e) => {
    if (drag?.type !== 'list') return;
    e.preventDefault();
    const index = idxFromX(e, e.currentTarget);
    const others = activeLists.filter((l) => l._id !== drag.id);
    patchList(drag.id, { position: between(others[index - 1]?.position, others[index]?.position) });
    endDrag();
  };

  const openCard = cards.find((c) => c._id === openId);
  const archivedCards = cards.filter((c) => c.archived);
  const archivedLists = lists.filter((l) => l.archived);
  const listPh = drag?.type === 'list' && over && over.listId === undefined;

  return (
    <main className="board">
      <div className="board-head">
        {nameEdit === null ? <h1 className="board-title" onClick={() => setNameEdit(board.name)}>{board.name}</h1> : (
          <input autoFocus className="board-title-input" value={nameEdit} onChange={(e) => setNameEdit(e.target.value)}
            onBlur={() => { if (nameEdit.trim() && nameEdit.trim() !== board.name) saveBoard({ name: nameEdit.trim() }); setNameEdit(null); }}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
        )}
        <div className="avatars">{board.members.map((m) => <Avatar key={m._id} user={m} size={30} />)}</div>
        <button className="glass" onClick={() => setMenu(true)}><Icon name="userPlus" />Share</button>
        <span className="spacer" />
        <button className="glass" onClick={() => setFilterOpen(!filterOpen)}><Icon name="filter" />Filters{filtering && <b className="dot" />}</button>
        <button className="glass" onClick={() => setMenu(true)}><Icon name="more" />Menu</button>
        {filterOpen && (
          <div className="pop filters">
            <div className="search"><Icon name="search" /><input placeholder="Search cards" value={flt.q} onChange={(e) => setFlt({ ...flt, q: e.target.value })} /></div>
            <select value={flt.label} onChange={(e) => setFlt({ ...flt, label: e.target.value })}>
              <option value="">Any label</option>
              {board.labels.map((l) => <option key={l._id} value={l._id}>{l.name || l.color}</option>)}
            </select>
            <select value={flt.member} onChange={(e) => setFlt({ ...flt, member: e.target.value })}>
              <option value="">Any member</option><option value="none">No members</option>
              {board.members.map((m) => <option key={m._id} value={m._id}>{m._id === me.id ? 'Me' : m.name}</option>)}
            </select>
            <select value={flt.due} onChange={(e) => setFlt({ ...flt, due: e.target.value })}>
              <option value="">Any due date</option><option value="overdue">Overdue</option><option value="has">Has due date</option><option value="none">No due date</option>
            </select>
            {filtering && <button onClick={() => setFlt({ q: '', label: '', member: '', due: '' })}>Clear filters</button>}
          </div>
        )}
      </div>
      {err && <p className="error banner" onClick={() => setErr('')}>{err}</p>}
      <div className="lists" onDragOver={overLists} onDrop={dropList}>
        {activeLists.map((l, i) => (
          <Fragment key={l._id}>
            {listPh && over.index === i && <div className="list-ph" />}
            <ListCol list={l} cards={cardsOf(l._id).filter(match)} dragCardId={drag?.type === 'card' ? drag.id : null}
              over={drag?.type === 'card' ? over : null} isDragging={drag?.type === 'list' && drag.id === l._id}
              onAdd={addCard} onRename={(id, title) => patchList(id, { title })} onArchive={(id) => patchList(id, { archived: true })}
              onOver={overList} onDrop={dropCard} onListDragStart={startList} onDragEnd={endDrag}
              renderCard={(c) => <CardFace key={c._id} c={c} board={board} isDrag={drag?.type === 'card' && drag.id === c._id} onOpen={setOpenId} onDragStart={startCard} onDragEnd={endDrag} />} />
          </Fragment>
        ))}
        {listPh && over.index >= activeLists.length && <div className="list-ph" />}
        {addingList ? (
          <form className="add-list-form" onSubmit={addList}>
            <input autoFocus placeholder="Enter list title…" value={listTitle} onChange={(e) => setListTitle(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setAddingList(false)} />
            <div className="row"><button className="primary">Add list</button><button type="button" className="ghost icon-btn" aria-label="Cancel" onClick={() => setAddingList(false)}><Icon name="x" size={18} /></button></div>
          </form>
        ) : <button className="add-list glass" onClick={() => setAddingList(true)}><Icon name="plus" />Add another list</button>}
      </div>

      {openCard && (
        <CardModal card={openCard} board={board} lists={activeLists} socket={socket} onClose={() => setOpenId(null)}
          onPatch={patchCard} onLabels={(labels) => saveBoard({ labels })} onDelete={delCard} onCopy={copyCard} />
      )}

      {menu && (
        <>
          <div className="scrim" onClick={() => setMenu(false)} />
          <aside className="drawer">
            <header><h3>Menu</h3><button className="ghost icon-btn" aria-label="Close menu" onClick={() => setMenu(false)}><Icon name="x" size={18} /></button></header>
            <div className="section"><h4>Change background</h4>
              <div className="swatches">{BACKGROUNDS.map((b) => <button key={b} aria-label="Set background" className={`swatch ${board.background === b ? 'on' : ''}`} style={{ background: b }} onClick={() => saveBoard({ background: b })} />)}</div>
            </div>
            <div className="section"><h4>Members</h4>
              {board.members.map((m) => (
                <div key={m._id} className="mrow"><Avatar user={m} /><span>{m.name}<small className="muted">{m._id === board.owner ? ' · Owner' : ` · ${m.email}`}</small></span>
                  {isOwner && m._id !== board.owner && <button className="ghost icon-btn" aria-label={`Remove ${m.name}`} onClick={() => removeMember(m)}><Icon name="x" /></button>}</div>
              ))}
              <form onSubmit={inviteMember} className="row"><input placeholder="Invite by email" value={invite} onChange={(e) => setInvite(e.target.value)} /><button className="primary">Invite</button></form>
            </div>
            <div className="section"><h4>Archived items</h4>
              {archivedLists.length + archivedCards.length === 0 && <p className="muted">Nothing archived.</p>}
              {archivedLists.map((l) => <div key={l._id} className="arch"><span><Icon name="board" size={14} /> {l.title}</span><button onClick={() => patchList(l._id, { archived: false })}>Restore</button></div>)}
              {archivedCards.map((c) => <div key={c._id} className="arch"><span>{c.title}</span><button onClick={() => patchCard(c._id, { archived: false })}>Restore</button><button className="ghost icon-btn" aria-label="Delete card" onClick={() => delCard(c._id)}><Icon name="trash" /></button></div>)}
            </div>
            <div className="section"><h4><Icon name="activity" size={16} /> Activity</h4>
              {activity.length === 0 && <p className="muted">No activity yet.</p>}
              {activity.map((a) => <p key={a._id} className="act">{a.text}<small className="muted">{new Date(a.createdAt).toLocaleString()}</small></p>)}
            </div>
            {isOwner && <div className="section"><button className="danger wide" onClick={deleteBoard}><Icon name="trash" />Delete board</button></div>}
          </aside>
        </>
      )}
    </main>
  );
}
