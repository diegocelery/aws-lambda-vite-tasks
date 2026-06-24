import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export default function TaskRow({ task, index, onToggle, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const editRef = useRef(null);

  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== task.title) {
      onRename(draft);
    } else {
      setDraft(task.title);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      setDraft(task.title);
      setEditing(false);
    }
  }

  return (
    <motion.li
      className={`row ${task.completed ? "row--done" : ""}`}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { delay: index * 0.04 } }}
      exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.2 } }}
    >
      <button
        className="check"
        onClick={onToggle}
        aria-pressed={task.completed}
        aria-label={task.completed ? "Marcar como pendiente" : "Marcar como completada"}
      >
        <svg viewBox="0 0 24 24" className="check-tick" aria-hidden="true">
          <path d="M5 12.5l4.2 4.2L19 7" />
        </svg>
      </button>

      <div className="row-body">
        {editing ? (
          <input
            ref={editRef}
            className="row-edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            maxLength={280}
            aria-label="Editar título"
          />
        ) : (
          <button
            className="row-title"
            onDoubleClick={() => setEditing(true)}
            title="Doble clic para editar"
          >
            {task.title}
          </button>
        )}
      </div>

      <div className="row-actions">
        {!editing && (
          <button className="ghost" onClick={() => setEditing(true)} aria-label="Editar">
            Editar
          </button>
        )}
        <button className="ghost ghost--danger" onClick={onDelete} aria-label="Eliminar">
          Eliminar
        </button>
      </div>
    </motion.li>
  );
}
