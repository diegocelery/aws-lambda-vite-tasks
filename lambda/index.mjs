import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const res = (statusCode, body) => ({
  statusCode,
  headers: CORS,
  body: body === undefined ? "" : JSON.stringify(body),
});

const parseBody = (event) => {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf-8")
    : event.body;
  return JSON.parse(raw);
};

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? "GET";
  const path = event.rawPath ?? "/";
  const segments = path.split("/").filter(Boolean); // ["tasks"] o ["tasks", "{id}"]

  try {
    if (method === "OPTIONS") return res(204);

    // /tasks
    if (segments[0] === "tasks" && segments.length === 1) {
      if (method === "GET") return await listTasks();
      if (method === "POST") return await createTask(event);
    }

    // /tasks/{id}
    if (segments[0] === "tasks" && segments.length === 2) {
      const id = segments[1];
      if (method === "GET") return await getTask(id);
      if (method === "PUT") return await updateTask(id, event);
      if (method === "DELETE") return await deleteTask(id);
    }

    return res(404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    return res(500, { error: "Internal server error" });
  }
};

async function listTasks() {
  const out = await ddb.send(new ScanCommand({ TableName: TABLE }));
  const items = (out.Items ?? []).sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
  );
  return res(200, items);
}

async function createTask(event) {
  let data;
  try {
    data = parseBody(event);
  } catch {
    return res(400, { error: "Invalid JSON body" });
  }

  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) return res(400, { error: "title is required" });

  const now = new Date().toISOString();
  const item = {
    id: randomUUID(),
    title,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return res(201, item);
}

async function getTask(id) {
  const out = await ddb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
  if (!out.Item) return res(404, { error: "Task not found" });
  return res(200, out.Item);
}

async function updateTask(id, event) {
  let data;
  try {
    data = parseBody(event);
  } catch {
    return res(400, { error: "Invalid JSON body" });
  }

  const existing = await ddb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
  if (!existing.Item) return res(404, { error: "Task not found" });

  const sets = ["updatedAt = :updatedAt"];
  const values = { ":updatedAt": new Date().toISOString() };
  const names = {};

  if (data.title !== undefined) {
    const title = typeof data.title === "string" ? data.title.trim() : "";
    if (!title) return res(400, { error: "title cannot be empty" });
    sets.push("#title = :title");
    names["#title"] = "title";
    values[":title"] = title;
  }

  if (data.completed !== undefined) {
    if (typeof data.completed !== "boolean") {
      return res(400, { error: "completed must be a boolean" });
    }
    sets.push("completed = :completed");
    values[":completed"] = data.completed;
  }

  const out = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { id },
      UpdateExpression: "SET " + sets.join(", "),
      ExpressionAttributeValues: values,
      ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
      ReturnValues: "ALL_NEW",
    })
  );
  return res(200, out.Attributes);
}

async function deleteTask(id) {
  const existing = await ddb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
  if (!existing.Item) return res(404, { error: "Task not found" });

  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
  return res(200, { deleted: id });
}
