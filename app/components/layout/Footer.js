"use client";

import Link from "next/link";

const FOOTER_LINKS = [
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
    { href: "/privacy", label: "Privacy Policy" }
];

export function Footer() {
    return (
        <footer className="app-shell__footer">
            <div className="footer__accent-line" />
            <nav className="footer__nav" aria-label="Footer">
                {FOOTER_LINKS.map((link) => (
                    <Link key={link.href} href={link.href} className="footer__link">
                        {link.label}
                    </Link>
                ))}
            </nav>
            <p className="footer__copyright">
                &copy; {new Date().getFullYear()} Freyr And Sons LLC. All rights reserved.
            </p>
        </footer>
    );
}
