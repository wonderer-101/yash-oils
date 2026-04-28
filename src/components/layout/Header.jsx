"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { useAuth } from "@/components/auth/AuthContext";
import { redirectToShopifyLogin } from "@/lib/client/navigation";
import styles from "./Header.module.css";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Contact Us", href: "/contact-us" },
];

function isActive(pathname, hash, href) {
  if (href === "/") return pathname === "/" && !hash;
  if (href.startsWith("/#")) return pathname === "/" && hash === href.slice(1);
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { itemCount } = useCart();
  const { customer, loading: authLoading } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState("");

  const userLink = useMemo(() => (customer ? "/profile" : null), [customer]);

  useEffect(() => {
    function syncHash() {
      setCurrentHash(window.location.hash || "");
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = String(data.get("q") || "").trim();
    if (!query) return;
    setSearchOpen(false);
    router.push(`/products?q=${encodeURIComponent(query)}`);
  }

  return (
    <>
      <div className={styles.headerOffset} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.inner}>
          <button
            type="button"
            className={styles.mobileToggle}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/" className={styles.brand} aria-label="Yash World of Wellness">
            <Image src="/icons/yash-logo.svg" alt="Yash World of Wellness" width={240} height={66} priority />
          </Link>

          <nav className={styles.nav} aria-label="Primary navigation">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} data-active={isActive(pathname, currentHash, item.href)}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Search"
              onClick={() => setSearchOpen((prev) => !prev)}
            >
              <Search size={18} />
            </button>
            {authLoading ? null : userLink ? (
              <Link href={userLink} className={styles.iconBtn} aria-label="Profile">
                <User size={18} />
              </Link>
            ) : (
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Sign in"
                onClick={redirectToShopifyLogin}
              >
                <User size={18} />
              </button>
            )}
            <Link href="/cart" className={`${styles.iconBtn} ${styles.cartBtn}`} aria-label="Cart">
              <ShoppingBag size={18} />
              {itemCount > 0 ? <span className={styles.badge}>{itemCount}</span> : null}
            </Link>
          </div>
        </div>

        <div className={styles.searchWrap} data-open={searchOpen ? "true" : "false"}>
          <form className={styles.searchForm} onSubmit={handleSearchSubmit} role="search">
            <Search size={16} />
            <input type="search" name="q" placeholder="Search products..." />
            <button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)}>
              <X size={16} />
            </button>
          </form>
        </div>

        <div className={styles.mobileNav} data-open={mobileOpen ? "true" : "false"}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-active={isActive(pathname, currentHash, item.href)}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>
    </>
  );
}
