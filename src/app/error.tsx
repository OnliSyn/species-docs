'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center h-screen bg-[var(--color-bg-outer)]">
      <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-lg">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Something went wrong</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">{error.message}</p>
        <button onClick={reset} className="px-4 py-2 rounded-full bg-[var(--color-cta-primary)] text-white text-sm font-semibold">
          Try again
        </button>
      </div>
    </div>
  );
}
