export function EmptyAdminBlock({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{text}</div>;
}
