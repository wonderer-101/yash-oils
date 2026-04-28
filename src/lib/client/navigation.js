export function redirectTo(url) {
  if (!url || typeof window === "undefined") return;
  window.location.assign(url);
}

export function replaceTo(url) {
  if (!url || typeof window === "undefined") return;
  window.location.replace(url);
}

export function redirectToShopifyLogin(returnTo = "") {
  const target = String(returnTo || "").trim();
  if (target.startsWith("/")) {
    const encoded = encodeURIComponent(target);
    redirectTo(`/api/auth/shopify/login?return_to=${encoded}`);
    return;
  }
  redirectTo("/api/auth/shopify/login");
}
