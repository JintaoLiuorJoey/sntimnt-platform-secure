export function SessionLoading() {
  return (
    <main
      className="min-h-screen bg-offwhite flex items-center justify-center px-4"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="text-center">
        <div
          className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-midnight/20 border-t-midnight"
          aria-hidden="true"
        />
        <h1 className="text-lg font-semibold text-midnight">Verifying your session</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Please wait while we securely check your account.
        </p>
      </div>
    </main>
  );
}
