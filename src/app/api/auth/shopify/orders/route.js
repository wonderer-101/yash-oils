/**
 * GET /api/auth/shopify/orders
 * Returns the current customer orders from Customer Account API.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  refreshAccessToken,
  resolveAppUrl,
  queryCustomerApi,
} from "@/lib/shopify/customerAuth";

const ORDER_QUERY_PRIMARY = `{
  customer {
    orders(first: 20) {
      edges {
        node {
          id
          name
          processedAt
          financialStatus
          fulfillmentStatus
          statusPageUrl
          totalPrice { amount currencyCode }
        }
      }
    }
  }
}`;

const ORDER_QUERY_FALLBACK = `{
  customer {
    orders(first: 20) {
      edges {
        node {
          id
          name
          processedAt
          financialStatus
          fulfillmentStatus
          statusPageUrl
          currentTotalPrice { amount currencyCode }
        }
      }
    }
  }
}`;

export async function GET(request) {
  try {
    const appUrl = resolveAppUrl(request);
    const cookieStore = await cookies();
    let accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;
    const refreshToken = cookieStore.get(COOKIE_REFRESH_TOKEN)?.value;

    if (!accessToken && refreshToken) {
      try {
        const refreshed = await refreshAccessToken(refreshToken, appUrl);
        accessToken = refreshed.accessToken;
      } catch {
        return NextResponse.json({ orders: [] }, { status: 200 });
      }
    }

    if (!accessToken) {
      return NextResponse.json({ orders: [] }, { status: 200 });
    }

    let data;
    try {
      data = await queryCustomerApi(accessToken, ORDER_QUERY_PRIMARY, undefined, appUrl);
    } catch (primaryErr) {
      console.warn("[shopify/orders] primary query failed, retrying fallback:", primaryErr?.message);
      data = await queryCustomerApi(accessToken, ORDER_QUERY_FALLBACK, undefined, appUrl);
    }

    const edges = data?.customer?.orders?.edges || [];
    const orders = edges.map(({ node }) => ({
      id: node.id,
      name: node.name,
      processedAt: node.processedAt,
      financialStatus: node.financialStatus,
      fulfillmentStatus: node.fulfillmentStatus,
      statusPageUrl: node.statusPageUrl,
      totalPrice: node.totalPrice || node.currentTotalPrice || null,
      lineItems: [],
    }));

    return NextResponse.json({ orders });
  } catch (err) {
    console.error("[shopify/orders]", err);
    return NextResponse.json({ orders: [] }, { status: 200 });
  }
}
