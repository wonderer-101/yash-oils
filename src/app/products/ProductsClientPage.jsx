/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { fetchProductsByQuery } from "@/lib/client/shopifyClient";
import { formatProductPrice } from "@/lib/shopify/formatters";
import styles from "./products.module.css";

export default function ProductsClientPage({ query }) {
  const normalizedQuery = (query || "").trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");

    fetchProductsByQuery({ query: normalizedQuery, limit: 24 })
      .then((result) => {
        if (!ignore) setProducts(result);
      })
      .catch((err) => {
        if (!ignore) {
          setProducts([]);
          setError(err?.message || "Unable to load products right now.");
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [normalizedQuery]);

  const pageTitle = useMemo(
    () => (normalizedQuery ? `Search: ${normalizedQuery}` : "Our Products"),
    [normalizedQuery]
  );

  return (
    <>
      <Header />
      <main className={styles.page}>
        <section className={styles.head}>
          <h1>{pageTitle}</h1>
          <p>Ayurvedic wellness solutions crafted for daily relief and care.</p>
        </section>

        {loading ? <p className={styles.stateText}>Loading products...</p> : null}
        {!loading && error ? <p className={styles.stateText}>{error}</p> : null}

        {!loading && !error ? (
          products.length ? (
            <section className={styles.grid}>
              {products.map((product) => (
                <Link key={product.id} href={`/products/${product.handle}`} className={styles.card}>
                  <div className={styles.cardMedia}>
                    {product.image?.url ? (
                      <img src={product.image.url} alt={product.image.alt || product.title} />
                    ) : (
                      <span>No image</span>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <h2>{product.title}</h2>
                    <p>{formatProductPrice(product.price)}</p>
                  </div>
                </Link>
              ))}
            </section>
          ) : (
            <p className={styles.stateText}>No products found for this query.</p>
          )
        ) : null}
      </main>
      <Footer />
    </>
  );
}

