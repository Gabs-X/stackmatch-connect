import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Load a page's code when the pointer rests on or focuses its link, so the click shows it at once.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
