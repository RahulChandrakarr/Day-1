"use client";

import { Extension, type Editor, type Range } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Suggestion, { type SuggestionKeyDownProps } from "@tiptap/suggestion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { deleteNote, saveNote } from "@/app/(dashboard)/plan/actions";
import VoiceInput from "@/components/journal/voice-input";
import type { Note } from "@/lib/plans";

type Block = {
  label: string;
  hint: string;
  icon: string;
  keywords: string;
  run: (editor: Editor) => void;
};

// Everything the "/" menu and the toolbar can turn a line into
const BLOCKS: Block[] = [
  { label: "Text", hint: "Plain paragraph", icon: "¶", keywords: "text paragraph plain", run: (e) => e.chain().focus().setParagraph().run() },
  { label: "Heading 1", hint: "Big section title", icon: "H1", keywords: "h1 heading title", run: (e) => e.chain().focus().setHeading({ level: 1 }).run() },
  { label: "Heading 2", hint: "Medium title", icon: "H2", keywords: "h2 heading subtitle", run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { label: "Heading 3", hint: "Small title", icon: "H3", keywords: "h3 heading", run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  { label: "To-do list", hint: "Checkboxes to tick off", icon: "☑", keywords: "todo task checkbox check list", run: (e) => e.chain().focus().toggleTaskList().run() },
  { label: "Bulleted list", hint: "Simple list", icon: "•", keywords: "bullet list unordered", run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: "Numbered list", hint: "1, 2, 3", icon: "1.", keywords: "number ordered list", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: "Quote", hint: "Pull something out", icon: "❝", keywords: "quote blockquote", run: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: "Code", hint: "Monospaced block", icon: "</>", keywords: "code snippet", run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { label: "Divider", hint: "A line across", icon: "—", keywords: "divider line rule separator hr", run: (e) => e.chain().focus().setHorizontalRule().run() },
];

type SlashState = {
  items: Block[];
  index: number;
  rect: DOMRect | null;
  pick: (block: Block) => void;
};

// "/" opens the block menu. The suggestion plugin drives this small store and
// React renders the menu from it.
function createSlashMenu() {
  let state: SlashState | null = null;
  const listeners = new Set<() => void>();
  const set = (next: SlashState | null) => {
    state = next;
    listeners.forEach((l) => l());
  };

  const extension = Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion<Block, Block>({
          editor: this.editor,
          char: "/",
          allowedPrefixes: null,
          items: ({ query }) => {
            const q = query.toLowerCase();
            return BLOCKS.filter(
              (b) => b.label.toLowerCase().includes(q) || b.keywords.includes(q),
            );
          },
          command: ({ editor, range, props }: { editor: Editor; range: Range; props: Block }) => {
            editor.chain().focus().deleteRange(range).run();
            props.run(editor);
          },
          render: () => ({
            onStart: (p) =>
              set({ items: p.items, index: 0, rect: p.clientRect?.() ?? null, pick: p.command }),
            onUpdate: (p) =>
              set({ items: p.items, index: 0, rect: p.clientRect?.() ?? null, pick: p.command }),
            onKeyDown: ({ event }: SuggestionKeyDownProps) => {
              if (!state || state.items.length === 0) return false;
              const n = state.items.length;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                const step = event.key === "ArrowDown" ? 1 : -1;
                set({ ...state, index: (state.index + step + n) % n });
                return true;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                state.pick(state.items[state.index]);
                return true;
              }
              if (event.key === "Escape") {
                set(null);
                return true;
              }
              return false;
            },
            onExit: () => set(null),
          }),
        }),
      ];
    },
  });

  return {
    extension,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => state,
    hover: (index: number) => state && set({ ...state, index }),
  };
}

const stamp = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

type SaveState = "saved" | "dirty" | "saving" | "error";

export default function NoteEditor({ note }: { note: Note | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(note?.title ?? "");
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [status, setStatus] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(note?.updated_at ?? null);
  const [deleting, startDelete] = useTransition();
  const [slash] = useState(createSlashMenu);
  const menu = useSyncExternalStore(slash.subscribe, slash.get, () => null);
  // The row id once the note exists; a ref so an in-flight first save is seen
  const idRef = useRef(note?.id);
  const saving = useRef<Promise<void> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading" ? "Heading" : "Write, or type / for blocks…",
      }),
      Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
      slash.extension,
    ],
    content: note?.body ?? "",
    contentType: "markdown",
    editorProps: {
      attributes: { class: "note-content", "aria-label": "Note" },
    },
    onUpdate: () => setStatus("dirty"),
  });

  const save = useCallback(async () => {
    if (!editor) return;
    if (saving.current) await saving.current;
    const id = idRef.current;
    const body = editor.isEmpty ? "" : editor.getMarkdown();
    if (!id && !title.trim() && !body.trim()) {
      setStatus("saved");
      return;
    }
    setStatus("saving");
    saving.current = (async () => {
      const result = await saveNote({ id, title, body, pinned });
      if (!result.ok) {
        setError(result.error);
        setStatus("error");
        return;
      }
      setError(null);
      setSavedAt(new Date().toISOString());
      setStatus((s) => (s === "saving" ? "saved" : s));
      if (!id) {
        idRef.current = result.id;
        window.history.replaceState(null, "", `/plan/notes/${result.id}`);
      }
    })();
    await saving.current;
    saving.current = null;
  }, [editor, title, pinned]);

  // Autosave a moment after typing stops
  useEffect(() => {
    if (status !== "dirty") return;
    const timer = setTimeout(save, 900);
    return () => clearTimeout(timer);
  }, [status, save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  async function back() {
    if (status === "dirty" || status === "saving") await save();
    router.push("/plan/notes");
    router.refresh();
  }

  function remove() {
    const id = idRef.current;
    if (!id) {
      router.push("/plan/notes");
      return;
    }
    if (!confirm("Delete this note?")) return;
    startDelete(async () => {
      const result = await deleteNote(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus("saved");
      router.push("/plan/notes");
      router.refresh();
    });
  }

  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "dirty"
        ? "Unsaved"
        : status === "error"
          ? "Not saved"
          : savedAt
            ? `Saved · ${stamp.format(new Date(savedAt))}`
            : "New note";

  return (
    <article className="flex min-w-0 flex-col card">
      <header className="flex items-center gap-2 border-b border-paper/10 px-3 py-2 sm:px-5">
        <button
          type="button"
          onClick={back}
          className="rounded-xl px-2 py-1.5 text-sm text-paper/72 transition hover:bg-paper/5 hover:text-paper"
        >
          ← All notes
        </button>
        <span
          className={`ml-auto text-xs ${status === "error" ? "text-red-700 dark:text-red-300" : "text-paper/55"}`}
          aria-live="polite"
        >
          {statusText}
        </span>
        <button
          type="button"
          onClick={() => {
            setPinned(!pinned);
            setStatus("dirty");
          }}
          aria-pressed={pinned}
          title={pinned ? "Unpin" : "Pin to top"}
          className={`rounded-xl px-2 py-1.5 text-sm transition ${pinned ? "bg-ember/15" : "opacity-50 hover:bg-paper/5 hover:opacity-100"}`}
        >
          📌
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          className="rounded-xl px-2 py-1.5 text-sm text-paper/65 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
        >
          Delete
        </button>
      </header>

      {editor && <Toolbar editor={editor} />}

      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-8 sm:pt-10">
        <input
          autoFocus={!note}
          value={title}
          maxLength={120}
          onChange={(e) => {
            setTitle(e.target.value);
            setStatus("dirty");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              editor?.commands.focus("start");
            }
          }}
          placeholder="Untitled"
          className="w-full bg-transparent font-bold tracking-tight text-4xl leading-tight text-paper outline-none placeholder:text-paper/40 sm:text-5xl"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="mt-6">
          <EditorContent editor={editor} />
        </div>
      </div>

      {editor && <SelectionMenu editor={editor} />}

      {menu && menu.rect && (
        <SlashMenu
          menu={menu}
          onHover={slash.hover}
        />
      )}
    </article>
  );
}

// Sticky row of formatting controls, for touch screens and discovery
function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      highlight: editor.isActive("highlight"),
      h1: editor.isActive("heading", { level: 1 }),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      task: editor.isActive("taskList"),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      quote: editor.isActive("blockquote"),
      code: editor.isActive("codeBlock"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  return (
    <div className="sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto border-b border-glass-edge bg-glass-strong px-2 py-1.5 backdrop-blur-xl sm:px-4">
      <Tool label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!s.canUndo}><span className="text-base">↺</span></Tool>
      <Tool label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!s.canRedo}><span className="text-base">↻</span></Tool>
      <Divider />
      <Tool label="Heading 1" active={s.h1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Tool>
      <Tool label="Heading 2" active={s.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Tool>
      <Tool label="Heading 3" active={s.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Tool>
      <Divider />
      <Tool label="Bold (⌘B)" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <b>B</b>
      </Tool>
      <Tool label="Italic (⌘I)" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <i className="font-bold tracking-tight text-base">I</i>
      </Tool>
      <Tool label="Underline (⌘U)" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline">U</span>
      </Tool>
      <Tool label="Strikethrough" active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through">S</span>
      </Tool>
      <Tool label="Highlight" active={s.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <span className="note-mark px-0.5">H</span>
      </Tool>
      <Divider />
      <Tool label="To-do list" active={s.task} onClick={() => editor.chain().focus().toggleTaskList().run()}>☑</Tool>
      <Tool label="Bulleted list" active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>•≡</Tool>
      <Tool label="Numbered list" active={s.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</Tool>
      <Tool label="Quote" active={s.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</Tool>
      <Tool label="Code block" active={s.code} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{"</>"}</Tool>
      <Tool label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</Tool>
      <div className="ml-auto shrink-0 pl-2">
        <VoiceInput onText={(spoken) => editor.chain().focus().insertContent(`${spoken} `).run()} />
      </div>
    </div>
  );
}

// Floating bar over selected text, like Notion's
function SelectionMenu({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      highlight: editor.isActive("highlight"),
      code: editor.isActive("code"),
      link: editor.isActive("link"),
    }),
  });

  function link() {
    const current = editor.getAttributes("link").href as string | undefined;
    const href = prompt("Link to", current ?? "https://");
    if (href === null) return;
    if (!href.trim() || href === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  }

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor, from, to }) =>
        from !== to && !editor.isActive("codeBlock") && editor.isFocused
      }
      className="z-30 flex items-center gap-0.5 rounded-xl card p-1 shadow-lg"
    >
      <Tool label="Bold" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <b>B</b>
      </Tool>
      <Tool label="Italic" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <i className="font-bold tracking-tight text-base">I</i>
      </Tool>
      <Tool label="Underline" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline">U</span>
      </Tool>
      <Tool label="Strikethrough" active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through">S</span>
      </Tool>
      <Tool label="Highlight" active={s.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <span className="note-mark px-0.5">H</span>
      </Tool>
      <Tool label="Inline code" active={s.code} onClick={() => editor.chain().focus().toggleCode().run()}>
        <span className="font-mono text-xs">{"<>"}</span>
      </Tool>
      <Tool label="Link" active={s.link} onClick={link}>🔗</Tool>
    </BubbleMenu>
  );
}

function SlashMenu({ menu, onHover }: { menu: SlashState; onHover: (index: number) => void }) {
  const rect = menu.rect!;
  const below = rect.bottom + 320 < window.innerHeight;
  const style = {
    left: Math.min(rect.left, window.innerWidth - 272),
    ...(below ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }),
  };
  return (
    <div
      role="listbox"
      aria-label="Blocks"
      style={style}
      className="fixed z-40 max-h-80 w-64 overflow-y-auto rounded-xl card glass-strong p-1 shadow-xl"
    >
      {menu.items.length === 0 ? (
        <p className="px-3 py-2 text-sm text-paper/60">No matching block</p>
      ) : (
        menu.items.map((block, i) => (
          <button
            key={block.label}
            type="button"
            role="option"
            aria-selected={i === menu.index}
            onMouseEnter={() => onHover(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              menu.pick(block);
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left ${i === menu.index ? "bg-paper/[0.07]" : ""}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-paper/10 bg-inset text-sm font-semibold text-paper/78">
              {block.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-paper">{block.label}</span>
              <span className="block truncate text-xs text-paper/60">{block.hint}</span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}

function Tool({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-1.5 text-sm transition disabled:opacity-30 ${
        active ? "bg-ember/20 font-semibold text-ember" : "text-paper/78 hover:bg-paper/[0.07] hover:text-paper"
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-paper/10" aria-hidden />;

