import Link from "next/link";
import Image from "next/image";
import { FaFacebookF, FaInstagram, FaLinkedinIn } from "react-icons/fa6";
import styles from "./Footer.module.css";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/#about-us" },
  { label: "Contact Us", href: "/contact-us" },
];

export default function Footer() {
  return (
    <footer className={styles.footer} id="contact-us">
      <div className={styles.inner}>
        <section className={styles.brandCol}>
          <Image
            src="/icons/yash-logo.svg"
            alt="Yash World of Wellness"
            width={190}
            height={54}
            className={styles.logo}
          />
          <div className={styles.socials}>
            <a href="#" aria-label="LinkedIn" className={`${styles.socialLink} ${styles.linkedin}`}>
              <FaLinkedinIn />
            </a>
            <a href="#" aria-label="Facebook" className={`${styles.socialLink} ${styles.facebook}`}>
              <FaFacebookF />
            </a>
            <a href="#" aria-label="Instagram" className={`${styles.socialLink} ${styles.instagram}`}>
              <FaInstagram />
            </a>
          </div>
        </section>

        <section className={styles.navCol}>
          <h4>Navigation</h4>
          <nav className={styles.linkList} aria-label="Footer Navigation">
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </section>

        <section className={styles.newsletterCol}>
          <h4>Subscribe Our Newsletter</h4>
          <p className={styles.helpText}>
            Stay updated with the latest tips, features, and service trends.
          </p>
          <form className={styles.newsletter} action="#" method="post">
            <label htmlFor="footer-email">Your Email</label>
            <input id="footer-email" type="email" placeholder="Enter your email" aria-label="Email address" />
            <button type="submit">Subscribe</button>
          </form>
        </section>
      </div>
      <p className={styles.copy}>© {new Date().getFullYear()} Yash World of Wellness. All rights reserved.</p>
    </footer>
  );
}
