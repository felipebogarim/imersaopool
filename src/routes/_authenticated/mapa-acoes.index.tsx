import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/mapa-acoes/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/mapa-acoes/"!</div>
}
