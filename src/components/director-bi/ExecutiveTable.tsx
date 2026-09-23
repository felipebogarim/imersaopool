import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  directorStatusBucket,
  dueState,
  initials,
  isDirectorComplete,
  shortDescription,
  type DirectorAction,
  type DirectorStatusBucket,
} from "@/lib/director-bi";

const STATUS_BADGE_CLASS: Record<DirectorStatusBucket, string> = {
  in_progress: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  todo: "border-border bg-muted text-muted-foreground",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  overdue: "border-destructive/30 bg-destructive/10 text-destructive",
};

function Deadline({ action }: { action: DirectorAction }) {
  const hint = dueState(action.due_date, isDirectorComplete(action));
  const date = action.due_date?.slice(0, 10).split("-").reverse().join("/");
  return (
    <div className={cn("text-sm tabular-nums", hint === "Atrasada" && "text-destructive")}>
      {date ? (
        <span className="inline-flex items-center gap-1">
          <time dateTime={action.due_date!}>{date}</time>
          {hint === "Atrasada" && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
        </span>
      ) : (
        <span className="text-muted-foreground">Sem prazo</span>
      )}
      {hint && <span className="mt-0.5 block text-xs">{hint}</span>}
    </div>
  );
}

export function ExecutiveTable({ actions }: { actions: DirectorAction[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="block w-full text-left text-sm md:table md:table-fixed">
        <caption className="sr-only">
          Principais frentes selecionadas para acompanhamento executivo
        </caption>
        <thead className="hidden border-b bg-muted/40 text-xs text-muted-foreground md:table-header-group">
          <tr>
            <th scope="col" className="w-[24%] px-4 py-3 font-medium">
              Ação
            </th>
            <th scope="col" className="w-[28%] px-4 py-3 font-medium">
              Resumo
            </th>
            <th scope="col" className="w-[17%] px-4 py-3 font-medium">
              Responsável
            </th>
            <th scope="col" className="w-[14%] px-4 py-3 font-medium">
              Prazo
            </th>
            <th scope="col" className="w-[17%] px-4 py-3 font-medium">
              Status / Evolução
            </th>
          </tr>
        </thead>
        <tbody className="block divide-y divide-border md:table-row-group">
          {actions.map((action) => (
            <tr
              key={action.id}
              className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 p-4 transition-colors hover:bg-muted/20 md:table-row md:p-0"
            >
              <th
                scope="row"
                className="col-span-2 min-w-0 text-left align-top font-medium md:px-4 md:py-4"
              >
                <Link
                  to="/tarefas/b/$boardId"
                  params={{ boardId: action.board_id }}
                  search={{ card: action.id }}
                  className="break-words text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2"
                >
                  {action.title}
                </Link>
                {action.representative && (
                  <span className="mt-1 block break-words text-xs font-normal text-muted-foreground">
                    Rep: {action.representative}
                  </span>
                )}
              </th>
              <td className="col-span-2 min-w-0 align-top text-muted-foreground md:px-4 md:py-4">
                <span className="line-clamp-2 break-words" title={action.description ?? undefined}>
                  {shortDescription(action.description) || "Sem descrição"}
                </span>
              </td>
              <td className="min-w-0 break-words align-top md:px-4 md:py-4">
                <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                  Responsável
                </span>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] font-medium">
                      {initials(action.responsible)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{action.responsible}</span>
                </div>
              </td>
              <td className="min-w-0 align-top md:px-4 md:py-4">
                <span className="mb-1 block text-xs text-muted-foreground md:hidden">Prazo</span>
                <Deadline action={action} />
              </td>
              <td className="col-span-2 min-w-0 align-top md:px-4 md:py-4">
                <Badge
                  variant="outline"
                  className={cn(
                    "max-w-full whitespace-normal font-normal",
                    STATUS_BADGE_CLASS[directorStatusBucket(action)],
                  )}
                >
                  {isDirectorComplete(action) ? "Concluída" : action.stage}
                </Badge>
                {action.checklistTotal > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{
                          width: `${Math.round((action.checklistDone / action.checklistTotal) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Math.round((action.checklistDone / action.checklistTotal) * 100)}%
                    </span>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
