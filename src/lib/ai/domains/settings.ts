import "server-only";
import { renameAssistant } from "@/lib/assistant-memory";
import { tool } from "ai";
import { z } from "zod";
import { saveReminder, updateProfile } from "@/app/(dashboard)/settings/actions";
import { getBodyProfile } from "@/lib/health-queries";
import { defaultSettings, REMINDERS, type ReminderSetting } from "@/lib/reminders";
import { changed, failed, type Domain } from "./common";

const KINDS = REMINDERS.map((r) => r.kind) as [ReminderSetting["kind"], ...ReminderSetting["kind"][]];

async function reminders(ctx: Parameters<Domain["tools"]>[0]) {
  const { data } = await ctx.supabase
    .from("reminder_settings")
    .select("kind, enabled, hour, minute")
    .returns<ReminderSetting[]>();
  return defaultSettings().map((d) => data?.find((s) => s.kind === d.kind) ?? d);
}

const time = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

export const settings: Domain = {
  labels: {
    get_settings: "Checking your settings…",
    set_reminder: "Updating your reminders…",
    update_profile_name: "Updating your profile…",
    rename_assistant: "Changing my name…",
    set_theme: "Switching the theme…",
  },
  prompt: `SETTINGS
- Notification reminders (times are India time, 24h): ${REMINDERS.map((r) => `${r.kind} = ${r.title}`).join("; ")}.
- set_theme switches the app between light and dark mode on this device right away.
- The password, photo and uploaded files are changed in Settings by the user; point them there.`,
  tools: (ctx) => ({
    get_settings: tool({
      description: "Reminder settings (on/off and time), profile name/email, and body details.",
      inputSchema: z.object({}),
      execute: async () => {
        const [list, body] = await Promise.all([reminders(ctx), getBodyProfile()]);
        return {
          profile: { name: ctx.profile.full_name, email: ctx.profile.email, hasPhoto: Boolean(ctx.profile.avatar_path) },
          reminders: list.map((r) => ({
            kind: r.kind,
            title: REMINDERS.find((x) => x.kind === r.kind)?.title,
            enabled: r.enabled,
            time: time(r.hour, r.minute),
          })),
          bodyDetails: body,
        };
      },
    }),

    set_reminder: tool({
      description: "Turn a reminder on or off and/or change its time.",
      inputSchema: z.object({
        kind: z.enum(KINDS),
        enabled: z.boolean().optional(),
        time: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/).optional().describe("HH:MM, 24-hour, India time"),
      }),
      execute: async ({ kind, enabled, time: at }) => {
        const current = (await reminders(ctx)).find((r) => r.kind === kind)!;
        const [hour, minute] = at ? at.split(":").map(Number) : [current.hour, current.minute];
        const next = { kind, enabled: enabled ?? current.enabled, hour, minute };
        const result = await saveReminder(next);
        if (!result.ok) return failed(result.error);
        const title = REMINDERS.find((r) => r.kind === kind)?.title ?? kind;
        return changed(ctx, `${title}: ${next.enabled ? `on at ${time(hour, minute)}` : "off"}.`);
      },
    }),

    rename_assistant: tool({
      description: "Change the assistant's own name (what the user calls you; also the hands-free wake word).",
      inputSchema: z.object({ name: z.string().min(1).max(20) }),
      execute: async ({ name }) => {
        const result = await renameAssistant(ctx.supabase, name);
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Your assistant is now called ${name}.`);
      },
    }),

    update_profile_name: tool({
      description: "Change the name shown in the app.",
      inputSchema: z.object({ name: z.string().min(1).max(80) }),
      execute: async ({ name }) => {
        const result = await updateProfile({ fullName: name, avatarPath: ctx.profile.avatar_path });
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Name changed to ${name}.`);
      },
    }),

    set_theme: tool({
      description: "Switch the app to light or dark mode.",
      inputSchema: z.object({ theme: z.enum(["light", "dark"]) }),
      execute: async ({ theme }) => {
        ctx.emit({ kind: "theme", value: theme });
        return { done: true, summary: `Switched to ${theme} mode.` };
      },
    }),
  }),
};
