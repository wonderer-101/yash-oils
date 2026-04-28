/**
 * GET /api/auth/shopify/callback
 * Step 2 of OAuth2 PKCE flow.
 * Shopify redirects here with ?code=... & ?state=...
 * We verify state, exchange code for tokens, store them in httpOnly cookies.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForToken,
  resolveAppUrl,
  serializeCookie,
  makeTokenCookieOptions,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_ID_TOKEN,
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
  const redirectUri = `${appUrl}/api/auth/shopify/callback`;

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle Shopify-side errors (e.g. user cancelled)
    if (error) {
      console.error("[shopify/callback] Shopify error:", error);
      return NextResponse.redirect(`${appUrl}/?auth_error=${error}`);
    }

    if (!code || !returnedState) {
      return NextResponse.redirect(`${appUrl}/?auth_error=missing_params`);
    }

    // Read cookies
    const cookieStore = await cookies();
    const savedState = cookieStore.get(COOKIE_STATE)?.value;
    const codeVerifier = cookieStore.get(COOKIE_VERIFIER)?.value;
    const returnTo = normalizeReturnTo(cookieStore.get(COOKIE_RETURN_TO)?.value);

    // Verify CSRF state
    if (!savedState || savedState !== returnedState) {
      console.error("[shopify/callback] State mismatch");
      return NextResponse.redirect(`${appUrl}/?auth_error=state_mismatch`);
    }

    if (!codeVerifier) {
      return NextResponse.redirect(`${appUrl}/?auth_error=missing_verifier`);
    }

    // Exchange code for tokens
    const { accessToken, refreshToken, expiresIn, idToken } = await exchangeCodeForToken({
      code,
      codeVerifier,
      redirectUri,
      origin: appUrl,
    });

    // Redirect back to requested path when present, else homepage.
    const redirectTarget = returnTo ? `${appUrl}${returnTo}` : `${appUrl}/`;
    const response = NextResponse.redirect(redirectTarget);

    // Store access token (expire with token lifetime)
    response.headers.append(
      "Set-Cookie",
      serializeCookie(COOKIE_ACCESS_TOKEN, accessToken, makeTokenCookieOptions(expiresIn || 86400))
    );

    // Store refresh token for 30 days
    if (refreshToken) {
      response.headers.append(
        "Set-Cookie",
        serializeCookie(COOKIE_REFRESH_TOKEN, refreshToken, makeTokenCookieOptions(60 * 60 * 24 * 30))
      );
    }

    if (idToken) {
      response.headers.append(
        "Set-Cookie",
        serializeCookie(COOKIE_ID_TOKEN, idToken, makeTokenCookieOptions(60 * 60 * 24 * 30))
      );
    }

    // Clear PKCE cookies
    const clearOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 };
    response.headers.append("Set-Cookie", serializeCookie(COOKIE_STATE, "", clearOpts));
    response.headers.append("Set-Cookie", serializeCookie(COOKIE_VERIFIER, "", clearOpts));
    response.headers.append("Set-Cookie", serializeCookie(COOKIE_RETURN_TO, "", clearOpts));

    return response;
  } catch (err) {
    console.error("[shopify/callback]", err);
    return NextResponse.redirect(`${appUrl}/?auth_error=callback_failed`);
  }
}
