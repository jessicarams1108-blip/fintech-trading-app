export function PlaceholderPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-slate-300 bg-white p-8">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-3 text-slate-600">{body}</p>
    </div>
  );
}
