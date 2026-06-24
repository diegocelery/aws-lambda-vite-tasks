import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaskRow from "../TaskRow.jsx";

const baseTask = { id: "1", title: "Original", completed: false };

const noop = () => {};

// TaskRow es un <li>; se renderiza dentro de un <ul> para HTML válido.
const renderRow = (props) =>
  render(
    <ul>
      <TaskRow
        task={baseTask}
        index={0}
        onToggle={noop}
        onRename={noop}
        onDelete={noop}
        {...props}
      />
    </ul>
  );

it("llama onToggle al pulsar el checkbox", async () => {
  const onToggle = vi.fn();
  renderRow({ onToggle });
  await userEvent.click(screen.getByRole("button", { name: /completada/i }));
  expect(onToggle).toHaveBeenCalledTimes(1);
});

it("edita el título y llama onRename con el nuevo valor", async () => {
  const onRename = vi.fn();
  renderRow({ onRename });

  await userEvent.click(screen.getByRole("button", { name: /^Editar$/i }));
  const input = screen.getByLabelText(/Editar título/i);
  await userEvent.clear(input);
  await userEvent.type(input, "Cambiado{enter}");

  expect(onRename).toHaveBeenCalledWith("Cambiado");
});

it("cancela la edición con Escape sin llamar onRename", async () => {
  const onRename = vi.fn();
  renderRow({ onRename });

  await userEvent.click(screen.getByRole("button", { name: /^Editar$/i }));
  await userEvent.type(screen.getByLabelText(/Editar título/i), "X{escape}");

  expect(onRename).not.toHaveBeenCalled();
});

it("llama onDelete al pulsar Eliminar", async () => {
  const onDelete = vi.fn();
  renderRow({ onDelete });
  await userEvent.click(screen.getByRole("button", { name: /Eliminar/i }));
  expect(onDelete).toHaveBeenCalledTimes(1);
});
