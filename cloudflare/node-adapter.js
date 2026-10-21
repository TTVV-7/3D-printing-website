// Runs an api/*.js Vercel function unchanged on Cloudflare.
//
// Vercel hands each function a Node-style (req, res) pair with the JSON body
// already parsed into req.body and the query string in req.query. Cloudflare
// hands a Worker a web Request and expects a Response back. This builds the
// first from the second, collects whatever the handler writes to res, and
// turns it into a Response, so the files in api/ stay the single copy of
// every route and keep working on Vercel exactly as before.

const HAS_BODY = (method) => !["GET", "HEAD"].includes(method);

async function toReq(request) {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers); // keys arrive lower-cased, as in Node
  let body;
  if (HAS_BODY(request.method)) {
    const text = await request.text();
    // Vercel parses JSON bodies; anything else reaches the handler as a string.
    if ((headers["content-type"] || "").includes("application/json")) {
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        body = undefined;
      }
    } else {
      body = text;
    }
  }
  return {
    method: request.method,
    url: url.pathname + url.search,
    headers,
    query: Object.fromEntries(url.searchParams),
    body,
  };
}

function makeRes(resolve) {
  const headers = new Headers();
  let done = false;
  const res = {
    statusCode: 200,
    get headersSent() {
      return done;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    setHeader(name, value) {
      headers.set(name, String(value));
      return res;
    },
    getHeader(name) {
      return headers.get(name);
    },
    json(obj) {
      if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
      return res.end(JSON.stringify(obj));
    },
    send(body) {
      if (body !== null && typeof body === "object" && !(body instanceof Uint8Array) && !(body instanceof ArrayBuffer)) {
        return res.json(body);
      }
      if (typeof body === "string" && !headers.has("content-type")) headers.set("content-type", "text/html; charset=utf-8");
      return res.end(body);
    },
    end(body) {
      if (done) return res;
      done = true;
      resolve(new Response(body ?? null, { status: res.statusCode, headers }));
      return res;
    },
  };
  return res;
}

export function toNode(handler) {
  return async (request) => {
    const req = await toReq(request);
    let resolve;
    const response = new Promise((r) => (resolve = r));
    const res = makeRes(resolve);
    try {
      await handler(req, res);
    } catch (err) {
      console.error(`${req.url}:`, err?.message || err);
      if (!res.headersSent) res.status(500).json({ error: "Server error" });
    }
    if (!res.headersSent) res.status(500).json({ error: "No response" });
    return response;
  };
}
