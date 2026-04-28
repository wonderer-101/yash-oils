/**
 * /api/auth/shopify/logout
 * - GET: clears auth cookies and redirects (for direct navigation).
 * - POST: clears auth cookies and returns JSON (for client-triggered logout).
 */
import { NextResponse } from "next/server";
import {
  getOpenIDConfig,
  resolveAppUrl,
  serializeCookie,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_ID_TOKEN,
  COOKIE_RETURN_TO,
} from "@/lib/shopify/customerAuth";

const SHOPIFY_CART_COOKIE = "hb_shopify_cart_id";

function normalizeReturnTo(value) {
  const target = String(value || "").trim();
  if (!target.startsWith("/")) return "/";
  if (target.startsWith("//")) return "/";
  if (/[\r\n]/.test(target)) return "/";
  return target;
}

function resolvePostLogoutRedirectUri(appUrl, returnTo) {
  const configured = (process.env.SHOPIFY_POST_LOGOUT_REDIRECT_URI || "").trim();
  if (configured) return configured;
  return `${appUrl}${returnTo}`;
}

async function buildHostedLogoutUrl({ idToken, postLogoutRedirectUri }) {
  try {
    const openIdConfig = await getOpenIDConfig();
    const endSessionEndpoint = openIdConfig?.end_session_endpoint;
    if (endSessionEndpoint) {
      const logoutUrl = new URL(endSessionEndpoint);
      logoutUrl.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);
      if (idToken) {
        logoutUrl.searchParams.set("id_token_hint", idToken);
      }
      return logoutUrl.toString();
    }
  } catch (error) {
    console.error("[shopify/logout] OpenID config lookup failed:", error);
  }

  const fallbackShopId = (process.env.SHOPIFY_SHOP_ID || "").trim();
  if (!fallbackShopId) {
    return postLogoutRedirectUri;
  }
  const fallbackUrl = new URL(`https://shopify.com/authentication/${fallbackShopId}/logout`);
  fallbackUrl.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);
  if (idToken) {
    fallbackUrl.searchParams.set("id_token_hint", idToken);
  }
  return fallbackUrl.toString();
}

function buildNoStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function appendClearCookies(response, clearOpts) {
  const secureVariants = clearOpts.secure ? [true, false] : [false];
  for (const secure of secureVariants) {
    const opts = { ...clearOpts, secure };
    response.headers.append("Set-Cookie", serializeCookie(COOKIE_ACCESS_TOKEN, "", opts));
    response.headers.append("Set-Cookie", serializeCookie(COOKIE_REFRESH_TOKEN, "", opts));
    response.headers.append("Set-Cookie", serializeCookie(COOKIE_ID_TOKEN, "", opts));
    response.headers.append("Set-Cookie", serializeCookie(COOKIE_RETURN_TO, "", opts));
    response.headers.append("Set-Cookie", serializeCookie(SHOPIFY_CART_COOKIE, "", opts));
  }
}

function buildClearOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}

function applyCommonHeaders(response) {
  const noStoreHeaders = buildNoStoreHeaders();
  Object.entries(noStoreHeaders).forEach(([key, value]) => response.headers.set(key, value));
}

async function clearAuthSession(request, { redirect } = { redirect: true }) {
  const appUrl = resolveAppUrl(request);
  const requestUrl = new URL(request.url);
  const returnTo = normalizeReturnTo(requestUrl.searchParams.get("return_to"));
  const hosted = requestUrl.searchParams.get("hosted") !== "0";
  const clearOpts = {
    ...buildClearOpts(),
  };

  let response;
  if (redirect) {
    let redirectTarget = `${appUrl}${returnTo}`;
    if (hosted) {
      const idToken = request.cookies.get(COOKIE_ID_TOKEN)?.value;
      const postLogoutRedirectUri = resolvePostLogoutRedirectUri(appUrl, returnTo);
      redirectTarget = await buildHostedLogoutUrl({ idToken, postLogoutRedirectUri });
    }
    response = NextResponse.redirect(redirectTarget);
  } else {
    response = NextResponse.json({ ok: true });
  }

  applyCommonHeaders(response);
  appendClearCookies(response, clearOpts);
  return response;
}

export async function GET(request) {
  return clearAuthSession(request, { redirect: true });
}

export async function POST(request) {
  return clearAuthSession(request, { redirect: false });
}
