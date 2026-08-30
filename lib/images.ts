/**
 * Client-side helpers for turning attached image files into `PromptImage`s
 * (base64 data URLs) with a conservative cap on count/size — everything in
 * this app is stored in localStorage, and base64 images are storage-heavy.
 */

import type { PromptImage } from "@/lib/providers/types"

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]
export const MAX_IMAGES = 4
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB per file

export function fileToPromptImage(file: File): Promise<PromptImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read image file"))
        return
      }
      resolve({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        dataUrl: reader.result,
        mimeType: file.type,
        name: file.name,
        sizeBytes: file.size,
      })
    }
    reader.onerror = () => reject(new Error("Could not read image file"))
    reader.readAsDataURL(file)
  })
}

export interface ImageValidationResult {
  accepted: File[]
  rejected: { file: File; reason: string }[]
}

/**
 * Filter a batch of incoming files against the type/size/count caps.
 * `existingCount` lets callers enforce the total-attachment limit across
 * multiple drop/paste/file-picker interactions.
 */
export function validateIncomingFiles(
  existingCount: number,
  files: File[],
): ImageValidationResult {
  const accepted: File[] = []
  const rejected: { file: File; reason: string }[] = []
  let count = existingCount

  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      rejected.push({ file, reason: "Unsupported image type" })
      continue
    }
    if (file.size > MAX_IMAGE_BYTES) {
      rejected.push({
        file,
        reason: `Larger than ${MAX_IMAGE_BYTES / (1024 * 1024)}MB`,
      })
      continue
    }
    if (count >= MAX_IMAGES) {
      rejected.push({ file, reason: `Limit of ${MAX_IMAGES} images reached` })
      continue
    }
    accepted.push(file)
    count += 1
  }

  return { accepted, rejected }
}
