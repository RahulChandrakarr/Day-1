// Spotting the assistant's name in what the browser heard. Speech engines
// spell names loosely ("Romi" comes back as Romy, Romee, Roomie, रोमी…),
// so the match is forgiving about doubled letters and the ending sound.

const SCRIPT_ALIASES: Record<string, string[]> = {
  romi: ["रोमी", "रूमी"],
};

const NOT_LETTER = "[^\\p{L}\\p{M}]";

export function wakePattern(name: string): RegExp | null {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z]/g, "");
  if (base.length < 2) return null;
  const ending = /(ie|ee|ey|y|i)$/;
  const stem = base.replace(ending, "");
  const letters = stem
    .split("")
    .map((c) => `${c}+`)
    .join("");
  const tail = ending.test(base) ? "(?:ie|ee|ey|y|i)" : "";
  const spellings = [`${letters}${tail}`, ...(SCRIPT_ALIASES[base] ?? [])];
  return new RegExp(`(?:^|${NOT_LETTER})(?:${spellings.join("|")})(?=$|${NOT_LETTER})`, "iu");
}

// What was said after the name ("" if just the name), or null if the name
// wasn't said at all
export function afterName(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text);
  if (!match) return null;
  return text
    .slice(match.index + match[0].length)
    .replace(/^[\s,.!?:;-]+/, "")
    .trim();
}

const STOP_PHRASES = [
  "no",
  "nope",
  "nah",
  "nothing",
  "thanks",
  "thank you",
  "ok thanks",
  "okay thanks",
  "bye",
  "goodbye",
  "good bye",
  "stop",
  "cancel",
  "that's all",
  "thats all",
  "that's it",
  "nahi",
  "nahin",
  "bas",
  "shukriya",
  "dhanyavad",
  "dhanyawad",
  "नहीं",
  "बस",
  "धन्यवाद",
  "शुक्रिया",
];

// "Thanks", "no, that's all", "bye Romi": ends the conversation, no AI call
export function isStopPhrase(text: string) {
  const t = text.toLowerCase().replace(/[.,!?।]/g, "").replace(/\s+/g, " ").trim();
  if (!t || t.split(" ").length > 4) return false;
  return STOP_PHRASES.some((p) => t === p || t.startsWith(`${p} `));
}
