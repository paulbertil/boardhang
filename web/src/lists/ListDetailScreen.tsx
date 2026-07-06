// Placeholder for the list detail screen — replaced with the real problem pile,
// angle filter, and pager in U6.
import { getRouteApi } from '@tanstack/react-router'

const routeApi = getRouteApi('/lists/$listId')

export function ListDetailScreen() {
  const { listId } = routeApi.useParams()
  return (
    <div className="flex flex-1 flex-col px-3" data-testid="list-detail-screen">
      <h1 className="text-lg font-bold tracking-tight">List {listId}</h1>
    </div>
  )
}
