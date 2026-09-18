// Spotting the assistant's name in what the browser heard. "Romi" isn't a
// dictionary word, so speech engines write it as Rome, Romy, Roomie, Rummy,
// Remy, Ronnie, "row me", रोमी… Words are compared by how they sound, not
// how they're spelled.

// Devanagari → rough Latin, enough to compare sounds
const DEVA_CONSONANTS: Record<string, string> = {
  क: "k", ख: "k", ग: "g", घ: "g", च: "c", छ: "c", ज: "j", झ: "j", ट: "t", ठ: "t",
  ड: "d", ढ: "d", ण: "n", त: "t", थ: "t", द: "d", ध: "d", न: "n", प: "p", फ: "f",
  ब: "b", भ: "b", म: "m", य: "y", र: "r", ल: "l", व: "v", श: "s", ष: "s", स: "s",
  ह: "h",
};
const DEVA_VOWELS: Record<string, string> = {
  अ: "a", आ: "a", इ: "i", ई: "i", उ: "u", ऊ: "u", ए: "e", ऐ: "e", ओ: "o", औ: "o", ऑ: "o",
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "े": "e", "ै": "e", "ो": "o", "ौ": "o",
  "ॉ": "o", "ृ": "ri", "ं": "n", "ँ": "n",
};
const DEVA_SIGNS = /[़्]/; // nukta, virama

function latin(word: string) {
  let out = "";
  const chars = [...word];
  chars.forEach((c, i) => {
    if (DEVA_CONSONANTS[c]) {
      out += DEVA_CONSONANTS[c];
      const next = chars[i + 1];
      // The consonant's own "a", unless a vowel sign or virama follows or the word ends
      if (next && !DEVA_VOWELS[next] && !DEVA_SIGNS.test(next)) out += "a";
    } else if (DEVA_VOWELS[c]) out += DEVA_VOWELS[c];
    else if (!DEVA_SIGNS.test(c)) out += c;
  });
  return out;
}

// A sound key: a/o/u → A, e/i/y → E, doubled letters and silent w/h dropped.
// romi, rome, roomy, rummy, rami, रोमी → rAmE
function soundKey(word: string) {
  let w = latin(word.toLowerCase())
    .normalize("NFKD")
    .replace(/[^a-z]/g, "")
    .replace(/ph/g, "f")
    .replace(/ck|q/g, "k")
    .replace(/([aeiouy])[wh]+(?![aeiouy])/g, "$1") // row me, oh
    .replace(/y(?![aeiou])/g, "i");
  w = w.replace(/[aou]/g, "A").replace(/[eiy]/g, "E");
  return w.replace(/(.)\1+/g, "$1");
}

const VOWEL = /[AE]/;
// Sounds engines confuse in a name
const CLOSE = ["mn", "bp", "dt", "gk", "sz", "vw", "fv"];

function closeEnough(heard: string, name: string) {
  if (heard === name) return true;
  if (!heard || heard[0] !== name[0]) return false;
  if (heard.length === name.length) {
    const diffs = [...heard].flatMap((c, i) => (c === name[i] ? [] : [i]));
    if (diffs.length !== 1) return false;
    const [a, b] = [heard[diffs[0]], name[diffs[0]]];
    return (VOWEL.test(a) && VOWEL.test(b)) || CLOSE.some((p) => p.includes(a) && p.includes(b));
  }
  // One extra or missing sound, for longer names only ("Jarvis" / "Jarvish")
  if (name.length < 5 || Math.abs(heard.length - name.length) !== 1) return false;
  const [long, short] = heard.length > name.length ? [heard, name] : [name, heard];
  for (let i = 0; i < long.length; i++)
    if (long.slice(0, i) + long.slice(i + 1) === short) return true;
  return false;
}

const WORD = /[\p{L}\p{M}']+/gu;
// She's called near the start of what's said ("hey Romi…", "ok so Romi…");
// a sound-alike later in a sentence ("…back from Rome") isn't a call
const LEADING_WORDS = 4;

// Returns a function giving what was said after the name ("" if just the
// name), or null if the name wasn't said
export function wakeMatcher(name: string) {
  const plain = name.toLowerCase().trim();
  const nameKey = soundKey(plain.replace(/\s+/g, ""));
  if (nameKey.length < 2) return null;
  const nameWords = plain.split(/\s+/).length;

  return (text: string): string | null => {
    const words = [...text.matchAll(WORD)];
    for (let i = 0; i < words.length; i++) {
      // The name may come back split in two ("row me", "Ro mi")
      for (const span of [nameWords, nameWords + 1]) {
        const parts = words.slice(i, i + span);
        if (parts.length < span) continue;
        const said = parts.map((p) => p[0]).join(" ").toLowerCase();
        const exact = said === plain;
        if (!exact && (i >= LEADING_WORDS || !closeEnough(soundKey(said.replace(/\s+/g, "")), nameKey)))
          continue;
        const last = parts[parts.length - 1];
        return text
          .slice(last.index + last[0].length)
          .replace(/^[\s,.!?:;।-]+/, "")
          .trim();
      }
    }
    return null;
  };
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
