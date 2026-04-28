"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { fetchProductsByQuery } from "@/lib/client/shopifyClient";
import { formatProductPrice } from "@/lib/shopify/formatters";
import styles from "./HomePage.module.css";

const highlights = [
  { id: "01", title: "100% Natural Ingredients" },
  { id: "02", title: "Ayurvedic Expertise" },
  { id: "03", title: "Safe & Effective Formulation" },
  { id: "04", title: "Trusted Everyday Wellness" },
];

const testimonials = [
  {
    name: "Sophia Smith",
    text: "Swecha Pain Relief Oil really works. It helps after long work hours and gives fast relief.",
  },
  {
    name: "Neha Kulkarni",
    text: "I have used it for a few weeks now and it has become a must-have in my home.",
  },
  {
    name: "Rohan Patel",
    text: "Works great for joint and neck pain, and I am happy with the natural feel of the product.",
  },
];

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

export default function HomePage() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let ignore = false;
    fetchProductsByQuery({ limit: 8 })
      .then((result) => {
        if (!ignore) setProducts(result);
      })
      .catch(() => {
        if (!ignore) setProducts([]);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const heroProduct = products[0] ?? null;
  const featuredProducts = useMemo(() => products.slice(0, 4), [products]);

  return (
    <>
      <Header />
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Go Natural • Go Swecha</p>
            <h1>Swecha Pain Relief Oil</h1>
            <p>
              Swecha lets you move with freedom. Ayurvedic pain relief support for joints, muscles,
              shoulders, neck, and back.
            </p>
            <div className={styles.heroActions}>
              <Link href="/products" className={styles.primaryBtn}>
                Shop Now
              </Link>
              <Link href="/#about-us" className={styles.secondaryBtn}>
                Learn More
              </Link>
            </div>
          </div>
          <div className={styles.heroMedia}>
            {heroProduct?.image?.url ? (
              <img src={heroProduct.image.url} alt={heroProduct.image.alt || heroProduct.title} />
            ) : (
              <div className={styles.mediaFallback}>Product visual</div>
            )}
          </div>
        </section>

        <section id="about-us" className={styles.about}>
          <div className={styles.aboutMedia}>
            <Image
              src="/images/about-us.png"
              alt="Yash World of Wellness product presentation"
              width={900}
              height={900}
            />
          </div>
          <div className={styles.aboutContent}>
            <h2>About us</h2>
            <p>
              Yash World of Wellness is a brand rooted in the wisdom of Ayurveda and driven by a
              commitment to natural healing. We believe that true wellness comes from nature, and
              our mission is to bring time-tested herbal solutions into modern lifestyles.
            </p>
            <p>
              With a focus on purity, effectiveness, and safety, we create products that combine
              ancient Ayurvedic knowledge with contemporary formulations.
            </p>
            <p>At Yash World of Wellness, we are dedicated to:</p>
            <ul>
              <li>Promoting natural and holistic healing</li>
              <li>Ensuring 100% safe and effective formulations</li>
              <li>Delivering trusted wellness solutions for every home</li>
            </ul>
            <p className={styles.aboutTagline}>Go Natural • Go Swecha</p>
          </div>
        </section>

        <section className={styles.why}>
          <h2>Why Shop with Yash World of Wellness</h2>
          <p>Natural care. Real results. Trusted wellness you can rely on every day.</p>
          <div className={styles.whyLayout}>
            {highlights.map((item, index) => (
              <article key={item.id} className={`${styles.whyPoint} ${styles[`whyPoint${index + 1}`]}`}>
                <span>{item.id}</span>
                <h3>{item.title}</h3>
              </article>
            ))}
            <div className={styles.whyImageWrap}>
              <Image
                src="/images/why-shop.png"
                alt="Swecha Pain Relief Oil with natural ingredients"
                width={720}
                height={720}
              />
            </div>
          </div>
        </section>

        <section className={styles.featured}>
          <div className={styles.featuredHead}>
            <h2>Featured Products</h2>
            <Link href="/products">View all</Link>
          </div>
          <div className={styles.productGrid}>
            {featuredProducts.map((product) => (
              <Link key={product.id} href={`/products/${product.handle}`} className={styles.productCard}>
                <div className={styles.productImage}>
                  {product.image?.url ? (
                    <img src={product.image.url} alt={product.image.alt || product.title} />
                  ) : (
                    <span>No image</span>
                  )}
                </div>
                <h3>{product.title}</h3>
                <p>{formatProductPrice(product.price)}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.testimonials}>
          <h2>Our Happy Customers Say It Best</h2>
          <p>Natural care. Real results. Trusted wellness you can rely on every day.</p>
          <div className={styles.testimonialRail}>
            <div className={styles.testimonialGrid}>
              {testimonials.map((item) => (
                <article key={item.name} className={styles.reviewCard}>
                  <div className={styles.reviewHeader}>
                    <h3>{item.name}</h3>
                    <div className={styles.reviewAvatar} aria-hidden="true">
                      {getInitials(item.name)}
                    </div>
                  </div>
                  <p>{`"${item.text}"`}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
