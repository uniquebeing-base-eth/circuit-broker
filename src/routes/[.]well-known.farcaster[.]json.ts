import { createFileRoute } from "@tanstack/react-router";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
};

const MANIFEST = {
  accountAssociation: {
    header:
      "eyJmaWQiOjg0OTExNiwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweGQzRDViRmMyOGJjMjA5OTg4NGEzNmVkNDE2NTY4NzRCQ2RENDYzMTUifQ",
    payload: "eyJkb21haW4iOiJjaXJjdWl0LWJyb2tlci5sb3ZhYmxlLmFwcCJ9",
    signature:
      "jOdx4OiNZKLLAI4HSq2x3XEIzW4Kku7VUJem6QwIHnkLJr4tSiw0mbTyAei45GCs9XthW6sivk5BpRU5g++e5xs=",
  },
  miniapp: {
    version: "1",
    name: "Circuit",
    iconUrl: "https://circuit-broker.lovable.app/icon.png",
    homeUrl: "https://circuit-broker.lovable.app",
    castShareUrl: "https://circuit-broker.lovable.app",
    imageUrl: "https://circuit-broker.lovable.app/image.png",
    buttonTitle: "Launch Circuit",
    splashImageUrl: "https://circuit-broker.lovable.app/splash.png",
    splashBackgroundColor: "#0a1628",
    webhookUrl: "https://circuit-broker.lovable.app/api/webhook",
    subtitle: "Find Pay Deliver via AI Agents",
    description: "Autonomous procurement agent that finds pays and delivers",
    primaryCategory: "utility",
    tags: ["utility", "agents", "procurement", "celo", "base"],
    heroImageUrl: "https://circuit-broker.lovable.app/image.png",
    tagline: "Find Pay Deliver via AI Agents",
    ogTitle: "Circuit",
    ogDescription: "Autonomous agent procurement on Celo",
    ogImageUrl: "https://circuit-broker.lovable.app/image.png",
  },
  baseBuilder: {
    ownerAddress: "0x170c5a413136F094421fad8Dd20285b5e05Fff5e",
  },
};

export const Route = createFileRoute("/.well-known/farcaster.json")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(MANIFEST, null, 2), { status: 200, headers: HEADERS }),
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),
    },
  },
});
