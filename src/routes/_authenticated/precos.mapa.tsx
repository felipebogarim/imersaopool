import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/precos/mapa')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/precos/mapa"!</div>
}
