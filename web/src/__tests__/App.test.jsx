import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock del cliente del API: los tests no hacen red.
vi.mock("../api.js", () => ({
  api: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

import { api } from "../api.js";
import App from "../App.jsx";

const task = (over = {}) => ({
  id: "1",
  title: "Tarea A",
  completed: false,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

it("muestra el título y carga la lista", async () => {
  api.list.mockResolvedValue([task()]);
  render(<App />);
  expect(screen.getByRole("heading", { name: /Quehaceres/i })).toBeInTheDocument();
  expect(await screen.findByText("Tarea A")).toBeInTheDocument();
});

it("muestra el estado vacío cuando no hay tareas", async () => {
  api.list.mockResolvedValue([]);
  render(<App />);
  expect(await screen.findByText(/La hoja está en blanco/i)).toBeInTheDocument();
});

it("crea una tarea nueva", async () => {
  api.list.mockResolvedValue([]);
  api.create.mockResolvedValue(task({ id: "2", title: "Nueva" }));
  render(<App />);
  await screen.findByText(/La hoja está en blanco/i);

  await userEvent.type(
    screen.getByPlaceholderText(/Escribe una tarea/i),
    "Nueva{enter}"
  );

  expect(api.create).toHaveBeenCalledWith("Nueva");
  expect(await screen.findByText("Nueva")).toBeInTheDocument();
});

it("muestra un banner de error si falla la carga", async () => {
  api.list.mockRejectedValue(new Error("boom"));
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/boom/i);
});

it("marca una tarea como completada", async () => {
  api.list.mockResolvedValue([task()]);
  api.update.mockResolvedValue(task({ completed: true }));
  render(<App />);
  await screen.findByText("Tarea A");

  await userEvent.click(screen.getByRole("button", { name: /completada/i }));

  expect(api.update).toHaveBeenCalledWith("1", { completed: true });
});

it("elimina una tarea", async () => {
  api.list.mockResolvedValue([task()]);
  api.remove.mockResolvedValue({ deleted: "1" });
  render(<App />);
  await screen.findByText("Tarea A");

  await userEvent.click(screen.getByRole("button", { name: /Eliminar/i }));

  await waitFor(() => expect(api.remove).toHaveBeenCalledWith("1"));
});
