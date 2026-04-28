export function formatProductPrice(price) {
  if (!price?.amount || !price?.currencyCode) {
    return "Price unavailable";
  }

  const amount = Number.parseFloat(price.amount);
  if (Number.isNaN(amount)) {
    return "Price unavailable";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: price.currencyCode,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function deriveOldPrice(price, compareAtPrice) {
  if (!price?.amount || !price?.currencyCode || !compareAtPrice?.amount) {
    return null;
  }

  const currentAmount = Number.parseFloat(price.amount);
  const compareAmount = Number.parseFloat(compareAtPrice.amount);

  if (
    Number.isNaN(currentAmount) ||
    Number.isNaN(compareAmount) ||
    currentAmount <= 0 ||
    compareAmount <= currentAmount
  ) {
    return null;
  }

  return {
    amount: compareAmount.toFixed(2),
    currencyCode: compareAtPrice.currencyCode || price.currencyCode,
  };
}

export function deriveReviewCount(seed) {
  if (!seed) {
    return 5;
  }

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash + seed.charCodeAt(index)) % 41;
  }

  return 5 + (hash % 28);
}
