"use client";

import { useState, useTransition } from "react";
import { savePlanReflection } from "@/app/(dashboard)/plan/actions";

// Five short questions about today's plan. Answers stay on that day.
export default function PlanQuestions({
  date,
  questions,
  answers,
}: {
  date: string;
  questions: string[];
  answers: string[];
}) {
  const [values, setValues] = useState(answers);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(next: string[]) {
    startTransition(async () => {
      const result = await savePlanReflection(date, next);
      setSaved(result.ok);
    });
  }

  return (
    <ol className="flex flex-col gap-2 border-t border-paper/[0.06] px-1 py-3">
      {questions.map((question, index) => (
        <li key={question} className="flex flex-col gap-1">
          <label className="text-[13px] text-paper/78" htmlFor={`plan-q-${index}`}>
            {index + 1}. {question}
          </label>
          <input
            id={`plan-q-${index}`}
            value={values[index] ?? ""}
            maxLength={200}
            placeholder="A line is enough"
            onChange={(e) => {
              const next = [...values];
              next[index] = e.target.value;
              setValues(next);
              setSaved(false);
            }}
            onBlur={() => save(values)}
            className="h-9 rounded-lg border border-paper/10 bg-inset px-2.5 text-sm outline-none focus:border-ember/70"
          />
        </li>
      ))}
      <p className="text-[11px] text-paper/55">
        {pending ? "Saving…" : saved ? "Saved" : "Answer in a line. It saves when you leave the box."}
      </p>
    </ol>
  );
}
