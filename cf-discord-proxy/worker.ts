/**
 * Cloudflare Worker — Discord Relay Proxy for DevGuild
 *
 * Deploy this at: https://dash.cloudflare.com → Workers & Pages → Create Worker
 *
 * It proxies any POST /api/... request to discord.com transparently.
 * Since CF Workers originate from CF's own infrastructure, Discord never
 * rate-limits them with error 1015 (unlike Render's shared IP ranges).
 *
 * Usage: set DISCORD_WEBHOOK_PROXY_HOST=your-worker.workers.dev in Render env
 */

export default {
  async fetch(request: Request): Promise<Response> {
    // Only allow POST (all Discord webhook/message calls are POSTs)
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);

    // Must be a Discord API path
    if (!url.pathname.startsWith('/api/')) {
      return new Response('Not Found', { status: 404 });
    }

    // Forward to Discord
    const discordUrl = `https://discord.com${url.pathname}${url.search}`;

    const forwardHeaders = new Headers();
    forwardHeaders.set('Content-Type', 'application/json');

    // Forward Authorization header if present (for Bot token channel messages)
    const auth = request.headers.get('Authorization');
    if (auth) forwardHeaders.set('Authorization', auth);

    // Forward User-Agent
    const ua = request.headers.get('User-Agent');
    if (ua) forwardHeaders.set('User-Agent', ua);

    const body = await request.text();

    const discordResponse = await fetch(discordUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body,
    });

    // Return Discord's response as-is
    const responseBody = await discordResponse.text();
    return new Response(responseBody, {
      status: discordResponse.status,
      headers: {
        'Content-Type': discordResponse.headers.get('Content-Type') ?? 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
