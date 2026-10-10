export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return new Response('Not Found', { status: 404 });
    }

    const discordUrl = 'https://discord.com' + url.pathname + url.search;

    const forwardHeaders = new Headers();
    forwardHeaders.set('Content-Type', 'application/json');

    const auth = request.headers.get('Authorization');
    if (auth) forwardHeaders.set('Authorization', auth);

    const ua = request.headers.get('User-Agent');
    if (ua) forwardHeaders.set('User-Agent', ua);

    const body = await request.text();

    const discordResponse = await fetch(discordUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body,
    });

    const responseBody = await discordResponse.text();
    return new Response(responseBody, {
      status: discordResponse.status,
      headers: {
        'Content-Type': discordResponse.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
