"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Headset, Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { deriveOldPrice, formatProductPrice } from "@/lib/shopify/formatters";
import styles from "./YashProductDetailView.module.css";

function clampQuantity(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), 20);
}

export default function YashProductDetailView({ product }) {
  const images = product.images?.length ? product.images : product.image ? [product.image] : [];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState("idle");
  const { addItem, itemCount } = useCart();

  const selectedImage = images[selectedIndex] || images[0] || null;
  const oldPrice = deriveOldPrice(product.price, product.compareAtPrice);
  const linePrice = useMemo(() => {
    const amount = Number.parseFloat(product.price?.amount || "0");
    return Number.isFinite(amount) ? amount * quantity : 0;
  }, [product.price?.amount, quantity]);

  const description = product.description?.trim() || "";
  const descriptionParagraphs = description
    ? description.split(/\n+/).map((line) => line.trim()).filter(Boolean)
    : [
        "Swecha Pain Relief Oil is crafted with natural herbs to provide fast and effective relief from joint pain, muscle soreness, and stiffness.",
        "Designed for everyday use, it supports mobility and comfort while staying gentle for regular wellness routines.",
      ];

  function onAddToCart() {
    if (!product.variantNumericId || !product.storeDomain) {
      setStatus("error");
      return;
    }

    const ok = addItem(product, quantity);
    setStatus(ok ? "added" : "error");
  }

  function onDecreaseQuantity() {
    setQuantity((prev) => Math.max(prev - 1, 1));
  }

  function onIncreaseQuantity() {
    setQuantity((prev) => Math.min(prev + 1, 20));
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <nav className={styles.breadcrumb}>
          <Link href="/">Home</Link>
          <span className={styles.sep}>/</span>
          <Link href="/products">Products</Link>
          <span className={styles.sep}>/</span>
          <span>{product.title}</span>
        </nav>

        <div className={styles.layout}>
          <section className={styles.mediaCard}>
            <div className={styles.galleryLayout}>
              <aside className={styles.thumbRail}>
                {images.map((image, index) => (
                  <button
                    key={`${image.url}-${index}`}
                    type="button"
                    className={styles.thumb}
                    data-active={index === selectedIndex ? "true" : "false"}
                    onClick={() => setSelectedIndex(index)}
                    aria-label={`Show image ${index + 1}`}
                  >
                    <img src={image.url} alt={image.alt || product.title} />
                  </button>
                ))}
              </aside>

              <div className={styles.mainImage}>
                {selectedImage ? (
                  <img src={selectedImage.url} alt={selectedImage.alt || product.title} />
                ) : (
                  <span>Image unavailable</span>
                )}
              </div>
            </div>
          </section>

          <section className={styles.infoCard}>
            <p className={styles.tagline}>Go Natural • Go Swecha</p>
            <h1>{product.title}</h1>

            <div className={styles.stockRow}>
              <div className={styles.stock}>
                <CheckCircle2 size={17} />
                <span>In stock</span>
              </div>
              {oldPrice ? <span className={styles.saleChip}>Sale</span> : null}
            </div>

            <p className={styles.descLead}>
              Ancient and effective pain relief formula for joint pain, muscle pain, back pain,
              shoulder pain, neck pain and headache support.
            </p>

            <div className={styles.prices}>
              <strong>{formatProductPrice(product.price)}</strong>
              {oldPrice ? <span>{formatProductPrice(oldPrice)}</span> : null}
            </div>
            <p className={styles.tax}>Inclusive of all taxes</p>

            <div className={styles.purchasePanel}>
              <div className={styles.quantityWrap}>
                <label htmlFor="quantity">Quantity</label>
                <div className={styles.quantityControl}>
                  <button type="button" className={styles.qtyBtn} onClick={onDecreaseQuantity} aria-label="Decrease quantity">
                    <Minus size={14} />
                  </button>
                  <input
                    id="quantity"
                    type="number"
                    min={1}
                    max={20}
                    value={quantity}
                    onChange={(event) => setQuantity(clampQuantity(event.target.value))}
                  />
                  <button type="button" className={styles.qtyBtn} onClick={onIncreaseQuantity} aria-label="Increase quantity">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className={styles.linePreview}>
                <span>Estimated total</span>
                <strong>
                  {formatProductPrice({
                    amount: linePrice.toFixed(2),
                    currencyCode: product.price?.currencyCode || "INR",
                  })}
                </strong>
              </div>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.addBtn} onClick={onAddToCart}>
                Add to Cart
              </button>
              <Link href="/cart" className={styles.viewCart}>
                View Cart ({itemCount})
              </Link>
            </div>

            {status === "added" ? <p className={styles.ok}>Added to cart.</p> : null}
            {status === "error" ? <p className={styles.err}>Could not add item right now.</p> : null}

            <div className={styles.trustGrid} aria-label="Trust highlights">
              <article className={styles.trustItem}>
                <span className={styles.trustIcon}>
                  <Truck size={14} />
                </span>
                Express Shipping
              </article>
              <article className={styles.trustItem}>
                <span className={styles.trustIcon}>
                  <ShieldCheck size={14} />
                </span>
                Secure Checkout
              </article>
              <article className={styles.trustItem}>
                <span className={styles.trustIcon}>
                  <CheckCircle2 size={14} />
                </span>
                Natural Formula
              </article>
              <article className={styles.trustItem}>
                <span className={styles.trustIcon}>
                  <Headset size={14} />
                </span>
                Premium Support
              </article>
            </div>
          </section>
        </div>

        <section className={styles.descriptionCard}>
          <h2>Product Description</h2>
          <div className={styles.longDesc}>
            {descriptionParagraphs.map((text, index) => (
              <p key={`${index}-${text.slice(0, 18)}`}>{text}</p>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
