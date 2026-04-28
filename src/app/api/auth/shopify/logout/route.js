/**
 * GET /api/auth/shopify/logout
 * Clears auth cookies and redirects to homepage.
 */
import { NextResponse } from "next/server";
import {
  resolveAppUrl,
  serializeCookie,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
} from "@/lib/shopify/customerAuth";

const SHOPIFY_CART_COOKIE = "hb_shopify_cart_id";

export async function GET(request) {
  const appUrl = resolveAppUrl(request);
  const clearOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };

  const response = NextResponse.redirect(`${appUrl}/`);
  response.headers.append("Set-Cookie", serializeCookie(COOKIE_ACCESS_TOKEN, "", clearOpts));
  response.headers.append("Set-Cookie", serializeCookie(COOKIE_REFRESH_TOKEN, "", clearOpts));
  response.headers.append("Set-Cookie", serializeCookie(SHOPIFY_CART_COOKIE, "", clearOpts));
  return response;
}
