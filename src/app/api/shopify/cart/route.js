import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getShopifyConfig } from "@/lib/shopify/config";
import { shopifyStorefrontGraphQL } from "@/lib/shopify/storefront";
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
} from "@/lib/shopify/customerAuth";

const CART_COOKIE = "hb_shopify_cart_id";

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount {
      amount
      currencyCode
    }
  }
  lines(first: 100) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            image {
              url
              altText
            }
            price {
              amount
              currencyCode
            }
            product {
              id
              title
              handle
            }
          }
        }
      }
    }
  }
`;

const CART_QUERY = `
  query CartById($id: ID!) {
    cart(id: $id) {
      ${CART_FIELDS}
    }
  }
`;

const CART_CREATE_MUTATION = `
  mutation CartCreate($lines: [CartLineInput!]) {
    cartCreate(input: { lines: $lines }) {
      cart {
        ${CART_FIELDS}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CART_LINES_ADD_MUTATION = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ${CART_FIELDS}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CART_LINES_UPDATE_MUTATION = `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ${CART_FIELDS}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CART_LINES_REMOVE_MUTATION = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ${CART_FIELDS}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

function toVariantGid(variantNumericId) {
  const raw = String(variantNumericId || "").trim();
  if (!/^\d+$/.test(raw)) return "";
  return `gid://shopify/ProductVariant/${raw}`;
}

function toVariantNumericId(variantGid) {
  const raw = String(variantGid || "");
  const last = raw.split("/").pop() || "";
  return /^\d+$/.test(last) ? last : "";
}

function parseQuantity(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 0), 50);
}

function getLineNodes(cart) {
  return cart?.lines?.edges?.map((edge) => edge?.node).filter(Boolean) || [];
}

function mapCartToResponse(cart) {
  const { storeDomain } = getShopifyConfig();
  const items = getLineNodes(cart)
    .map((line) => {
      const merchandise = line?.merchandise;
      const variantNumericId = toVariantNumericId(merchandise?.id);
      if (!variantNumericId) return null;
      const product = merchandise?.product;
      return {
        lineId: line.id,
        variantNumericId,
        id: String(product?.id || ""),
        handle: String(product?.handle || ""),
        title: String(product?.title || merchandise?.title || "Product"),
        image: merchandise?.image?.url
          ? {
              url: merchandise.image.url,
              alt: merchandise.image.altText || product?.title || "Product image",
            }
          : null,
        price: merchandise?.price?.amount
          ? {
              amount: String(merchandise.price.amount),
              currencyCode: merchandise.price.currencyCode || "INR",
            }
          : null,
        quantity: parseQuantity(line.quantity, 1),
        storeDomain,
      };
    })
    .filter(Boolean);

  let checkoutUrl = String(cart?.checkoutUrl || "");
  if (checkoutUrl && storeDomain) {
    try {
      const parsed = new URL(checkoutUrl);
      parsed.host = storeDomain;
      checkoutUrl = parsed.toString();
    } catch {
      // Keep original checkout URL if parsing fails.
    }
  }

  return {
    id: cart?.id || "",
    checkoutUrl,
    itemCount: Number(cart?.totalQuantity || items.reduce((acc, item) => acc + item.quantity, 0)),
    subtotalAmount: Number.parseFloat(cart?.cost?.subtotalAmount?.amount || "0") || 0,
    subtotalCurrency: cart?.cost?.subtotalAmount?.currencyCode || "INR",
    items,
  };
}

function assertNoUserErrors(payload, rootKey) {
  const userErrors = payload?.[rootKey]?.userErrors || [];
  if (userErrors.length) {
    const message = userErrors.map((err) => err?.message).filter(Boolean).join("; ") || "Shopify cart error";
    const error = new Error(message);
    error.userErrors = userErrors;
    throw error;
  }
}

async function fetchCartById(cartId) {
  if (!cartId) return null;
  const data = await shopifyStorefrontGraphQL({
    query: CART_QUERY,
    variables: { id: cartId },
    cache: "no-store",
  });
  return data?.cart || null;
}

async function createCart(lines = []) {
  const data = await shopifyStorefrontGraphQL({
    query: CART_CREATE_MUTATION,
    variables: { lines },
    cache: "no-store",
  });
  assertNoUserErrors(data, "cartCreate");
  return data?.cartCreate?.cart || null;
}

async function ensureCart(cookieStore) {
  const cookieCartId = cookieStore.get(CART_COOKIE)?.value || "";
  let existing = null;
  if (cookieCartId) {
    try {
      existing = await fetchCartById(cookieCartId);
    } catch {
      existing = null;
    }
  }
  if (existing?.id) {
    return { cart: existing, cartId: existing.id, created: false };
  }

  const created = await createCart();
  return { cart: created, cartId: created?.id || "", created: true };
}

function buildCurrentMap(cart) {
  const map = new Map();
  getLineNodes(cart).forEach((line) => {
    const variantGid = String(line?.merchandise?.id || "");
    if (!variantGid) return;
    map.set(variantGid, {
      lineId: line.id,
      quantity: parseQuantity(line.quantity, 0),
    });
  });
  return map;
}

function withCartCookie(response, cartId) {
  if (cartId) {
    response.cookies.set(CART_COOKIE, cartId, cookieOptions());
  }
  return response;
}

function isAuthenticated(cookieStore) {
  const access = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;
  const refresh = cookieStore.get(COOKIE_REFRESH_TOKEN)?.value;
  return Boolean(access || refresh);
}

async function applyTargetQuantities(cart, targetQuantitiesByVariant) {
  const cartId = cart?.id;
  if (!cartId) {
    throw new Error("Missing cart id.");
  }

  const currentMap = buildCurrentMap(cart);
  const allVariantGids = new Set([...currentMap.keys(), ...targetQuantitiesByVariant.keys()]);

  const linesToAdd = [];
  const linesToUpdate = [];
  const lineIdsToRemove = [];

  allVariantGids.forEach((variantGid) => {
    const current = currentMap.get(variantGid);
    const targetQty = parseQuantity(targetQuantitiesByVariant.get(variantGid), 0);

    if (!current) {
      if (targetQty > 0) {
        linesToAdd.push({ merchandiseId: variantGid, quantity: targetQty });
      }
      return;
    }

    if (targetQty <= 0) {
      lineIdsToRemove.push(current.lineId);
      return;
    }

    if (targetQty !== current.quantity) {
      linesToUpdate.push({ id: current.lineId, quantity: targetQty });
    }
  });

  let nextCart = cart;

  if (lineIdsToRemove.length) {
    const removeData = await shopifyStorefrontGraphQL({
      query: CART_LINES_REMOVE_MUTATION,
      variables: { cartId, lineIds: lineIdsToRemove },
      cache: "no-store",
    });
    assertNoUserErrors(removeData, "cartLinesRemove");
    nextCart = removeData?.cartLinesRemove?.cart || nextCart;
  }

  if (linesToUpdate.length) {
    const updateData = await shopifyStorefrontGraphQL({
      query: CART_LINES_UPDATE_MUTATION,
      variables: { cartId, lines: linesToUpdate },
      cache: "no-store",
    });
    assertNoUserErrors(updateData, "cartLinesUpdate");
    nextCart = updateData?.cartLinesUpdate?.cart || nextCart;
  }

  if (linesToAdd.length) {
    const addData = await shopifyStorefrontGraphQL({
      query: CART_LINES_ADD_MUTATION,
      variables: { cartId, lines: linesToAdd },
      cache: "no-store",
    });
    assertNoUserErrors(addData, "cartLinesAdd");
    nextCart = addData?.cartLinesAdd?.cart || nextCart;
  }

  return nextCart;
}

function badRequest(message) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    if (!isAuthenticated(cookieStore)) {
      return unauthorized();
    }

    const { cart, cartId } = await ensureCart(cookieStore);
    const response = NextResponse.json({
      ok: true,
      cart: mapCartToResponse(cart),
    });
    return withCartCookie(response, cartId);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error("[cart:get]", details);
    return NextResponse.json(
      { ok: false, error: "Could not load cart." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    if (!isAuthenticated(cookieStore)) {
      return unauthorized();
    }

    const { cart, cartId } = await ensureCart(cookieStore);
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "add").toLowerCase();

    let nextCart = cart;

    if (action === "add") {
      const variantGid = toVariantGid(body?.variantNumericId);
      const quantity = parseQuantity(body?.quantity, 1);
      if (!variantGid || quantity <= 0) {
        return badRequest("Valid variantNumericId and quantity are required.");
      }
      const current = buildCurrentMap(nextCart);
      const currentQty = current.get(variantGid)?.quantity || 0;
      const target = new Map();
      current.forEach((value, key) => target.set(key, value.quantity));
      target.set(variantGid, currentQty + quantity);
      nextCart = await applyTargetQuantities(nextCart, target);
    } else if (action === "sync") {
      const incoming = Array.isArray(body?.items) ? body.items : [];
      const current = buildCurrentMap(nextCart);
      const target = new Map();
      current.forEach((value, key) => target.set(key, value.quantity));

      incoming.forEach((item) => {
        const variantGid = toVariantGid(item?.variantNumericId);
        const quantity = parseQuantity(item?.quantity, 0);
        if (!variantGid || quantity <= 0) return;
        const currentQty = target.get(variantGid) || 0;
        target.set(variantGid, currentQty + quantity);
      });

      nextCart = await applyTargetQuantities(nextCart, target);
    } else {
      return badRequest("Unsupported cart action.");
    }

    const response = NextResponse.json({
      ok: true,
      cart: mapCartToResponse(nextCart),
    });
    return withCartCookie(response, cartId || nextCart?.id);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error("[cart:post]", details);
    return NextResponse.json(
      { ok: false, error: "Could not update cart." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const cookieStore = await cookies();
    if (!isAuthenticated(cookieStore)) {
      return unauthorized();
    }

    const { cart, cartId } = await ensureCart(cookieStore);
    const body = await request.json().catch(() => ({}));
    const variantGid = toVariantGid(body?.variantNumericId);
    const quantity = parseQuantity(body?.quantity, 0);
    if (!variantGid) {
      return badRequest("Valid variantNumericId is required.");
    }

    const current = buildCurrentMap(cart);
    const target = new Map();
    current.forEach((value, key) => target.set(key, value.quantity));
    target.set(variantGid, quantity);
    const nextCart = await applyTargetQuantities(cart, target);

    const response = NextResponse.json({
      ok: true,
      cart: mapCartToResponse(nextCart),
    });
    return withCartCookie(response, cartId || nextCart?.id);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error("[cart:patch]", details);
    return NextResponse.json(
      { ok: false, error: "Could not update cart quantity." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const cookieStore = await cookies();
    if (!isAuthenticated(cookieStore)) {
      return unauthorized();
    }

    const { cart, cartId } = await ensureCart(cookieStore);
    const body = await request.json().catch(() => ({}));
    const variantGid = toVariantGid(body?.variantNumericId);

    const current = buildCurrentMap(cart);
    if (!current.size) {
      const response = NextResponse.json({
        ok: true,
        cart: mapCartToResponse(cart),
      });
      return withCartCookie(response, cartId || cart?.id);
    }

    let nextCart = cart;
    if (variantGid) {
      const target = new Map();
      current.forEach((value, key) => target.set(key, value.quantity));
      target.set(variantGid, 0);
      nextCart = await applyTargetQuantities(cart, target);
    } else {
      const lineIds = Array.from(current.values()).map((value) => value.lineId).filter(Boolean);
      if (lineIds.length) {
        const removeData = await shopifyStorefrontGraphQL({
          query: CART_LINES_REMOVE_MUTATION,
          variables: { cartId: cart.id, lineIds },
          cache: "no-store",
        });
        assertNoUserErrors(removeData, "cartLinesRemove");
        nextCart = removeData?.cartLinesRemove?.cart || cart;
      }
    }

    const response = NextResponse.json({
      ok: true,
      cart: mapCartToResponse(nextCart),
    });
    return withCartCookie(response, cartId || nextCart?.id);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error("[cart:delete]", details);
    return NextResponse.json(
      { ok: false, error: "Could not remove cart item." },
      { status: 500 }
    );
  }
}
