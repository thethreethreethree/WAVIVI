type ClassValue = string | number | null | false | undefined;

/**
 * Minimal class-name joiner. Filters out falsy values.
 * Swap for `clsx` + `tailwind-merge` if conflict resolution is needed later.
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
