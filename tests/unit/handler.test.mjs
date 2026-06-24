import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

// Mock del cliente de DynamoDB: ningún test toca AWS real.
const ddbMock = mockClient(DynamoDBDocumentClient);

process.env.TABLE_NAME = "tasks-test";
const { handler } = await import("../../lambda/index.mjs");

// Construye un evento con el formato de la Lambda Function URL (payload v2.0).
const event = (method, rawPath, body) => ({
  requestContext: { http: { method } },
  rawPath,
  ...(body !== undefined
    ? { body: typeof body === "string" ? body : JSON.stringify(body) }
    : {}),
});

const json = (res) => (res.body ? JSON.parse(res.body) : null);

beforeEach(() => ddbMock.reset());

test("GET /tasks devuelve la lista ordenada por createdAt desc", async () => {
  ddbMock.on(ScanCommand).resolves({
    Items: [
      { id: "a", title: "vieja", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", title: "nueva", createdAt: "2026-06-01T00:00:00.000Z" },
    ],
  });
  const res = await handler(event("GET", "/tasks"));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    json(res).map((t) => t.id),
    ["b", "a"]
  );
});

test("la respuesta NO incluye cabeceras CORS (las pone la Function URL)", async () => {
  ddbMock.on(ScanCommand).resolves({ Items: [] });
  const res = await handler(event("GET", "/tasks"));
  const keys = Object.keys(res.headers).map((k) => k.toLowerCase());
  assert.ok(!keys.some((k) => k.startsWith("access-control-")));
  assert.equal(res.headers["Content-Type"], "application/json");
});

test("POST /tasks crea con 201, title recortado y completed=false", async () => {
  ddbMock.on(PutCommand).resolves({});
  const res = await handler(event("POST", "/tasks", { title: "  comprar pan  " }));
  assert.equal(res.statusCode, 201);
  const item = json(res);
  assert.equal(item.title, "comprar pan");
  assert.equal(item.completed, false);
  assert.ok(item.id);
  assert.ok(item.createdAt);
  assert.equal(ddbMock.commandCalls(PutCommand).length, 1);
});

test("POST /tasks sin title -> 400", async () => {
  const res = await handler(event("POST", "/tasks", { title: "   " }));
  assert.equal(res.statusCode, 400);
});

test("POST /tasks con JSON inválido -> 400", async () => {
  const res = await handler(event("POST", "/tasks", "{ esto no es json"));
  assert.equal(res.statusCode, 400);
});

test("GET /tasks/{id} existente -> 200", async () => {
  ddbMock.on(GetCommand).resolves({ Item: { id: "x", title: "t" } });
  const res = await handler(event("GET", "/tasks/x"));
  assert.equal(res.statusCode, 200);
  assert.equal(json(res).id, "x");
});

test("GET /tasks/{id} inexistente -> 404", async () => {
  ddbMock.on(GetCommand).resolves({});
  const res = await handler(event("GET", "/tasks/nope"));
  assert.equal(res.statusCode, 404);
});

test("PUT /tasks/{id} actualiza title y completed -> 200", async () => {
  ddbMock.on(GetCommand).resolves({ Item: { id: "x", title: "old", completed: false } });
  ddbMock.on(UpdateCommand).resolves({
    Attributes: { id: "x", title: "new", completed: true },
  });
  const res = await handler(event("PUT", "/tasks/x", { title: "new", completed: true }));
  assert.equal(res.statusCode, 200);
  const item = json(res);
  assert.equal(item.title, "new");
  assert.equal(item.completed, true);
});

test("PUT /tasks/{id} inexistente -> 404", async () => {
  ddbMock.on(GetCommand).resolves({});
  const res = await handler(event("PUT", "/tasks/x", { completed: true }));
  assert.equal(res.statusCode, 404);
});

test("PUT /tasks/{id} con completed no booleano -> 400", async () => {
  ddbMock.on(GetCommand).resolves({ Item: { id: "x" } });
  const res = await handler(event("PUT", "/tasks/x", { completed: "sí" }));
  assert.equal(res.statusCode, 400);
});

test("DELETE /tasks/{id} existente -> 200", async () => {
  ddbMock.on(GetCommand).resolves({ Item: { id: "x" } });
  ddbMock.on(DeleteCommand).resolves({});
  const res = await handler(event("DELETE", "/tasks/x"));
  assert.equal(res.statusCode, 200);
  assert.equal(json(res).deleted, "x");
});

test("DELETE /tasks/{id} inexistente -> 404", async () => {
  ddbMock.on(GetCommand).resolves({});
  const res = await handler(event("DELETE", "/tasks/x"));
  assert.equal(res.statusCode, 404);
});

test("ruta desconocida -> 404", async () => {
  const res = await handler(event("GET", "/otra-cosa"));
  assert.equal(res.statusCode, 404);
});

test("OPTIONS -> 204", async () => {
  const res = await handler(event("OPTIONS", "/tasks"));
  assert.equal(res.statusCode, 204);
});
