const SITE_NAME = "Homeschool Sidekick";
const SITE_DESCRIPTION = "Your AI-powered homeschool sidekick — parents steer, kids learn, step by step.";

function shouldNoIndexCurrentEnvironment() {
  const vercelEnv = String(process.env.VERCEL_ENV || "").trim().toLowerCase();
  if (vercelEnv) {
    return vercelEnv !== "production";
  }

  const nodeEnv = String(process.env.NODE_ENV || "").trim().toLowerCase();
  return nodeEnv !== "production";
}

function toUrlCandidate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(`https://${raw}`);
    } catch {
      return null;
    }
  }
}

export function getSiteUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL
  ];

  for (const candidate of candidates) {
    const parsed = toUrlCandidate(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return new URL("http://localhost:3000");
}

export function buildRootMetadata() {
  const metadata = {
    metadataBase: getSiteUrl(),
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: SITE_DESCRIPTION
    }
  };

  if (shouldNoIndexCurrentEnvironment()) {
    metadata.robots = {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true
      }
    };
  }

  return metadata;
}

export function buildMarketingMetadata({ title, description, path }) {
  return {
    title,
    description,
    alternates: {
      canonical: path
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: path,
      siteName: SITE_NAME
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export function buildNoIndexMetadata({ title, description }) {
  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true
      }
    }
  };
}

export function getOrganizationJsonLd() {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl.toString(),
    legalName: "Freyr And Sons LLC"
  };
}

export function getWebsiteJsonLd() {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl.toString(),
    description: SITE_DESCRIPTION
  };
}

export function getHomepageWebApplicationJsonLd() {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    url: siteUrl.toString(),
    description: SITE_DESCRIPTION,
    audience: {
      "@type": "Audience",
      audienceType: "Homeschool parents and students"
    },
    isFamilyFriendly: true,
    creator: {
      "@type": "Organization",
      name: "Freyr And Sons LLC"
    }
  };
}

export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export const SEO_SITE_NAME = SITE_NAME;
export const SEO_SITE_DESCRIPTION = SITE_DESCRIPTION;
