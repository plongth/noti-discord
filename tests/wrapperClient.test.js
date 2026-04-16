import assert from "node:assert/strict";
import test from "node:test";

import wrapperClient from "../src/wrapperClient.js";

const ENV_KEYS = [
  "ARESPAWN_URL",
  "ARESPAWN_EXECUTE_PATH",
  "ARESPAWN_REQUEST_TIMEOUT_MS",
];

const snapshotEnv = () => {
  const snapshot = {};
  for (const key of ENV_KEYS) {
    snapshot[key] = process.env[key];
  }
  return snapshot;
};

const restoreEnv = (snapshot) => {
  for (const key of ENV_KEYS) {
    if (snapshot[key] == null) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
};

const createJsonResponse = ({ status = 200, ok = true, body = {} } = {}) => ({
  status,
  ok,
  headers: {
    get(name) {
      if (String(name).toLowerCase() === "content-type") {
        return "application/json";
      }
      return null;
    },
  },
  async json() {
    return body;
  },
  async text() {
    return JSON.stringify(body);
  },
});

test("executeRunCommand posts to configured wrapper endpoint with minimal payload", async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = global.fetch;
  const calls = [];

  try {
    process.env.ARESPAWN_URL = "http://127.0.0.1:3000";
    process.env.ARESPAWN_EXECUTE_PATH = "/execute";
    process.env.ARESPAWN_REQUEST_TIMEOUT_MS = "8000";

    global.fetch = async (url, options) => {
      calls.push({ url, options });
      return createJsonResponse({
        status: 200,
        ok: true,
        body: { ok: true, message: "done" },
      });
    };

    const result = await wrapperClient.executeRunCommand({
      command: "ping",
      args: { target: "world" },
      context: { userId: "u1" },
      requestId: "req-1",
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://127.0.0.1:3000/execute");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.headers["content-type"], "application/json");

    const parsedBody = JSON.parse(calls[0].options.body);
    assert.deepEqual(parsedBody, {
      command: "ping",
      args: { target: "world" },
      context: { userId: "u1" },
      requestId: "req-1",
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.requestId, "req-1");
    assert.deepEqual(result.payload, { ok: true, message: "done" });
  } finally {
    restoreEnv(envSnapshot);
    global.fetch = originalFetch;
  }
});

test("executeRunCommand surfaces wrapper error message from non-2xx response", async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = global.fetch;

  try {
    process.env.ARESPAWN_URL = "http://127.0.0.1:3000";
    process.env.ARESPAWN_EXECUTE_PATH = "/execute";

    global.fetch = async () =>
      createJsonResponse({
        status: 400,
        ok: false,
        body: { message: "bad command" },
      });

    await assert.rejects(
      async () => {
        await wrapperClient.executeRunCommand({
          command: "broken",
          requestId: "req-2",
        });
      },
      (err) => {
        assert.equal(err.message, "bad command");
        assert.equal(err.statusCode, 400);
        assert.equal(err.requestId, "req-2");
        return true;
      },
    );
  } finally {
    restoreEnv(envSnapshot);
    global.fetch = originalFetch;
  }
});

test("executeRunCommand maps AbortError to timeout message", async () => {
  const envSnapshot = snapshotEnv();
  const originalFetch = global.fetch;

  try {
    process.env.ARESPAWN_URL = "http://127.0.0.1:3000";
    process.env.ARESPAWN_EXECUTE_PATH = "/execute";

    global.fetch = async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    };

    await assert.rejects(
      async () => {
        await wrapperClient.executeRunCommand({ command: "slow" });
      },
      (err) => {
        assert.equal(err.message, "Wrapper request timed out.");
        return true;
      },
    );
  } finally {
    restoreEnv(envSnapshot);
    global.fetch = originalFetch;
  }
});

test("formatRunReply returns short message when payload has message", () => {
  const text = wrapperClient.formatRunReply({
    payload: { message: "ok" },
    requestId: "req-3",
  });
  assert.equal(text, "ok\n\nrequestId: req-3");
});

