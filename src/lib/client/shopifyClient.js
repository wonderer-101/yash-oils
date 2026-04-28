import { requestJson } from "@/lib/client/http";

// -- Auth ------------------------------------------------------------------

export async function fetchCurrentCustomer() {
  const response = await fetch("/api/auth/shopify/me", { cache: "no-store" });
  if (!response.ok) {
    return { customer: null };
  }
  const data = await response.json().catch(() => ({}));
  return { customer: data?.customer ?? null };
}

// -- Home / catalog ---------------------------------------------------------

export async function fetchCollections(limit = 12) {
  const data = await requestJson(`/api/shopify/collections?limit=${limit}`, {
    fallbackMessage: "Categories are temporarily unavailable. Please try again shortly.",
  });
  return data.collections ?? [];
}

export async function fetchProductsByQuery({ query = "", limit = 12 } = {}) {
  const encodedQuery = encodeURIComponent(query);
  const data = await requestJson(`/api/shopify/products?limit=${limit}&q=${encodedQuery}`, {
    fallbackMessage: "Products are temporarily unavailable. Please try again shortly.",
  });
  return data.products ?? [];
}

// -- Profile / account ------------------------------------------------------

export async function fetchCustomerOrders() {
  try {
    const data = await requestJson("/api/auth/shopify/orders", {
      fallbackMessage: "Unable to fetch orders.",
    });
    return data.orders || [];
  } catch {
    return [];
  }
}

export async function fetchCustomerAddresses() {
  try {
    const data = await requestJson("/api/auth/shopify/addresses", {
      fallbackMessage: "Unable to fetch addresses.",
    });
    return data.addresses || [];
  } catch {
    return [];
  }
}

export async function updateCustomerProfile(profile) {
  return requestJson("/api/auth/shopify/profile", {
    method: "PATCH",
    body: profile,
    fallbackMessage: "Failed to update profile.",
  });
}

export async function createCustomerAddress(payload) {
  return requestJson("/api/auth/shopify/addresses", {
    method: "POST",
    body: payload,
    fallbackMessage: "Failed to save address.",
  });
}

export async function updateCustomerAddress(payload) {
  return requestJson("/api/auth/shopify/addresses", {
    method: "PUT",
    body: payload,
    fallbackMessage: "Failed to save address.",
  });
}

export async function deleteCustomerAddress(addressId) {
  return requestJson("/api/auth/shopify/addresses", {
    method: "DELETE",
    body: { addressId },
    fallbackMessage: "Failed to delete address.",
  });
}

// -- Cart -------------------------------------------------------------------

export async function fetchShopifyCart() {
  const data = await requestJson("/api/shopify/cart", {
    method: "GET",
    fallbackMessage: "Could not load cart.",
  });
  return data.cart;
}

export async function addShopifyCartItem({ variantNumericId, quantity }) {
  const data = await requestJson("/api/shopify/cart", {
    method: "POST",
    body: { action: "add", variantNumericId, quantity },
    fallbackMessage: "Could not add item to cart.",
  });
  return data.cart;
}

export async function syncGuestCartToShopify(items) {
  const data = await requestJson("/api/shopify/cart", {
    method: "POST",
    body: { action: "sync", items },
    fallbackMessage: "Could not sync cart.",
  });
  return data.cart;
}

export async function updateShopifyCartItemQuantity({ variantNumericId, quantity }) {
  const data = await requestJson("/api/shopify/cart", {
    method: "PATCH",
    body: { variantNumericId, quantity },
    fallbackMessage: "Could not update quantity.",
  });
  return data.cart;
}

export async function removeShopifyCartItem(variantNumericId) {
  const data = await requestJson("/api/shopify/cart", {
    method: "DELETE",
    body: { variantNumericId },
    fallbackMessage: "Could not remove item from cart.",
  });
  return data.cart;
}

export async function clearShopifyCart() {
  const data = await requestJson("/api/shopify/cart", {
    method: "DELETE",
    body: {},
    fallbackMessage: "Could not clear cart.",
  });
  return data.cart;
}

