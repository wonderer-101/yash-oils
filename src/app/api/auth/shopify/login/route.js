/**
 * GET /api/auth/shopify/login
 * Step 1 of OAuth2 PKCE flow.
 * Generates state + code_verifier, stores them in short-lived httpOnly cookies,
 * then redirects the user to Shopify's hosted login/signup page.
 */
import { NextResponse } from "next/server";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildAuthorizationUrl,
  resolveAppUrl,
  serializeCookie,
  COOKIE_STATE,
  COOKIE_VERIFIER,
  COOKIE_RETURN_TO,
} from "@/lib/shopify/customerAuth";

function normalizeReturnTo(value) {
  const target = String(value || "").trim();
  if (!target.startsWith("/")) return "";
  if (target.startsWith("//")) return "";
  if (/[\r\n]/.test(target)) return "";
  return target;
}

export async function GET(request) {
  const appUrl = resolveAppUrl(request);
  try {
    const { searchParams } = new URL(request.url);
    const returnTo = normalizeReturnTo(searchParams.get("return_to"));
    const redirectUri = `${appUrl}/api/auth/shopify/callback`;

    // Generate PKCE params
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Build the Shopify authorization URL
    const authUrl = await buildAuthorizationUrl({ state, codeChallenge, redirectUri });

    // Store state + verifier in short-lived httpOnly cookies (10 min)
    const stateOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 };
    const verifierOpts = { ...stateOpts };

    const response = NextResponse.redirect(authUrl);
    response.headers.append("Set-Cookie", serializeCookie(COOKIE_STATE, state, stateOpts));
    response.headers.append("Set-Cookie", serializeCookie(COOKIE_VERIFIER, codeVerifier, verifierOpts));
    const targetAfterLogin = returnTo || "/";
    response.headers.append("Set-Cookie", serializeCookie(COOKIE_RETURN_TO, targetAfterLogin, stateOpts));

    return response;
  } catch (err) {
    console.error("[shopify/login]", err);
    return NextResponse.redirect(
      `${appUrl}/?auth_error=login_failed`
    );
  }
}
