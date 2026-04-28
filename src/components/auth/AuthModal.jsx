"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import styles from "./AuthModal.module.css";

export default function AuthModal({ isOpen, onClose }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in or create account"
    >
      <div className={styles.modal}>
        {/* Decorative top band */}
        <div className={styles.topBand} />

        {/* Close button */}
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {/* Logo */}
        <div className={styles.brandMark}>
          <Image
            src="/icons/yash-logo.svg"
            alt="Yash World of Wellness"
            width={210}
            height={58}
            priority
          />
        </div>

        <h2 className={styles.title}>Welcome</h2>
        <p className={styles.subtitle}>
          Sign in or create an account to access your orders, wishlist, and more
        </p>

        {/* Single CTA -- Shopify handles login vs signup on their page */}
        <div className={styles.actions}>
          <a href="/api/auth/shopify/login" className={styles.primaryBtn}>
            Continue with Email
          </a>
        </div>

        <p className={styles.note}>
          You will receive a one-time code to your email to securely sign in or create a new
          account &mdash; no password needed.
        </p>

        {/* Bottom ornament */}
        <div className={styles.ornament} aria-hidden="true">
          <span />
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 1L10.5 7H16.5L11.5 10.5L13.5 17L9 13.5L4.5 17L6.5 10.5L1.5 7H7.5L9 1Z"
              fill="#c5a028"
              opacity="0.5"
            />
          </svg>
          <span />
        </div>
      </div>
    </div>
  );
}
