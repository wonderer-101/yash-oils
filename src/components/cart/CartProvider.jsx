"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import {
  addShopifyCartItem,
  clearShopifyCart,
  fetchShopifyCart,
  removeShopifyCartItem,
  syncGuestCartToShopify,
  updateShopifyCartItemQuantity,
} from "@/lib/client/shopifyClient";

const STORAGE_KEY = "hb_cart_v1";

const CartContext = createContext(null);

function normalizeQuantity(value, fallback = 1, min = 1) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), 50);
}

function normalizeStoreDomain(value) {
  return (value || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

function normalizeImage(image) {
  if (!image?.url) {
    return null;
  }

  return {
    url: image.url,
    alt: image.alt || "Product image",
  };
}

function normalizePrice(price) {
  if (!price?.amount || !price?.currencyCode) {
    return null;
  }

  return {
    amount: String(price.amount),
    currencyCode: price.currencyCode,
  };
}

function sanitizeItem(rawItem) {
  const variantNumericId = String(rawItem?.variantNumericId || "").trim();
  if (!/^\d+$/.test(variantNumericId)) {
    return null;
  }

  return {
    variantNumericId,
    id: String(rawItem?.id || ""),
    handle: String(rawItem?.handle || ""),
    title: String(rawItem?.title || "Product"),
    image: normalizeImage(rawItem?.image),
    price: normalizePrice(rawItem?.price),
    storeDomain: normalizeStoreDomain(rawItem?.storeDomain),
    quantity: normalizeQuantity(rawItem?.quantity),
  };
}

function priceToNumber(price) {
  const amount = Number.parseFloat(price?.amount || "");
  return Number.isFinite(amount) ? amount : 0;
}

function mergeItemIntoList(current, incoming) {
  const existingIndex = current.findIndex(
    (item) => item.variantNumericId === incoming.variantNumericId
  );
  if (existingIndex === -1) {
    return [...current, incoming];
  }

  const next = [...current];
  const existing = next[existingIndex];
  next[existingIndex] = {
    ...existing,
    ...incoming,
    quantity: normalizeQuantity(existing.quantity + incoming.quantity),
  };
  return next;
}

function readGuestItems() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => sanitizeItem(item)).filter(Boolean);
  } catch {
    return [];
  }
}

function writeGuestItems(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors.
  }
}

function clearGuestItems() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function toSyncPayload(items) {
  return items
    .map((item) => ({
      variantNumericId: String(item?.variantNumericId || ""),
      quantity: normalizeQuantity(item?.quantity, 0, 0),
    }))
    .filter((item) => /^\d+$/.test(item.variantNumericId) && item.quantity > 0);
}

export function CartProvider({ children }) {
  const { customer, loading: authLoading } = useAuth();
  const isLoggedIn = Boolean(customer);

  const [items, setItems] = useState([]);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);

  const applyShopifyCart = useCallback((cart) => {
    const nextItems = Array.isArray(cart?.items)
      ? cart.items.map((item) => sanitizeItem(item)).filter(Boolean)
      : [];
    setItems(nextItems);
    setCheckoutUrl(String(cart?.checkoutUrl || ""));
  }, []);

  const reloadShopifyCart = useCallback(async () => {
    try {
      const cart = await fetchShopifyCart();
      applyShopifyCart(cart);
    } catch {
      // Keep optimistic client state if refresh fails.
    }
  }, [applyShopifyCart]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let cancelled = false;

    async function initializeCart() {
      setHasHydrated(false);

      if (!isLoggedIn) {
        const guestItems = readGuestItems();
        if (cancelled) return;
        setItems(guestItems);
        setCheckoutUrl("");
        setHasHydrated(true);
        return;
      }

      const guestItems = readGuestItems();
      let synced = false;

      try {
        const cart = guestItems.length
          ? await syncGuestCartToShopify(toSyncPayload(guestItems))
          : await fetchShopifyCart();
        synced = true;
        if (cancelled) return;
        applyShopifyCart(cart);
      } catch {
        if (cancelled) return;
        setItems([]);
        setCheckoutUrl("");
      } finally {
        if (synced && guestItems.length) {
          clearGuestItems();
        }
        if (!cancelled) {
          setHasHydrated(true);
        }
      }
    }

    void initializeCart();

    return () => {
      cancelled = true;
    };
  }, [applyShopifyCart, authLoading, isLoggedIn]);

  useEffect(() => {
    if (!hasHydrated || isLoggedIn) {
      return;
    }
    writeGuestItems(items);
  }, [hasHydrated, isLoggedIn, items]);

  const addItem = useCallback(
    (product, quantity = 1) => {
      const incoming = sanitizeItem({
        ...product,
        quantity: normalizeQuantity(quantity),
      });

      if (!incoming) {
        return false;
      }

      if (!isLoggedIn) {
        setItems((current) => mergeItemIntoList(current, incoming));
        return true;
      }

      setItems((current) => mergeItemIntoList(current, incoming));
      void addShopifyCartItem({
        variantNumericId: incoming.variantNumericId,
        quantity: incoming.quantity,
      })
        .then((cart) => applyShopifyCart(cart))
        .catch(() => {
          void reloadShopifyCart();
        });
      return true;
    },
    [applyShopifyCart, isLoggedIn, reloadShopifyCart]
  );

  const updateQuantity = useCallback(
    (variantNumericId, quantity) => {
      const normalizedQuantity = normalizeQuantity(quantity, 0, 0);

      if (!isLoggedIn) {
        setItems((current) => {
          if (normalizedQuantity <= 0) {
            return current.filter((item) => item.variantNumericId !== variantNumericId);
          }

          return current.map((item) =>
            item.variantNumericId === variantNumericId
              ? {
                  ...item,
                  quantity: normalizedQuantity,
                }
              : item
          );
        });
        return;
      }

      setItems((current) => {
        if (normalizedQuantity <= 0) {
          return current.filter((item) => item.variantNumericId !== variantNumericId);
        }

        return current.map((item) =>
          item.variantNumericId === variantNumericId
            ? {
                ...item,
                quantity: normalizedQuantity,
              }
            : item
        );
      });

      void updateShopifyCartItemQuantity({
        variantNumericId,
        quantity: normalizedQuantity,
      })
        .then((cart) => applyShopifyCart(cart))
        .catch(() => {
          void reloadShopifyCart();
        });
    },
    [applyShopifyCart, isLoggedIn, reloadShopifyCart]
  );

  const removeItem = useCallback(
    (variantNumericId) => {
      if (!isLoggedIn) {
        setItems((current) => current.filter((item) => item.variantNumericId !== variantNumericId));
        return;
      }

      setItems((current) => current.filter((item) => item.variantNumericId !== variantNumericId));
      void removeShopifyCartItem(variantNumericId)
        .then((cart) => applyShopifyCart(cart))
        .catch(() => {
          void reloadShopifyCart();
        });
    },
    [applyShopifyCart, isLoggedIn, reloadShopifyCart]
  );

  const clearCart = useCallback(() => {
    if (!isLoggedIn) {
      setItems([]);
      return;
    }

    setItems([]);
    setCheckoutUrl("");
    void clearShopifyCart()
      .then((cart) => applyShopifyCart(cart))
      .catch(() => {
        void reloadShopifyCart();
      });
  }, [applyShopifyCart, isLoggedIn, reloadShopifyCart]);

  const itemCount = useMemo(
    () => items.reduce((total, item) => total + normalizeQuantity(item.quantity), 0),
    [items]
  );

  const subtotalAmount = useMemo(
    () => items.reduce((total, item) => total + priceToNumber(item.price) * item.quantity, 0),
    [items]
  );

  const subtotalCurrency = useMemo(
    () => items.find((item) => item.price?.currencyCode)?.price?.currencyCode || "INR",
    [items]
  );

  const cartUrl = useMemo(() => {
    if (!checkoutUrl) return "";
    return checkoutUrl.split("?")[0] || "";
  }, [checkoutUrl]);

  const effectiveCheckoutUrl = useMemo(() => {
    if (!isLoggedIn) return "";
    return checkoutUrl;
  }, [checkoutUrl, isLoggedIn]);

  const value = useMemo(
    () => ({
      hasHydrated,
      items,
      itemCount,
      subtotalAmount,
      subtotalCurrency,
      cartUrl,
      checkoutUrl: effectiveCheckoutUrl,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    }),
    [
      addItem,
      cartUrl,
      clearCart,
      effectiveCheckoutUrl,
      hasHydrated,
      itemCount,
      items,
      removeItem,
      subtotalAmount,
      subtotalCurrency,
      updateQuantity,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error("useCart must be used inside CartProvider.");
  }
  return value;
}
