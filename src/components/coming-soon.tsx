/** Placeholder for screens built in later steps of the build plan. */
export function ComingSoon({ title, step }: { title: string; step: number }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">Arrives in build step {step}.</p>
    </div>
  );
}
