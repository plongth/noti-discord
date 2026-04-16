const DEFAULT_WRAPPER_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_EXECUTE_PATH = "/execute";
const DEFAULT_TIMEOUT_MS = 10_000;

const normalizeBaseUrl = (value) => {
  const trimmed = String(value || "").trim();
  return trimmed || DEFAULT_WRAPPER_BASE_URL;
};

const normalizePath = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return DEFAULT_EXECUTE_PATH;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const composeExecuteUrl = () => {
  const baseUrl = normalizeBaseUrl(process.env.ARESPAWN_URL);
  const path = normalizePath(process.env.ARESPAWN_EXECUTE_PATH);
  return new URL(path, `${baseUrl.replace(/\/$/, "")}/`).toString();
};

const resolveTimeoutMs = () => {
  const parsed = Number(process.env.ARESPAWN_REQUEST_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(1_000, Math.floor(parsed));
};

const parseResponsePayload = async (response) => {
  const contentType = String(response.headers.get("content-type") || "");
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return { message: await response.text() };
};

const toErrorMessage = (err) => {
  if (!err) return "Unknown wrapper request error.";
  if (err.name === "AbortError") {
    return "Wrapper request timed out.";
  }
  return err.message || "Wrapper request failed.";
};

const executeRunCommand = async ({
  command,
  args,
  context,
  requestId = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
} = {}) => {
  const trimmedCommand = String(command || "").trim();
  if (!trimmedCommand) {
    throw new Error("Command is required.");
  }

  const timeoutMs = resolveTimeoutMs();
  const executeUrl = composeExecuteUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(executeUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        command: trimmedCommand,
        args: args ?? null,
        context: context ?? {},
        requestId,
      }),
      signal: controller.signal,
    });

    const payload = await parseResponsePayload(response).catch(() => ({
      message: "Wrapper response could not be parsed.",
    }));

    if (!response.ok) {
      const message =
        typeof payload?.message === "string" && payload.message.trim()
          ? payload.message.trim()
          : `Wrapper returned HTTP ${response.status}.`;
      const err = new Error(message);
      err.statusCode = response.status;
      throw err;
    }

    return {
      statusCode: response.status,
      payload,
      requestId,
      executeUrl,
    };
  } catch (err) {
    const wrappedError = new Error(toErrorMessage(err));
    wrappedError.statusCode = err?.statusCode || null;
    wrappedError.requestId = requestId;
    wrappedError.executeUrl = executeUrl;
    throw wrappedError;
  } finally {
    clearTimeout(timeout);
  }
};

const formatRunReply = ({ payload, requestId }) => {
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return `${payload.message.trim()}\n\nrequestId: ${requestId}`;
  }
  return `Wrapper command completed successfully.\n\nrequestId: ${requestId}\n\n\`\`\`json\n${JSON.stringify(payload ?? {}, null, 2)}\n\`\`\``;
};

const wrapperClient = {
  executeRunCommand,
  formatRunReply,
};

export default wrapperClient;

