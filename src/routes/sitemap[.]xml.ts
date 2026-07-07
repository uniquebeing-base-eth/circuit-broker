import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "https://circuit-broker.lovable.app";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries = [
          { path: "/", priority: "1.0", changefreq: "weekly" },
          { path: "/procure", priority: "0.9", changefreq: "weekly" },
          { path: "/agents", priority: "0.9", changefreq: "daily" },
          { path: "/integrate", priority: "0.8", changefreq: "weekly" },
          { path: "/agent-card.json", priority: "0.7", changefreq: "daily" },
          { path: "/.well-known/agent-card.json", priority: "0.7", changefreq: "daily" },
          { path: "/.well-known/agents.json", priority: "0.7", changefreq: "daily" },
          { path: "/openapi.json", priority: "0.7", changefreq: "daily" },
          { path: "/llms.txt", priority: "0.7", changefreq: "daily" },
        ];
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...entries.map((e) => `  <url><loc>${BASE_URL}${e.path}</loc><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`),
          `</urlset>`,
        ].join("\n");
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
