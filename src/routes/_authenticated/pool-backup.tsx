import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/pool-backup")({
  component: PoolBackupPage,
});

function PoolBackupPage() {
  return (
    <div>
      <PageHeader title="Pool Backup" subtitle="Em breve" />
      <div className="p-8 text-sm text-muted-foreground">
        Conteúdo desta seção será definido em breve.
      </div>
    </div>
  );
}
