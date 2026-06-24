import { test } from "node:test";
import assert from "node:assert/strict";

// E2E contra la API REAL desplegada. Define la URL del backend:
//   API_URL=https://....lambda-url.us-east-2.on.aws  npm run test:e2e
// (también acepta VITE_API_URL). Sin URL, los tests se saltan.
const API = (process.env.API_URL || process.env.VITE_API_URL || "").replace(/\/+$/, "");
const skip = API ? false : "Define API_URL (o VITE_API_URL) para ejecutar los e2e.";

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
}

test("CRUD completo contra la API real", { skip }, async () => {
  const title = `e2e ${Date.now()}`;

  // CREATE
  const created = await call("POST", "/tasks", { title });
  assert.equal(created.status, 201);
  assert.equal(created.data.title, title);
  assert.equal(created.data.completed, false);
  const id = created.data.id;
  assert.ok(id, "debe devolver un id");

  try {
    // LIST contiene la tarea creada
    const list = await call("GET", "/tasks");
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.data));
    assert.ok(list.data.some((t) => t.id === id), "la lista debe contener la tarea");

    // UPDATE -> completada
    const upd = await call("PUT", `/tasks/${id}`, { completed: true });
    assert.equal(upd.status, 200);
    assert.equal(upd.data.completed, true);

    // GET refleja el cambio
    const got = await call("GET", `/tasks/${id}`);
    assert.equal(got.status, 200);
    assert.equal(got.data.completed, true);
  } finally {
    // DELETE siempre (limpieza), aunque algo falle arriba
    const del = await call("DELETE", `/tasks/${id}`);
    assert.equal(del.status, 200);
  }

  // Confirma que ya no existe
  const after = await call("GET", `/tasks/${id}`);
  assert.equal(after.status, 404);
});

test("GET /tasks/{id} inexistente -> 404", { skip }, async () => {
  const res = await call("GET", "/tasks/no-existe-000");
  assert.equal(res.status, 404);
});

test("POST /tasks sin title -> 400", { skip }, async () => {
  const res = await call("POST", "/tasks", {});
  assert.equal(res.status, 400);
});
