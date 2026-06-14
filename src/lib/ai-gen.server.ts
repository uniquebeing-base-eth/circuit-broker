// Server-only AI generation via Lovable AI Gateway.
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function getKey() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("LOVABLE_API_KEY missing");
  return k;
}

export async function generateText(opts: { system: string; user: string; model?: string }): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: opts.system }, { role: "user", content: opts.user }],
    }),
  });
  if (!res.ok) throw new Error(`AI text gen failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

/** Returns a data URL of the generated image. */
export async function generateImage(prompt: string): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) throw new Error(`AI image gen failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const url: string | undefined = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error("No image returned");
  return url;
}

/** Uploads a data URL to Cloud storage and returns a long-lived signed URL. */
export async function uploadDataUrlToStorage(dataUrl: string, path: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("invalid data URL");
  const contentType = match[1];
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  const { error } = await supabaseAdmin.storage.from("circuit-results").upload(path, bytes, {
    contentType, upsert: true,
  });
  if (error) throw error;
  const { data, error: signErr } = await supabaseAdmin.storage.from("circuit-results").createSignedUrl(path, 60 * 60 * 24 * 30);
  if (signErr || !data) throw signErr ?? new Error("sign failed");
  return data.signedUrl;
}
