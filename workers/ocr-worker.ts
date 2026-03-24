import { createWorkerPlaceholderMessage } from "@/workers/types";

export function getOcrWorkerBootstrap() {
  return {
    status: "placeholder",
    message: createWorkerPlaceholderMessage("ocr-worker"),
  };
}