"use client";

import { useOptimistic, useTransition } from "react";
import { setTodoDone } from "@/app/(dashboard)/daily/actions";
import { CardList } from "@/components/ui/kit";

export type Todo = { text: string; done: boolean; index: number };

// Today's open to-dos (the journal's priorities), ticked straight from Overview.
export default function TodoList({ date, todos }: { date: string; todos: Todo[] }) {
  const [, startTransition] = useTransition();
  const [list, tick] = useOptimistic(todos, (current: Todo[], index: number) =>
    current.map((t) => (t.index === index ? { ...t, done: !t.done } : t)),
  );

  return (
    <CardList className="px-4">
      {list.map((todo) => (
        <li
          key={todo.index}
          className="flex min-h-11 items-center gap-3 border-b border-paper/[0.06] py-1.5 last:border-0"
        >
          <button
            type="button"
            role="checkbox"
            aria-checked={todo.done}
            aria-label={`Mark "${todo.text}" done`}
            onClick={() =>
              startTransition(async () => {
                tick(todo.index);
                await setTodoDone(date, todo.index, todo.text, !todo.done);
              })
            }
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[13px] transition ${
              todo.done
                ? "border-moss bg-moss text-white"
                : "border-paper/25 hover:border-paper/50"
            }`}
          >
            {todo.done && "✓"}
          </button>
          <span
            className={`min-w-0 flex-1 text-[15px] ${
              todo.done ? "text-paper/55 line-through" : ""
            }`}
          >
            {todo.text}
          </span>
        </li>
      ))}
    </CardList>
  );
}
