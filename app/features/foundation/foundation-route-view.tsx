import { EmptyState, FoundationNotice, PageHeader } from "../../components/collective/foundation";

export function FoundationRouteView({
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
}: {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <main className="collective-page">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <FoundationNotice />
      <EmptyState
        eyebrow="Honest empty state"
        title={emptyTitle}
        description={emptyDescription}
      />
    </main>
  );
}
