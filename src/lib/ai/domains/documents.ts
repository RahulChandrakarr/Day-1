import "server-only";
import { generateText, tool } from "ai";
import { z } from "zod";
import { deleteDocument, updateDocument } from "@/app/(dashboard)/settings/actions";
import { getDocuments } from "@/lib/profile-queries";
import { answerModel, answerProviderOptions } from "../models";
import {
  changed,
  confirmedInput,
  failed,
  NEEDS_CONFIRMATION,
  pick,
  type Domain,
} from "./common";

const MAX_READ_BYTES = 10 * 1024 * 1024;

async function openDocument(ctx: Parameters<Domain["tools"]>[0], document: string) {
  const docs = await getDocuments();
  const found = pick(docs, document, (d) => d.name);
  const q = document.toLowerCase();
  const study = docs.filter((d) => d.folder.toLowerCase() === "study");
  const inFolder = docs.filter((d) => d.folder.toLowerCase() === q);
  const doc =
    "item" in found
      ? found.item
      : study.length === 1 && /study|syllabus|the file|uploaded/.test(q)
        ? study[0]
        : inFolder.length === 1
          ? inFolder[0]
          : null;
  if (!doc) return failed("error" in found ? found.error : "Couldn't find that file.");
  if (doc.size > MAX_READ_BYTES) return failed("That file is too large to read.");
  const { data, error } = await ctx.supabase.storage.from("documents").download(doc.path);
  if (error || !data) return failed(error?.message ?? "Couldn't open the file.");
  return {
    doc,
    bytes: new Uint8Array(await data.arrayBuffer()),
    mediaType: doc.mime || data.type || "application/pdf",
  };
}

export const documents: Domain = {
  labels: {
    list_documents: "Looking through your documents…",
    read_document: "Reading the document…",
    teach_from_document: "Teaching from your file…",
    rename_document: "Updating the document…",
    delete_document: "Removing the document…",
  },
  prompt: `DOCUMENTS (files they uploaded: syllabi in Study, plus IDs, bills, insurance, receipts)
- When they upload a syllabus or study file, or ask a question from it, list_documents then teach_from_document (or read_document for a single fact). Prefer the Study folder and the file they just named.
- teach_from_document: explain, summarise, quiz, walk through a unit, or answer any study question from the file. Stay faithful to what's written; if it isn't in the file, say so.
- read_document: one exact fact (a number, date, name).
- These are the user's own private files, so copy numbers, names and dates exactly as printed.
- If several files could match, say which one you read.`,
  tools: (ctx) => ({
    list_documents: tool({
      description: "The user's uploaded files: name, folder, type, size and upload date.",
      inputSchema: z.object({
        folder: z.string().max(40).optional(),
        search: z.string().max(80).optional(),
      }),
      execute: async ({ folder, search }) => {
        const q = search?.toLowerCase();
        const docs = (await getDocuments()).filter(
          (d) =>
            (!folder || d.folder.toLowerCase() === folder.toLowerCase()) &&
            (!q || d.name.toLowerCase().includes(q) || d.folder.toLowerCase().includes(q)),
        );
        return {
          count: docs.length,
          documents: docs.map((d) => ({
            id: d.id,
            name: d.name,
            folder: d.folder,
            type: d.mime === "application/pdf" ? "PDF" : d.mime.startsWith("image/") ? "image" : d.mime,
            sizeKb: Math.round(d.size / 1024),
            uploaded: d.created_at.slice(0, 10),
          })),
        };
      },
    }),

    read_document: tool({
      description:
        "Open one uploaded file (PDF or photo) and answer a short factual question from its contents, e.g. 'What is the Aadhaar number?'.",
      inputSchema: z.object({
        document: z.string().min(1).describe("File name, folder hint or id"),
        question: z.string().min(3).max(500),
      }),
      execute: async ({ document, question }) => {
        const opened = await openDocument(ctx, document);
        if ("error" in opened) return opened;
        const { text } = await generateText({
          model: answerModel,
          instructions:
            "You read one document that belongs to the person asking. Answer only from what is visible in it. Copy numbers, names and dates exactly as printed. If the answer isn't in the document, say so. Be brief.",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Document: "${opened.doc.name}" (${opened.doc.folder}).\nQuestion: ${question}`,
                },
                { type: "file", data: opened.bytes, mediaType: opened.mediaType, filename: opened.doc.name },
              ],
            },
          ],
          temperature: 0,
          maxOutputTokens: 500,
          providerOptions: answerProviderOptions,
          abortSignal: AbortSignal.timeout(40_000),
        });
        return { document: opened.doc.name, folder: opened.doc.folder, answer: text };
      },
    }),

    teach_from_document: tool({
      description:
        "Teach from an uploaded syllabus or study file: explain a topic, summarise a unit, quiz them, or answer any study question using only that file.",
      inputSchema: z.object({
        document: z.string().min(1).describe("File name, or 'Study' if that's the only study file"),
        request: z
          .string()
          .min(3)
          .max(800)
          .describe("What to teach, summarise, quiz, or answer from the file"),
      }),
      execute: async ({ document, request }) => {
        const opened = await openDocument(ctx, document);
        if ("error" in opened) return opened;
        const { text } = await generateText({
          model: answerModel,
          instructions:
            "You are tutoring from one file the student uploaded (often a syllabus). Use only what is in the file. Teach clearly: explain, give examples from the file, and quiz when asked. Copy names, units and dates exactly. If it isn't in the file, say so and stay on what is. Reply in the student's language.",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Document: "${opened.doc.name}" (${opened.doc.folder}).\nRequest: ${request}`,
                },
                { type: "file", data: opened.bytes, mediaType: opened.mediaType, filename: opened.doc.name },
              ],
            },
          ],
          temperature: 0.2,
          maxOutputTokens: 2200,
          providerOptions: answerProviderOptions,
          abortSignal: AbortSignal.timeout(60_000),
        });
        return { document: opened.doc.name, folder: opened.doc.folder, lesson: text };
      },
    }),

    rename_document: tool({
      description: "Rename a document or move it to another folder.",
      inputSchema: z.object({
        document: z.string().min(1),
        name: z.string().min(1).max(120).optional(),
        folder: z.string().min(1).max(40).optional(),
      }),
      execute: async ({ document, name, folder }) => {
        const found = pick(await getDocuments(), document, (d) => d.name);
        if ("error" in found) return failed(found.error);
        const result = await updateDocument(found.item.id, { name, folder });
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Updated "${found.item.name}".`);
      },
    }),

    delete_document: tool({
      description: "Delete an uploaded file. Confirm with the user first.",
      inputSchema: z.object({ document: z.string().min(1), confirmed: confirmedInput }),
      execute: async ({ document, confirmed }) => {
        const found = pick(await getDocuments(), document, (d) => d.name);
        if ("error" in found) return failed(found.error);
        if (!confirmed) return { ...NEEDS_CONFIRMATION, wouldDelete: found.item.name };
        const result = await deleteDocument(found.item.id);
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Deleted "${found.item.name}".`);
      },
    }),
  }),
};
