/**
 * Clave canónica de un nombre: minúsculas, sin tildes y con los espacios colapsados.
 * "Prensa  Pierná " y "prensa pierna" producen la misma clave.
 */
export function normalizeName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

/** Limpia el nombre que se muestra (sin espacios de más), conservando tildes y mayúsculas. */
export const cleanDisplayName = (input: string) => input.trim().replace(/\s+/g, ' ');
