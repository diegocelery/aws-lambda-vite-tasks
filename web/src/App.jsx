import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "./api.js";
import TaskRow from "./TaskRow.jsx";

const pad = (n) => String(n).padStart(2, "0");

const todayLabel = () =>
  new Date()
    .toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.list();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "No se pudo cargar la lista.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addTask(e) {
    e?.preventDefault();
    const value = title.trim();
    if (!value || adding) return;
    setAdding(true);
    setError("");
    try {
      const created = await api.create(value);
      setTasks((prev) => [created, ...prev]);
      setTitle("");
      inputRef.current?.focus();
    } catch (e) {
      setError(e.message || "No se pudo crear la tarea.");
    } finally {
      setAdding(false);
    }
  }

  async function toggleTask(task) {
    // Optimista: refleja el cambio al instante y revierte si falla.
    const next = !task.completed;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t))
    );
    try {
      const updated = await api.update(task.id, { completed: next });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (e) {
      setError(e.message || "No se pudo actualizar.");
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completed: !next } : t))
      );
    }
  }

  async function renameTask(task, newTitle) {
    const value = newTitle.trim();
    if (!value || value === task.title) return;
    try {
      const updated = await api.update(task.id, { title: value });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (e) {
      setError(e.message || "No se pudo editar el título.");
    }
  }

  async function deleteTask(task) {
    const snapshot = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      await api.remove(task.id);
    } catch (e) {
      setError(e.message || "No se pudo eliminar.");
      setTasks(snapshot);
    }
  }

  const { pending, done } = useMemo(() => {
    const done = tasks.filter((t) => t.completed).length;
    return { pending: tasks.length - done, done };
  }, [tasks]);

  return (
    <div className="page">
      <div className="grain" aria-hidden="true" />
      <main className="sheet">
        <header className="masthead">
          <p className="dateline">{todayLabel()}</p>
          <h1 className="title">
            Quehaceres<span className="title-mark">.</span>
          </h1>
          <p className="subtitle">Un diario de tareas por hacer</p>
          <div className="rule rule--double" />
        </header>

        <form className="composer" onSubmit={addTask}>
          <input
            ref={inputRef}
            className="composer-input"
            type="text"
            placeholder="Escribe una tarea y pulsa Enter…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={280}
            aria-label="Nueva tarea"
          />
          <button
            className="composer-btn"
            type="submit"
            disabled={!title.trim() || adding}
          >
            {adding ? "…" : "Añadir"}
          </button>
        </form>

        <AnimatePresence>
          {error && (
            <motion.div
              className="banner banner--error"
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <span>{error}</span>
              <button className="banner-action" onClick={load}>
                Reintentar
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="ledger">
          {loading ? (
            <div className="state">
              <span className="spinner" aria-hidden="true" />
              <span>Cargando tareas…</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="state state--empty">
              <span className="empty-mark">·</span>
              <p>La hoja está en blanco.</p>
              <p className="muted">Añade tu primera tarea arriba.</p>
            </div>
          ) : (
            <ul className="list">
              <AnimatePresence initial={false}>
                {tasks.map((task, i) => (
                  <TaskRow
                    key={task.id}
                    index={i}
                    task={task}
                    onToggle={() => toggleTask(task)}
                    onRename={(t) => renameTask(task, t)}
                    onDelete={() => deleteTask(task)}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>

        <footer className="tally">
          <div className="rule" />
          <div className="tally-row">
            <span className="tally-item">
              <em>{pad(pending)}</em> pendientes
            </span>
            <span className="tally-sep">/</span>
            <span className="tally-item tally-item--done">
              <em>{pad(done)}</em> completadas
            </span>
            <span className="tally-grow" />
            <span className="tally-total">{pad(tasks.length)} en total</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
