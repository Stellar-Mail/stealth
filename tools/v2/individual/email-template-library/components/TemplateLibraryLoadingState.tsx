export function TemplateLibraryLoadingState() {
  return (
    <section
      aria-labelledby="template-library-loading-title"
      aria-live="polite"
      className="rounded-lg border border-slate-200 bg-white p-6"
    >
      <h2 id="template-library-loading-title" className="text-base font-semibold text-slate-950">
        Loading templates
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Preparing the local template list, editor, and preview surface.
      </p>
      <div className="mt-5 grid gap-3" aria-hidden="true">
        <div className="h-4 w-2/3 rounded bg-slate-200" />
        <div className="h-20 rounded bg-slate-100" />
        <div className="h-20 rounded bg-slate-100" />
      </div>
    </section>
  );
}
