/**
 * GET /api/auth/shopify/me
 * Returns the current customer profile from the Customer Account API.
 * Returns 200 with { customer: null } when not logged in.
 * Returns 200 with customer data when logged in.
 * Used by the React AuthContext to determine login state on the client.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  refreshAccessToken,
  resolveAppUrl,
  serializeCookie,
  makeTokenCookieOptions,
  fetchCustomerProfile,
} from "@/lib/shopify/customerAuth";

export async function GET(request) {
  try {
    const appUrl = resolveAppUrl(request);
    const cookieStore = await cookies();
    let accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;
    const refreshToken = cookieStore.get(COOKIE_REFRESH_TOKEN)?.value;
    let refreshed = null;

    // If no access token but we have a refresh token, refresh first.
    if (!accessToken && refreshToken) {
      try {
        refreshed = await refreshAccessToken(refreshToken, appUrl);
        accessToken = refreshed.accessToken;
      } catch {
        return NextResponse.json({ customer: null }, { status: 200 });
      }
    }

    if (!accessToken) {
      return NextResponse.json({ customer: null }, { status: 200 });
    }

    // First attempt with existing token
    let customer = await fetchCustomerProfile(accessToken, appUrl);

    // If token is stale, retry once after refresh
    if (!customer && refreshToken) {
      try {
        console.log("[shopify/me] access token returned null, attempting refresh...");
        refreshed = await refreshAccessToken(refreshToken, appUrl);
        accessToken = refreshed.accessToken;
        customer = await fetchCustomerProfile(accessToken, appUrl);
      } catch (refreshErr) {
        console.error("[shopify/me] refresh failed:", refreshErr?.message);
        return NextResponse.json({ customer: null }, { status: 200 });
      }
    }

    if (!customer) {
      console.warn("[shopify/me] fetchCustomerProfile returned null. Check SHOPIFY_STORE_DOMAIN and token validity.");
      console.warn("[shopify/me] SHOPIFY_STORE_DOMAIN =", process.env.SHOPIFY_STORE_DOMAIN || "(NOT SET)");
    }

    if (!customer) {
      return NextResponse.json({ customer: null }, { status: 200 });
    }

    const response = NextResponse.json({ customer });
    if (refreshed?.accessToken) {
      response.headers.append(
        "Set-Cookie",
        serializeCookie(
          COOKIE_ACCESS_TOKEN,
          refreshed.accessToken,
          makeTokenCookieOptions(refreshed.expiresIn || 86400)
        )
      );
      if (refreshed.refreshToken) {
        response.headers.append(
          "Set-Cookie",
          serializeCookie(
            COOKIE_REFRESH_TOKEN,
            refreshed.refreshToken,
            makeTokenCookieOptions(60 * 60 * 24 * 30)
          )
        );
      }
    }

    return response;
  } catch (err) {
    console.error("[shopify/me]", err);
    return NextResponse.json({ customer: null }, { status: 500 });
  }
}
