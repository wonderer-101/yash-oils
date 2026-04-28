/**
 * src/lib/shopify/customerAuth.js
 * Helpers for Shopify Customer Account API - OAuth2 / PKCE flow.
 *
 * OpenID discovery: https://shopify.com/authentication/{shopId}/.well-known/openid-configuration
 * Customer Account API GraphQL: https://{store.myshopify.com}/account/customer/api/{version}/graphql
 */
import crypto from "crypto";

// -- PKCE helpers -------------------------------------------------------

export function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function generateState() {
  return crypto.randomBytes(16).toString("hex");
}

function isTrueLike(value) {
  return /^(1|true)$/i.test((value || "").trim());
}

export function resolveAppUrl(request) {
  const origin = new URL(request.url).origin;
  const useSameUrl = isTrueLike(process.env.USE_SAME_URL);
  if (useSameUrl) {
    return origin;
  }

  const configured = (process.env.NEXT_PUBLIC_APP_URL || "")
    .trim()
    .replace(/\/+$/, "");

  return configured || origin;
}

// -- OpenID discovery ---------------------------------------------------

let _openidCache = null;

export async function getOpenIDConfig() {
  if (_openidCache) return _openidCache;

  const shopId = process.env.SHOPIFY_SHOP_ID;
  if (!shopId) {
    throw new Error(
      "SHOPIFY_SHOP_ID is not set. Add the numeric shop ID to .env.local. " +
      "Find it in Shopify Admin -> Settings -> Plan (it appears in the URL)."
    );
  }

  // Correct URL: shopify.com/authentication/{shopId} - NOT store.myshopify.com
  const url = `https://shopify.com/authentication/${shopId}/.well-known/openid-configuration`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch Shopify OpenID config (${res.status}) for shop ${shopId}. ` +
      `Verify SHOPIFY_SHOP_ID is the correct numeric ID and the Customer Account API ` +
      `(Headless channel) is enabled in Shopify Admin.`
    );
  }
  _openidCache = await res.json();
  return _openidCache;
}

// -- OAuth2 URL builder -------------------------------------------------

export async function buildAuthorizationUrl({ state, codeChallenge, redirectUri }) {
  const config = await getOpenIDConfig();
  const clientId = process.env.SHOPIFY_CLIENT_ID;

  // Required: openid + email + customer-account-api:full
  // Without customer-account-api:full Shopify rejects ALL customer data requests
  const scopes = "openid email customer-account-api:full";

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${config.authorization_endpoint}?${params.toString()}`;
}

// -- Token exchange -----------------------------------------------------

export async function exchangeCodeForToken({ code, codeVerifier, redirectUri, origin }) {
  const config = await getOpenIDConfig();
  const clientId = process.env.SHOPIFY_CLIENT_ID;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (origin) headers.Origin = origin;

  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    idToken: data.id_token,
  };
}

// -- Refresh token ------------------------------------------------------

export async function refreshAccessToken(refreshToken, origin) {
  const config = await getOpenIDConfig();
  const clientId = process.env.SHOPIFY_CLIENT_ID;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken,
  });

  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (origin) headers.Origin = origin;

  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

function normalizeStoreDomain(storeDomain) {
  if (!storeDomain) return "";
  return storeDomain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function getLegacyCustomerApiUrl(storeDomain) {
  const apiVersion =
    (process.env.SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION ||
      process.env.SHOPIFY_STOREFRONT_API_VERSION ||
      "2026-04").trim();

  return `https://${storeDomain}/account/customer/api/${apiVersion}/graphql`;
}

let _customerApiUrlCache = null;

export async function getCustomerApiUrl() {
  const storeDomain = normalizeStoreDomain(process.env.SHOPIFY_STORE_DOMAIN);
  if (!storeDomain) {
    throw new Error("SHOPIFY_STORE_DOMAIN is not set for Customer Account API.");
  }

  if (_customerApiUrlCache) return _customerApiUrlCache;

  const fallbackUrl = getLegacyCustomerApiUrl(storeDomain);

  // Shopify exposes the canonical Customer Account API endpoint via .well-known.
  // Use it when available to avoid version/path mismatches across stores.
  try {
    const discoveryUrl = `https://${storeDomain}/.well-known/customer-account-api`;
    const discoveryRes = await fetch(discoveryUrl, { next: { revalidate: 3600 } });
    if (discoveryRes.ok) {
      const discovery = await discoveryRes.json();
      const discoveredGraphqlUrl = discovery?.graphql_api;
      if (typeof discoveredGraphqlUrl === "string" && discoveredGraphqlUrl.startsWith("https://")) {
        _customerApiUrlCache = discoveredGraphqlUrl;
        return _customerApiUrlCache;
      }
    }
  } catch (err) {
    console.warn("[shopify/customer-auth] customer-api discovery failed, falling back:", err?.message);
  }

  _customerApiUrlCache = fallbackUrl;
  return _customerApiUrlCache;
}

export async function queryCustomerApi(accessToken, query, variables, origin) {
  const apiUrl = await getCustomerApiUrl();
  const headers = {
    "Content-Type": "application/json",
    Authorization: accessToken, // Raw shcat_* token, NOT "Bearer {token}"
  };
  if (origin) headers.Origin = origin;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const raw = await res.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new Error(`Customer API request failed (${res.status}): ${raw?.slice(0, 240) || "No body"}`);
  }

  if (payload?.errors?.length) {
    throw new Error(`Customer API GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }

  return payload?.data ?? null;
}

// -- Fetch customer profile via Customer Account API --------------------

export async function fetchCustomerProfile(accessToken, origin) {
  const queryWithPhone = `{
    customer {
      id
      firstName
      lastName
      emailAddress { emailAddress }
      phoneNumber { phoneNumber }
    }
  }`;
  const fallbackQuery = `{
    customer {
      id
      firstName
      lastName
      emailAddress { emailAddress }
    }
  }`;

  try {
    let data;
    try {
      data = await queryCustomerApi(accessToken, queryWithPhone, undefined, origin);
    } catch (err) {
      // Some stores/schemas may not expose phoneNumber in this context.
      data = await queryCustomerApi(accessToken, fallbackQuery, undefined, origin);
    }
    return data?.customer ?? null;
  } catch (err) {
    console.error("[shopify/customer-profile]", err);
    return null;
  }
}

// -- Cookie helpers -----------------------------------------------------

export const COOKIE_ACCESS_TOKEN = "shopify_ca_token";
export const COOKIE_REFRESH_TOKEN = "shopify_ca_refresh";
export const COOKIE_ID_TOKEN = "shopify_ca_id_token";
export const COOKIE_STATE = "shopify_oauth_state";
export const COOKIE_VERIFIER = "shopify_oauth_verifier";
export const COOKIE_RETURN_TO = "shopify_oauth_return_to";

export function makeTokenCookieOptions(expiresIn = 86400) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
  };
}

export function serializeCookie(name, value, opts = {}) {
  let str = `${name}=${encodeURIComponent(value)}`;
  if (opts.httpOnly) str += "; HttpOnly";
  if (opts.secure) str += "; Secure";
  if (opts.sameSite) str += `; SameSite=${opts.sameSite}`;
  if (opts.path) str += `; Path=${opts.path}`;
  if (opts.maxAge != null) str += `; Max-Age=${opts.maxAge}`;
  return str;
}
