/** Global route-loading fallback. */
export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-glow"
        role="status"
        aria-label="Loading"
      />
    </main>
  );
}
