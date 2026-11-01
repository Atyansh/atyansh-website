/**
 * Site configuration: every public, non-secret presentation choice.
 *
 * Forking this site? Start here (and see "Forking this site" in README.md).
 * - This file: site name/URL, author and social links, analytics, time zone,
 *   which integrations are switched on, and per-integration display choices.
 * - Environment (.env locally, the SITE_SECRETS secret in Cloud Build):
 *   credentials AND account ids/usernames (Steam id, Letterboxd username...).
 *   Never put those here — this file is public.
 *
 * An integration is live only when its toggle below is on AND its required
 * env keys are set at build time (see src/integrations.ts). Otherwise its page,
 * nav entry, sitemap entry and health check all disappear.
 *
 * Keep this file plain data with no imports and only type syntax Node can
 * strip (no enums/namespaces): scripts/*.cjs load it directly with Node's
 * built-in TypeScript support.
 */

export type IntegrationId =
  | 'goodreads'
  | 'spotify'
  | 'letterboxd'
  | 'tmdb'
  | 'myanimelist'
  | 'steam'
  | 'psn'
  | 'nintendo'
  | 'igdb'
  | 'kaya';

export type SocialIcon = 'github' | 'linkedin' | 'x' | 'instagram';

export interface SocialLink {
  /** Text on the home page button */
  label: string;
  /** Tooltip (defaults to label) */
  title?: string;
  url: string;
  icon: SocialIcon;
  /** List in the Person structured data's sameAs (search engines' "same person" links) */
  sameAs: boolean;
}

export interface SiteConfig {
  /** Canonical origin, no trailing slash. astro.config.mjs uses it as `site`. */
  url: string;
  /** Site/brand name: header, footer, og:site_name, page-title suffix ("Music - <name>") */
  name: string;
  /** Short name used in the health-check alert footer ("<shortName> Website Monitor") */
  shortName: string;
  /** Default <meta name="description"> */
  description: string;
  /** Description in the WebSite structured data */
  structuredDataDescription: string;
  author: {
    name: string;
    jobTitle: string;
    /** Shown as a mailto link on the home page; null hides it */
    email: string | null;
    /** Profile image URL at a given pixel size (home page, structured data) */
    avatar: (size: number) => string;
    worksFor: string | null;
    alumniOf: string | null;
    /** "@handle" for twitter:site/twitter:creator; null omits those tags */
    twitterHandle: string | null;
  };
  /** Home page "Connect" buttons, in order */
  social: SocialLink[];
  analytics: {
    /**
     * GoatCounter count endpoint (https://<code>.goatcounter.com/count), or
     * null for no analytics script at all. If you change it, update the
     * connect-src origin in firebase.json's Content-Security-Policy too
     * (a test checks they match).
     */
    goatcounter: string | null;
  };
  /**
   * IANA time zone that activity timestamps (climbing sessions, last played,
   * books read) are shown in. Builds run in UTC, so this must be explicit.
   */
  timeZone: string;
  spotify: {
    /** Your own playlists (exact names) shown in full on /music */
    featuredPlaylists: string[];
  };
  /**
   * Per-integration switches. Turning one off skips it entirely even when its
   * env keys are present. Turning one on is not enough by itself: its
   * required env keys must be set too (see src/integrations.ts).
   */
  integrations: Record<IntegrationId, boolean>;
}

export const siteConfig: SiteConfig = {
  url: 'https://atyansh.com',
  name: 'Atyansh Jaiswal',
  shortName: 'Atyansh',
  description: 'Software Engineer | Personal Website',
  structuredDataDescription: 'Security & Privacy Engineer | Personal Website',
  author: {
    name: 'Atyansh Jaiswal',
    jobTitle: 'Software Engineer',
    email: 'atyansh.jaiswal@gmail.com',
    avatar: (size) => `https://www.gravatar.com/avatar/7e16fc57778ed552f69eb809ce567b38?s=${size}`,
    worksFor: 'Anthropic',
    alumniOf: 'UC San Diego',
    twitterHandle: '@AtyanshJ',
  },
  social: [
    { label: 'GitHub', url: 'https://github.com/atyansh', icon: 'github', sameAs: true },
    { label: 'LinkedIn', url: 'https://linkedin.com/in/atyansh', icon: 'linkedin', sameAs: true },
    { label: 'X', title: 'X (Twitter)', url: 'https://x.com/AtyanshJ', icon: 'x', sameAs: true },
    { label: 'Instagram', url: 'https://instagram.com/atyansh', icon: 'instagram', sameAs: false },
  ],
  analytics: {
    goatcounter: 'https://atyansh.goatcounter.com/count',
  },
  timeZone: 'America/Los_Angeles',
  spotify: {
    featuredPlaylists: ['Songs I actually listen to', 'Focus'],
  },
  integrations: {
    goodreads: true,
    spotify: true,
    letterboxd: true,
    tmdb: true,
    myanimelist: true,
    steam: true,
    psn: true,
    nintendo: true,
    igdb: true,
    kaya: true,
  },
};

/** "<page> - <site name>", the title format every page uses */
export function pageTitle(page: string): string {
  return `${page} - ${siteConfig.name}`;
}
