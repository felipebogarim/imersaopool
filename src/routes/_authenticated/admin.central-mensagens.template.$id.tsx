import { createFileRoute } from "@tanstack/react-router";
import { TemplateEditor } from "@/components/central-mensagens/TemplateEditor";

export const Route = createFileRoute("/_authenticated/admin/central-mensagens/template/$id")({
  component: TemplateEditorPage,
});

function TemplateEditorPage() {
  const { id } = Route.useParams();
  return <TemplateEditor templateId={id === "new" ? undefined : id} />;
}
