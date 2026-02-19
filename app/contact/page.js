import { AppShell } from "../components/layout/AppShell.js";
import styles from "./page.module.css";

export const metadata = {
    title: "Contact Us | Homeschool Sidekick",
    description:
        "Get in touch with the Homeschool Sidekick team. Questions, feedback, or partnership inquiries — we'd love to hear from you."
};

export default function ContactPage() {
    return (
        <AppShell
            role="home"
            title="Contact Us"
            subtitle="Have a question, feedback, or just want to say hi? Drop us a line."
        >
            <div className={styles.formWrapper}>
                <form
                    className={`${styles.contactForm} card card--elevated`}
                    action="https://formspree.io/f/xaqddnly"
                    method="POST"
                >
                    <div className="field">
                        <label htmlFor="contact-name" className="label">
                            Name
                        </label>
                        <input
                            id="contact-name"
                            name="name"
                            type="text"
                            className="input"
                            placeholder="Your name"
                            required
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="contact-email" className="label">
                            Email
                        </label>
                        <input
                            id="contact-email"
                            name="email"
                            type="email"
                            className="input"
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="contact-message" className="label">
                            Message
                        </label>
                        <textarea
                            id="contact-message"
                            name="message"
                            className="textarea"
                            placeholder="How can we help?"
                            rows={5}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn--primary">
                        Send Message
                    </button>
                </form>
            </div>
        </AppShell>
    );
}
