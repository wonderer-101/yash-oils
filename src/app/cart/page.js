"use client";

import Link from "next/link";
import { Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Truck } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { useAuth } from "@/components/auth/AuthContext";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { redirectTo, redirectToShopifyLogin } from "@/lib/client/navigation";
import styles from "./cart.module.css";

function formatMoney(amount, currencyCode = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function CartPage() {
  const { customer, loading: authLoading } = useAuth();
  const {
    hasHydrated,
    items,
    itemCount,
    subtotalAmount,
    subtotalCurrency,
    checkoutUrl,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();

  function handleCheckout(e) {
    e.preventDefault();
    if (authLoading) return;
    if (!customer) {
      redirectToShopifyLogin();
      return;
    }
    if (checkoutUrl) {
      redirectTo(checkoutUrl);
      return;
    }
    redirectTo("/checkout");
  }

  let content;

  if (!hasHydrated) {
    content = (
      <section className={styles.stateWrap}>
        <h1 className={styles.heading}>Cart</h1>
        <div className={styles.loadingCard}>
          <p className={styles.helper}>Loading your cart...</p>
        </div>
      </section>
    );
  } else if (!items.length) {
    content = (
      <section className={styles.stateWrap}>
        <h1 className={styles.heading}>Cart</h1>
        <div className={styles.emptyCard}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <ShoppingBag size={18} />
          </span>
          <h2>Your cart is empty</h2>
          <p>Add products from the collection to start checkout.</p>
          <Link href="/" className={styles.primaryBtn}>
            Continue Shopping
          </Link>
        </div>
      </section>
    );
  } else {
    content = (
      <>
        <section className={styles.headingBlock}>
          <p className={styles.headingEyebrow}>Your bag</p>
          <div className={styles.topRow}>
            <h1 className={styles.heading}>Cart ({itemCount})</h1>
            <button type="button" className={styles.clearBtn} onClick={clearCart}>
              Clear cart
            </button>
          </div>
          <p className={styles.helper}>Review items and continue with secure Shopify checkout.</p>
          <div className={styles.infoChips}>
            <span className={styles.infoChip}>
              <Truck size={14} aria-hidden="true" />
              Express shipping
            </span>
            <span className={styles.infoChip}>
              <ShieldCheck size={14} aria-hidden="true" />
              Secure checkout
            </span>
          </div>
        </section>

        <div className={styles.layout}>
          <div className={styles.itemsWrap}>
            {items.map((item) => {
              const unitPrice = Number.parseFloat(item.price?.amount || "0") || 0;
              const currency = item.price?.currencyCode || subtotalCurrency;
              const linePrice = unitPrice * item.quantity;

              return (
                <article key={item.variantNumericId} className={styles.itemCard}>
                  <Link href={item.handle ? `/products/${item.handle}` : "#"} className={styles.imageLink}>
                    {item.image?.url ? (
                      <img src={item.image.url} alt={item.image.alt || item.title} className={styles.itemImage} />
                    ) : (
                      <span className={styles.itemImageFallback}>No image</span>
                    )}
                  </Link>

                  <div className={styles.itemInfo}>
                    <Link href={item.handle ? `/products/${item.handle}` : "#"} className={styles.itemTitle}>
                      {item.title}
                    </Link>
                    <p className={styles.itemMeta}>Unit price: {formatMoney(unitPrice, currency)}</p>
                    <div className={styles.priceBlock}>
                      <span className={styles.lineTotalLabel}>Line total</span>
                      <p className={styles.itemPrice}>{formatMoney(linePrice, currency)}</p>
                    </div>

                    <div className={styles.itemActions}>
                      <div className={styles.qtyControl}>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.variantNumericId, item.quantity - 1)}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.variantNumericId, item.quantity + 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => removeItem(item.variantNumericId)}
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className={styles.summaryCard}>
            <h2 className={styles.summaryTitle}>Order Summary</h2>
            <div className={styles.summaryRow}>
              <span>Items ({itemCount})</span>
              <strong>{formatMoney(subtotalAmount, subtotalCurrency)}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Shipping</span>
              <span>Calculated at checkout</span>
            </div>
            <div className={`${styles.summaryRow} ${styles.summaryRowTotal}`}>
              <span>Estimated total</span>
              <strong>{formatMoney(subtotalAmount, subtotalCurrency)}</strong>
            </div>
            <p className={styles.summaryHint}>Taxes and shipping are calculated on Shopify checkout.</p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleCheckout}
              disabled={authLoading}
            >
              Checkout
            </button>
            <Link href="/" className={styles.secondaryBtn}>
              Continue Shopping
            </Link>
            <div className={styles.secureRow}>
              <ShieldCheck size={14} aria-hidden="true" />
              100% secure Shopify checkout
            </div>
          </aside>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className={styles.page}>
        <section className={styles.shell}>{content}</section>
      </main>
      <Footer />
    </>
  );
}
