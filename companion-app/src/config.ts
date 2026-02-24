/** API base URL for Lelanation backend (builds, submit match). */
export const apiBase =
  typeof import.meta.env?.VITE_API_BASE === "string" && import.meta.env.VITE_API_BASE
    ? import.meta.env.VITE_API_BASE.replace(/\/$/, "")
    : "https://www.lelanation.fr";
