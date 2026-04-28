export async function requestJson(url, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    cache = "no-store",
    fallbackMessage = "Request failed.",
  } = options;

  const finalHeaders = { ...headers };
  const init = { method, headers: finalHeaders, cache };

  if (body !== undefined) {
    finalHeaders["Content-Type"] = finalHeaders["Content-Type"] || "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.ok === false) {
    const message =
      data?.userErrors?.[0]?.message ||
      data?.error ||
      fallbackMessage;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

