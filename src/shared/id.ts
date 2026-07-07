/** Generates a short, unique-enough ID for entities (presets, etc.). */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
