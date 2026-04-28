"use client";

const WHATSAPP_NUMBER = "916302915002";

function fieldValue(formData, key) {
  return String(formData.get(key) || "").trim();
}

export default function WhatsAppContactForm({ styles }) {
  function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const name = fieldValue(formData, "name") || "-";
    const phone = fieldValue(formData, "phone") || "-";
    const email = fieldValue(formData, "email") || "-";
    const subject = fieldValue(formData, "subject") || "-";
    const message = fieldValue(formData, "message") || "-";

    const text = [
      "New enquiry from website:",
      `Name: ${name}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      `Subject: ${subject}`,
      `Message: ${message}`,
    ].join("\n");

    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" type="text" />

      <label htmlFor="phone">Phone No.</label>
      <input id="phone" name="phone" type="tel" />

      <label htmlFor="email">Email. ID</label>
      <input id="email" name="email" type="email" />

      <label htmlFor="subject">Subject</label>
      <input id="subject" name="subject" type="text" />

      <label htmlFor="message">Message</label>
      <textarea id="message" name="message" rows={5} />

      <div className={styles.actions}>
        <button type="submit">Submit</button>
      </div>
    </form>
  );
}
