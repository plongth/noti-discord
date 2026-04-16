import http from "node:http";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;
const DEFAULT_BODY_LIMIT_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

const resolvePort = () => {
  const parsed = Number(process.env.ARESPAWN_WRAPPER_PORT);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PORT;
  }
  return Math.floor(parsed);
};

const resolveHost = () => {
  const host = String(process.env.ARESPAWN_WRAPPER_HOST || "").trim();
  return host || DEFAULT_HOST;
};

const resolveApiBaseUrl = () => {
  const value = String(process.env.ARESPAWN_API_BASE_URL || "").trim();
  if (!value) return null;
  return value.replace(/\/$/, "");
};

const resolveApiExecutePath = () => {
  const value = String(process.env.ARESPAWN_API_EXECUTE_PATH || "").trim();
  if (!value) return "/execute";
  return value.startsWith("/") ? value : `/${value}`;
};

const resolveTimeoutMs = () => {
  const parsed = Number(process.env.ARESPAWN_REQUEST_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(1_000, Math.floor(parsed));
};

const sendJson = (res, statusCode, data) => {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
};

const readJsonBody = async (req, limitBytes = DEFAULT_BODY_LIMIT_BYTES) => {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) {
      const err = new Error("Request body too large.");
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    const err = new Error("Invalid JSON body.");
    err.statusCode = 400;
    throw err;
  }
};

const buildForwardHeaders = () => {
  const headers = {
    "content-type": "application/json",
  };

  const apiKey = String(process.env.ARESPAWN_API_KEY || "").trim();
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }
  return headers;
};

const forwardExecute = async (payload) => {
  const apiBaseUrl = resolveApiBaseUrl();
  if (!apiBaseUrl) {
    const err = new Error(
      "ARESPAWN_API_BASE_URL is not configured on wrapper service.",
    );
    err.statusCode = 500;
    throw err;
  }

  const timeoutMs = resolveTimeoutMs();
  const executeUrl = `${apiBaseUrl}${resolveApiExecutePath()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(executeUrl, {
      method: "POST",
      headers: buildForwardHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const contentType = String(response.headers.get("content-type") || "");
    const downstreamPayload = contentType.includes("application/json")
      ? await response
          .json()
          .catch(() => ({ message: "Invalid JSON response" }))
      : { message: await response.text() };

    return {
      statusCode: response.status,
      ok: response.ok,
      payload: downstreamPayload,
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      const timeoutErr = new Error("Downstream request timed out.");
      timeoutErr.statusCode = 504;
      throw timeoutErr;
    }
    const forwardErr = new Error("Downstream request failed.");
    forwardErr.statusCode = 502;
    throw forwardErr;
  } finally {
    clearTimeout(timeout);
  }
};

const server = http.createServer(async (req, res) => {
  const method = String(req.method || "GET").toUpperCase();
  const url = req.url || "/";

  if (method === "GET" && url === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "arespawn-wrapper",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (method === "POST" && url === "/execute") {
    try {
      const body = await readJsonBody(req);
      const command = String(body?.command || "").trim();
      if (!command) {
        sendJson(res, 400, { ok: false, message: "`command` is required." });
        return;
      }

      const forwarded = await forwardExecute(body);
      sendJson(res, forwarded.statusCode, {
        ok: forwarded.ok,
        requestId: String(body?.requestId || ""),
        data: forwarded.payload,
      });
      return;
    } catch (err) {
      const statusCode = Number(err?.statusCode) || 500;
      sendJson(res, statusCode, {
        ok: false,
        message: err?.message || "Wrapper execution failed.",
      });
      return;
    }
  }

  sendJson(res, 404, { ok: false, message: "Not found." });
});

const port = resolvePort();
const host = resolveHost();

server.listen(port, host, () => {
  // Keep startup log minimal and secret-free.
  console.log(`arespawn-wrapper listening on http://${host}:${port}`);
});

