/** POST /uploads — 201 response. `url` is what a generation refers to. */
export type ImageUploadResponse = {
  file_id: string;
  filename: string;
  /** Server-relative, e.g. "/uploads/a50c46e9-….png" */
  url: string;
  width: number;
  height: number;
  size_bytes: number;
  /** "PNG" | "JPEG" | "WEBP" as reported by Pillow. */
  format: string;
};
