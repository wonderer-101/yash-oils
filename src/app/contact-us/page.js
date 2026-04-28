import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppContactForm from "@/components/contact/WhatsAppContactForm";
import Image from "next/image";
import { Building2, Mail, PhoneCall } from "lucide-react";
import styles from "./contact.module.css";

export const metadata = {
  title: "Contact Us | Yash World of Wellness",
  description: "Reach Yash World of Wellness for product support and enquiries.",
};

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className={styles.page}>
        <section className={styles.hero}>
          <h1>Contact Us</h1>
          <p>Have questions or need support? Get in touch with Yash World of Wellness.</p>
        </section>

        <section className={styles.contactPanel}>
          <div className={styles.visualWrap}>
            <Image
              src="/images/contact-holder.svg"
              alt="Customer support illustration"
              width={780}
              height={620}
              priority
            />
          </div>

          <div className={styles.infoList}>
            <article className={styles.infoItem}>
              <span className={styles.iconBox} aria-hidden="true">
                <Building2 size={20} />
              </span>
              <div>
                <h2>Our Location</h2>
                <address>
                  Distributors adress
                  <br />
                  Area code: 200805
                  <br />
                  Kesara Ero :317
                  <br />
                  Rr district, Telangana
                </address>
              </div>
            </article>

            <article className={styles.infoItem}>
              <span className={styles.iconBox} aria-hidden="true">
                <Mail size={20} />
              </span>
              <div>
                <h2>Email Us</h2>
                <a href="mailto:Yashworldofwellness@gmail.com">Yashworldofwellness@gmail.com</a>
              </div>
            </article>

            <article className={styles.infoItem}>
              <span className={styles.iconBox} aria-hidden="true">
                <PhoneCall size={20} />
              </span>
              <div>
                <h2>Call Us</h2>
                <a href="tel:+918143638803">8143638803</a>
              </div>
            </article>
          </div>
        </section>

        <section className={styles.messageSection}>
          <div className={styles.messageTop}>
            <h2>Send us a message</h2>
            <p>Have questions or feedback? Let’s talk.</p>
          </div>

          <div className={styles.formCard}>
            <WhatsAppContactForm styles={styles} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
