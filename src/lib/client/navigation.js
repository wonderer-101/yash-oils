export function redirectTo(url) {
  if (!url || typeof window === "undefined") return;
  window.location.assign(url);
}

export function replaceTo(url) {
  if (!url || typeof window === "undefined") return;
  window.location.replace(url);
}

export function redirectToShopifyLogin() {
  redirectTo("/api/auth/shopify/login");
}
