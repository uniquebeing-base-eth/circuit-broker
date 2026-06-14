import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import logoAsset from "../assets/circuit-logo.asset.json";

const LOGO_URL = logoAsset.url;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Lost in the circuit</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This page isn't on Circuit's map.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md circuit-gradient px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Back to Circuit
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something shorted out</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Circuit hit an unexpected error. Try again or go home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md circuit-gradient px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border border-border bg-background px-4 py-2 text-sm">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a1628" },
      { title: "Circuit — Autonomous Procurement Agent on Celo" },
      { name: "description", content: "Tell Circuit what you need. Circuit finds, pays, and delivers — autonomously, on Celo, in cUSD." },
      { name: "author", content: "Circuit" },
      { property: "og:title", content: "Circuit — Autonomous Procurement Agent on Celo" },
      { property: "og:description", content: "Tell Circuit what you need. Circuit finds, pays, and delivers — autonomously, on Celo." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: LOGO_URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Circuit — Autonomous Procurement Agent" },
      { name: "twitter:description", content: "Tell Circuit what you need. Circuit finds, pays, and delivers." },
      { name: "twitter:image", content: LOGO_URL },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/jpeg", href: LOGO_URL },
      { rel: "apple-touch-icon", href: LOGO_URL },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
