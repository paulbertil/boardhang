// Client-side route tree for the PWA (code-based, no file-route codegen).
//
// The URL is the sole source of truth for every explicit route — localStorage is
// consulted only to build the bare-`/` redirect on a cold launch (see
// `catalogNavTarget`). History routing gives clean, shareable URLs; the deploy
// host serves index.html for unknown paths (vite PWA navigateFallback).
//
//   /                        → redirect: no boards → /boards, else last catalog
//   /boards                  → MyBoards (global, not board-scoped)
//   /logbook                 → LogbookScreen
//   /board/$layoutId/catalog → CatalogScreen  (search params: see catalogSearch.ts)
//
// The tree is built by a factory so tests can spin up an isolated memory-history
// router without reusing route objects already bound to the browser router.

import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  stripSearchParams,
  useNavigate,
  type RouterHistory,
} from '@tanstack/react-router'
import { AppLayout } from './shell/AppLayout'
import { MyBoards } from './shell/MyBoards'
import { LogbookScreen } from './logbook/LogbookScreen'
import { CatalogScreen } from './catalog/CatalogScreen'
import { boardByLayoutId, defaultAngle, type CatalogBoardDef } from './board/boards'
import { getActiveBoardId, getAddedBoardIds, getAngle } from './board/boardStore'
import { loadSeed } from './catalog/filterSeed'
import {
  CATALOG_SEARCH_DEFAULTS,
  filtersToSearch,
  validateCatalogSearch,
} from './catalog/catalogSearch'

// A fully-populated search satisfies TanStack's all-required validated type; the
// route's strip middleware removes anything left at its default, so the URL stays clean.

/** A navigation target for a board's catalog, seeded from its cold-launch filters
 *  and persisted angle. Shared by the bare-`/` redirect and the nav Search button
 *  so both reproduce the last-active catalog identically. Default params are left
 *  in — the route's strip middleware removes them, keeping the URL clean. */
export function catalogNavTarget(board: CatalogBoardDef) {
  const angle = getAngle(board)
  return {
    to: '/board/$layoutId/catalog' as const,
    params: { layoutId: String(board.layoutId) },
    search: {
      ...CATALOG_SEARCH_DEFAULTS,
      ...filtersToSearch(loadSeed(board.layoutId, angle)),
      angle: angle === defaultAngle(board) ? 0 : angle,
    },
  }
}

function BoardsRoute() {
  const navigate = useNavigate()
  return (
    <MyBoards
      onActivated={(layoutId) => {
        const board = boardByLayoutId(layoutId)
        if (board) void navigate(catalogNavTarget(board))
      }}
    />
  )
}

function buildRouteTree() {
  const rootRoute = createRootRoute({
    component: () => (
      <AppLayout>
        <Outlet />
      </AppLayout>
    ),
  })

  // Bare `/` — the only place localStorage seeds a route. Cold launch lands here.
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    beforeLoad: () => {
      const added = getAddedBoardIds()
      if (added.length === 0) throw redirect({ to: '/boards' })
      // Prefer the active board when it's actually added, else the MRU front.
      const activeId = getActiveBoardId()
      const targetId = added.includes(activeId) ? activeId : added[0]
      throw redirect(catalogNavTarget(boardByLayoutId(targetId)!))
    },
  })

  const boardsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/boards',
    component: BoardsRoute,
  })

  const logbookRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/logbook',
    component: LogbookScreen,
  })

  const catalogRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/board/$layoutId/catalog',
    validateSearch: validateCatalogSearch,
    search: { middlewares: [stripSearchParams(CATALOG_SEARCH_DEFAULTS)] },
    beforeLoad: ({ params }) => {
      // Unknown board (not in the registry) → bounce to My Boards. A registry-valid
      // but un-added board is allowed through: the screen shows a read-only preview
      // with an "Add this board" affordance (plan §3).
      if (boardByLayoutId(Number(params.layoutId)) === undefined) {
        throw redirect({ to: '/boards' })
      }
    },
    component: CatalogScreen,
  })

  return rootRoute.addChildren([indexRoute, boardsRoute, logbookRoute, catalogRoute])
}

/** Build a router over a fresh route tree. `history` is omitted in the browser
 *  (defaults to history routing) and supplied as memory history in tests. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree: buildRouteTree(), history })
}

export const router = createAppRouter()

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
