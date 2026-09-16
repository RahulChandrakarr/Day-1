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

export const documents: Domain = {
  labels: {
    list_documents: "Looking through your documents…",
    read_document: "Reading the document…",
    rename_document: "Updating the document…",
    delete_document: "Removing the document…",
  },
  prompt: `DOCUMENTS (files the user uploaded in Settings → Documents: IDs, bills, insurance, receipts…)
- list_documents shows what exists. To answer anything about a file's contents (an Aadhaar or PAN number, a bill amount, a policy date), call read_document with a clear question.
- These are the user's own private files, so read out numbers and details they ask for exactly as written.
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
        "Open one uploaded file (PDF or photo) and answer a question from its contents, e.g. 'What is the Aadhaar number?'.",
      inputSchema: z.object({
        document: z.string().min(1).describe("File name, folder hint or id"),
        question: z.string().min(3).max(500),
      }),
      execute: async ({ document, question }) => {
        const docs = await getDocuments();
        let found = pick(docs, document, (d) => d.name);
        if ("error" in found) {
          const inFolder = docs.filter((d) => d.folder.toLowerCase() === document.toLowerCase());
          if (inFolder.length !== 1) return failed(found.error);
          found = { item: inFolder[0] };
        }
        const doc = found.item;
        if (doc.size > MAX_READ_BYTES) return failed("That file is too large to read.");
        const { data, error } = await ctx.supabase.storage.from("documents").download(doc.path);
        if (error || !data) return failed(error?.message ?? "Couldn't open the file.");
        const bytes = new Uint8Array(await data.arrayBuffer());
        const mediaType = doc.mime || data.type || "application/pdf";

        const { text } = await generateText({
          model: answerModel,
          instructions:
            "You read one document that belongs to the person asking. Answer only from what is visible in it. Copy numbers, names and dates exactly as printed. If the answer isn't in the document, say so. Be brief.",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `Document: "${doc.name}" (${doc.folder}).\nQuestion: ${question}` },
                { type: "file", data: bytes, mediaType, filename: doc.name },
              ],
            },
          ],
          temperature: 0,
          maxOutputTokens: 500,
          providerOptions: answerProviderOptions,
          abortSignal: AbortSignal.timeout(40_000),
        });
        return { document: doc.name, folder: doc.folder, answer: text };
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
