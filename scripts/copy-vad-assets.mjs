// Copies the on-device speech detector's files into public/vad, where the
// browser loads them from. They're large and come straight from node_modules,
// so they're rebuilt here rather than committed. Runs before `dev` and `build`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "public", "vad");

const FILES = [
  ["@ricky0123/vad-web/dist", "bundle.min.js"],
  ["@ricky0123/vad-web/dist", "vad.worklet.bundle.min.js"],
  ["@ricky0123/vad-web/dist", "silero_vad_v5.onnx"],
  ["onnxruntime-web/dist", "ort.wasm.min.js"],
  ["onnxruntime-web/dist", "ort-wasm-simd-threaded.wasm"],
  ["onnxruntime-web/dist", "ort-wasm-simd-threaded.mjs"],
];

fs.mkdirSync(target, { recursive: true });
for (const [dir, file] of FILES) {
  fs.copyFileSync(path.join(root, "node_modules", dir, file), path.join(target, file));
}
console.log(`Copied ${FILES.length} speech detector files to public/vad`);
