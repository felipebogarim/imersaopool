import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/precos/simulador')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/precos/simulador"!</div>
}
