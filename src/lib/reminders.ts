// Reminder kinds and their defaults (times are Asia/Kolkata).

export type ReminderKind =
  | "briefing"
  | "journal"
  | "habits"
  | "gym"
  | "money"
  | "spend_pin"
  | "plan";

export type ReminderSetting = {
  kind: ReminderKind;
  enabled: boolean;
  hour: number;
  minute: number;
};

export const REMINDERS: {
  kind: ReminderKind;
  title: string;
  hint: string;
  emoji: string;
  hour: number;
  minute: number;
}[] = [
  {
    kind: "briefing",
    title: "Morning briefing",
    hint: "Your assistant's summary of money, gym and habits",
    emoji: "☀️",
    hour: 6,
    minute: 0,
  },
  {
    kind: "plan",
    title: "Today's plan",
    hint: "Your plan tasks for the day, if you have any",
    emoji: "🗓️",
    hour: 7,
    minute: 0,
  },
  {
    kind: "gym",
    title: "Workout",
    hint: "Only on days your plan has a workout you haven't started",
    emoji: "🏋️",
    hour: 17,
    minute: 30,
  },
  {
    kind: "money",
    title: "Log spending",
    hint: "Only if nothing was logged that day",
    emoji: "💸",
    hour: 21,
    minute: 0,
  },
  {
    kind: "habits",
    title: "Habit check-in",
    hint: "Only habits you haven't marked yet",
    emoji: "✅",
    hour: 21,
    minute: 30,
  },
  {
    kind: "journal",
    title: "Journal",
    hint: "Only if the day's journal is still empty",
    emoji: "📝",
    hour: 22,
    minute: 0,
  },
];

// Not a timed reminder: a card that sits in the notification shade
export const PINNED = {
  kind: "spend_pin" as const,
  title: "Keep today's spending pinned",
  hint: "A card in your notification shade with today's total and a + button to add an entry",
  emoji: "📌",
};

export const defaultSettings = (): ReminderSetting[] => [
  ...REMINDERS.map((r) => ({
    kind: r.kind,
    enabled: r.kind === "briefing",
    hour: r.hour,
    minute: r.minute,
  })),
  { kind: PINNED.kind, enabled: false, hour: 0, minute: 0 },
];

export const timeLabel = (hour: number, minute: number) =>
  `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
