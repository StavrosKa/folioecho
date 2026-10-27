export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export function guard(request: Request, url: URL, write = false): Response | undefined {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return json({ error: 'This workspace is local only.' }, 403);
  if (write && request.headers.get('origin') !== url.origin) return json({ error: 'Same-origin access is required.' }, 403);
}
