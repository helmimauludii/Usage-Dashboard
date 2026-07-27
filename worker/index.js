function withStaticHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response = await env.ASSETS.fetch(request);

    if (response.status !== 404) {
      return withStaticHeaders(response);
    }

    if (!url.pathname.startsWith("/assets/") && !url.pathname.startsWith("/data/")) {
      response = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url)));
      return withStaticHeaders(response);
    }

    return response;
  },
};
