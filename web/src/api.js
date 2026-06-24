// Cliente del API de tareas (Lambda Function URL).
// La base se inyecta en build/dev vía VITE_API_URL.
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

if (!BASE) {
  // Aviso temprano si falta la variable de entorno.
  console.warn("VITE_API_URL no está definida. Configúrala en .env (local) o en Vercel.");
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = data?.error || "";
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new Error(detail || `Error ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  list: () => request("/tasks"),
  create: (title) =>
    request("/tasks", { method: "POST", body: JSON.stringify({ title }) }),
  update: (id, patch) =>
    request(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  remove: (id) => request(`/tasks/${id}`, { method: "DELETE" }),
};
