# Personal Website

> **Note:** This entire project was generated using [Claude Code](https://claude.com/claude-code). Not a single line of code was manually written - everything from the architecture to the implementation was created through AI-assisted development.

A modern, privacy-focused personal website built with Astro and Tailwind CSS, featuring integrated activity tracking from various platforms.

## Features

### Core Features
- 📝 **Blog** with markdown support and tagging
- 📄 **Papers/Publications** section for research work
- 💼 **Projects** showcase with 143 Project Euler solutions
- 👨‍💻 **Work Experience** page with resume
- 🔐 **PGP Key** page for secure communication
- 🐾 **Pet Gallery** with image galleries

### Activity Tracking
- 🎮 **Gaming** - Track games across Steam, PlayStation Network, and Nintendo Switch via Exophase
- 🎵 **Music** - Display recently played tracks from Spotify
- 🎬 **Movies** - Show watched films from Letterboxd
- 📺 **TV Shows** - Track watched shows from Trakt with TMDB poster images
- 📺 **Anime** - Track anime watching from MyAnimeList
- 📚 **Books** - Display reading list from Goodreads
- 🧗 **Climbing** - Display bouldering stats, grade pyramid, and send videos from Kaya

### Ambient Audio System
- 🎵 **Per-page composed music** — each page has its own unique song with distinct melody, bass line, chords, tempo, and key (like different Pokemon city themes)
- 🎹 **Step sequencer engine** — plays composed songs using `[midiNote, durationIn16ths]` patterns with multi-track support (melody, bass, pad, arp)
- 🎛️ **Theme-reactive audio** — visual themes dramatically alter the music's pitch, oscillator type, envelope, filter, reverb, and distortion via live parameter ramping (no audio interruption)
- 🔊 **12 distinct songs** spanning 60–140 BPM across major, minor, and Pythagorean scales
- 🔇 **Toggle & volume control** — persisted in localStorage, with smooth crossfades between songs on page navigation

### Technical Features
- 🛡️ Security-first approach with CSP, HSTS, and other security headers
- 🎨 Responsive design with Tailwind CSS 4
- 🌙 5 built-in themes (Minimal Technical, Modern Glass, Brutalist, Dark Terminal, Academic Minimal) with fully CSS custom property-driven styling
- ⚡ Fast static site generation with Astro 5
- 🖼️ Dynamic OG image generation
- 🔍 SEO optimized with sitemap generation
- ♿ Accessible design

## Prerequisites

- **Node.js** 22.x (recommended for full compatibility with psn-api)
  - Minimum: 20.x or later (required by psn-api@2.15.0)
  - Cloud Build uses Node.js 22 to match local environment
- **npm** 9.x or later
- **Git** for version control

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Atyansh/atyansh-website.git
   cd atyansh-website
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   For new setup, copy the example file:
   ```bash
   cp .env.example .env
   ```

   If you have secrets in Google Cloud Secret Manager, sync them instead:
   ```bash
   node scripts/pull-secrets.cjs
   ```

4. **Configure your API keys** (see detailed instructions below)

**Note:** `npm run build` automatically syncs secrets from Secret Manager before building (if gcloud is configured). Secret Manager is the single source of truth.

## Quick Start (Minimal Setup)

You can run the site with minimal or no API keys. The site will gracefully handle missing credentials:

```bash
npm run dev
```

Visit `http://localhost:4321` to see your site.

**Note:** Pages requiring API credentials (games, music, movies, etc.) will show placeholder content or errors until configured.

## API Configuration

All API credentials are optional. Configure only the services you want to use.

### 1. Steam (Gaming Stats)

**What you need:**
- Steam API Key
- Your Steam ID

**Steps:**
1. Get your Steam API key at https://steamcommunity.com/dev/apikey
2. Find your Steam ID:
   - Visit your Steam profile
   - Copy the number from the URL (e.g., `steamcommunity.com/profiles/76561198XXXXXXXXX`)
   - Or use https://www.steamidfinder.com/

3. Add to `.env`:
   ```bash
   STEAM_API_KEY=your_actual_api_key
   STEAM_ID=76561198XXXXXXXXX
   ```

### 2. PlayStation Network (Gaming Stats)

**What you need:**
- NPSSO token (64-character authentication token)

**Steps:**
1. Log in to https://www.playstation.com in your browser
2. Visit https://ca.account.sony.com/api/v1/ssocookie
3. You'll see a JSON response containing your NPSSO token:
   ```json
   { "npsso": "your_64_character_token_here" }
   ```
4. Copy the 64-character token value

5. Add to `.env`:
   ```bash
   PSN_NPSSO=your_npsso_token_here
   ```

**Important:**
- Never share your NPSSO token - treat it like a password
- Tokens are valid for 60 days, then need to be refreshed
- Detailed guide: https://bigbudone.com/posts/how-to-get-your-npsso-token-for-playstation-api-access/

### 3. Exophase (Unified Gaming Stats)

Exophase provides a unified view of achievements across platforms.

**What you need:**
- Your Exophase username

**Steps:**
1. Create an account at https://www.exophase.com
2. Link your gaming accounts (Steam, PSN, Xbox, etc.)
3. Your data is public and scraped via username - no API key needed

**Note:** The site uses web scraping, which may be slower and is subject to rate limiting. Exophase also handles Nintendo Switch games.

### 4. IGDB (Game Cover Art)

IGDB provides high-quality game cover images for all platforms.

**What you need:**
- Twitch Client ID
- Twitch Access Token

**Steps:**
1. Register a Twitch application at https://dev.twitch.tv/console/apps
2. Click "Register Your Application"
   - Name: "Your Name's Website"
   - OAuth Redirect URL: `http://localhost`
   - Category: Website Integration
3. Click "Manage" on your application
4. Copy the "Client ID"
5. Click "New Secret" and copy the "Client Secret"
6. Get an access token:
   ```bash
   curl -X POST "https://id.twitch.tv/oauth2/token?client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&grant_type=client_credentials"
   ```

7. Add to `.env`:
   ```bash
   IGDB_CLIENT_ID=your_twitch_client_id
   IGDB_CLIENT_SECRET=your_twitch_client_secret
   IGDB_ACCESS_TOKEN=your_twitch_access_token
   ```

**Note:** Access tokens expire after ~60 days. If you provide `IGDB_CLIENT_SECRET`, the build will auto-refresh expired tokens.

### 5. Spotify (Music Tracking)

Spotify requires OAuth2. Use the included helper script.

**What you need:**
- Spotify Client ID
- Spotify Client Secret
- Spotify Refresh Token (generated by script)

**Steps:**
1. Create a Spotify app at https://developer.spotify.com/dashboard
2. Click "Create app"
   - App name: "Your Name's Website"
   - App description: "Personal website music tracking"
   - Redirect URI: `http://localhost:8888/callback`
   - Which API/SDKs: Web API
   - Agree to terms and save
3. Click "Settings" and copy your Client ID and Client Secret

4. Run the OAuth helper script:
   ```bash
   SPOTIFY_CLIENT_ID=your_client_id SPOTIFY_CLIENT_SECRET=your_client_secret node scripts/get-spotify-token.cjs
   ```

5. Follow the prompts:
   - A URL will be displayed
   - Open it in your browser
   - Authorize the application
   - You'll be redirected (the page may show an error - that's OK!)
   - Copy the `code` parameter from the URL
   - Paste it into the terminal
   - Your refresh token will be generated

6. Add to `.env`:
   ```bash
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   SPOTIFY_REFRESH_TOKEN=generated_refresh_token
   ```

### 6. Letterboxd (Movie Tracking)

**What you need:**
- Your Letterboxd username

**Steps:**
1. Create an account at https://letterboxd.com
2. Your profile must be public
3. Add to `.env`:
   ```bash
   LETTERBOXD_USERNAME=your_username
   ```

**Note:** Uses web scraping. Rate limiting applies.

### 7. MyAnimeList (Anime Tracking)

MyAnimeList uses OAuth2. Use the included helper script.

**What you need:**
- MAL Client ID
- MAL Client Secret
- MAL Access Token (generated by script)
- MAL Refresh Token (generated by script)

**Steps:**
1. Register an app at https://myanimelist.net/apiconfig/create
   - App Name: "Your Name's Website"
   - App Type: web
   - App Description: "Personal website anime tracking"
   - App Redirect URL: `http://localhost:8888/callback`
   - Homepage URL: Your website URL or `http://localhost`
   - Commercial/Non-Commercial: Non-Commercial
   - Submit and agree to terms

2. Copy your Client ID and Client Secret from the confirmation page

3. Run the OAuth helper script:
   ```bash
   MAL_CLIENT_ID=your_client_id MAL_CLIENT_SECRET=your_client_secret node scripts/get-mal-token.cjs
   ```

4. Follow the prompts:
   - A URL will be displayed
   - Open it in your browser
   - Authorize the application
   - You'll be redirected to localhost (may show connection error - that's OK!)
   - Copy the entire URL from your browser
   - Paste it into the terminal
   - Your tokens will be generated

5. Add to `.env`:
   ```bash
   MAL_CLIENT_ID=your_client_id
   MAL_CLIENT_SECRET=your_client_secret
   MAL_ACCESS_TOKEN=generated_access_token
   MAL_REFRESH_TOKEN=generated_refresh_token
   ```

**Note:** Access tokens expire after ~31 days. Use the refresh token to get new ones (the site handles this automatically).

### 8. Goodreads (Book Tracking)

**What you need:**
- Your Goodreads user ID

**Steps:**
1. Log in to https://www.goodreads.com
2. Go to your profile
3. Copy the number from the URL: `goodreads.com/user/show/12345678-your-name`
4. Add to `.env`:
   ```bash
   GOODREADS_USER_ID=12345678
   ```

**Note:** Uses web scraping. Your reading list must be public.

### 9. Trakt (TV Show Tracking)

Trakt uses OAuth2. Use the included helper script.

**What you need:**
- Trakt Client ID
- Trakt Client Secret
- Trakt Username
- Trakt Access Token (generated by script)
- Trakt Refresh Token (generated by script)

**Steps:**
1. Create an app at https://trakt.tv/oauth/applications
   - Name: "Your Name's Website"
   - Redirect URI: `urn:ietf:wg:oauth:2.0:oob`
2. Copy your Client ID and Client Secret

3. Run the OAuth helper script:
   ```bash
   TRAKT_CLIENT_ID=your_client_id TRAKT_CLIENT_SECRET=your_client_secret node scripts/get-trakt-token.cjs
   ```

4. Follow the prompts to authorize and get your tokens

5. Add to `.env`:
   ```bash
   TRAKT_CLIENT_ID=your_client_id
   TRAKT_CLIENT_SECRET=your_client_secret
   TRAKT_USERNAME=your_trakt_username
   TRAKT_ACCESS_TOKEN=generated_access_token
   TRAKT_REFRESH_TOKEN=generated_refresh_token
   TRAKT_TOKEN_EXPIRES_AT=0
   ```

**Note:** Access tokens expire every 7 days and are proactively refreshed during builds when <24 hours remain.

### 10. TMDB (TV Show Poster Images)

**What you need:**
- TMDB API Key

**Steps:**
1. Create an account at https://www.themoviedb.org
2. Go to Settings > API
3. Request an API key (free for personal use)
4. Add to `.env`:
   ```bash
   TMDB_API_KEY=your_api_key
   ```

### 11. Kaya (Climbing Stats)

**What you need:**
- Your Kaya username

**Steps:**
1. Download the Kaya app and create an account
2. Log your climbs in the app
3. Add to `.env`:
   ```bash
   KAYA_USERNAME=your_kaya_username
   ```

**Note:** Uses the public Kaya GraphQL API. No API key required.

### 12. Discord Notifications (API Health Monitoring)

Get notified via Discord DM when API keys expire during automated builds.

**What you need:**
- A Discord bot (create one at https://discord.com/developers/applications)
- The bot must share a server with you (any server works)
- Your Discord user ID

**Steps:**
1. Go to https://discord.com/developers/applications and click **New Application**
2. Go to **Bot** in the sidebar, click **Reset Token**, and copy the bot token
3. Invite the bot to a server you're in — go to **OAuth2**, copy the Application ID, then visit:
   `https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=bot`
4. Get your Discord user ID: open Discord Settings > Advanced > enable **Developer Mode**, then right-click your name and **Copy User ID**
5. Add to `.env`:
   ```bash
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   DISCORD_USER_ID=your_discord_user_id_here
   ```
6. Add both secrets to Google Secret Manager and sync (see [API_HEALTH_MONITORING.md](./API_HEALTH_MONITORING.md) for details)

**What it does:**
- Runs after every build (daily at 2 AM UTC in production)
- Checks if all API integrations succeeded
- Sends you a Discord DM with an embed if any API keys have expired
- Includes exact commands to fix issues

See [API_HEALTH_MONITORING.md](./API_HEALTH_MONITORING.md) for detailed setup instructions.

## Development

### Run Development Server

```bash
npm run dev
```

Site will be available at `http://localhost:4321`

The dev server includes:
- Hot module reloading
- Automatic page refreshes
- TypeScript error checking

### Build for Production

```bash
npm run build
```

This generates optimized static files in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

Preview the production build locally before deployment.

### Run Tests

```bash
npm test          # Run all tests once
npm run test:watch  # Run tests in watch mode
```

Tests use [Vitest](https://vitest.dev/) and cover caching, retry logic, RSS parsing, and utility functions.

## Project Structure

```
/
├── public/                      # Static assets
│   ├── favicon.svg
│   ├── publickey.asc           # Your PGP public key
│   ├── resume.pdf              # Your resume
│   ├── robots.txt
│   ├── .well-known/
│   │   └── security.txt        # Security contact info
│   └── images/
│       └── pets/               # Pet photos
├── scripts/                     # Helper scripts
│   ├── get-spotify-token.cjs   # Spotify OAuth helper
│   ├── get-mal-token.cjs       # MyAnimeList OAuth helper
│   ├── get-trakt-token.cjs     # Trakt OAuth helper
│   ├── check-api-health.cjs    # API health monitoring
│   ├── pull-secrets.cjs        # Sync secrets from GCloud to .env
│   ├── sync-secrets-to-gcloud.sh # Sync .env to Secret Manager
│   └── invalidate-cache.sh     # CDN cache invalidation
├── src/
│   ├── audio/                  # Client-side audio engine
│   │   ├── AudioEngine.ts    # Step sequencer + theme processing
│   │   ├── songs.ts          # 12 composed songs (one per page)
│   │   ├── instruments.ts    # Synth instrument presets
│   │   ├── synth.ts          # SynthVoice (oscillator + ADSR + filter)
│   │   ├── themes.ts         # Per-theme audio effects
│   │   ├── notes.ts          # MIDI note constants
│   │   ├── impulse.ts        # Algorithmic reverb impulse response
│   │   └── types.ts          # Audio type definitions
│   ├── components/             # React/Astro components
│   │   ├── AudioToggle.astro # Audio toggle + volume control
│   │   ├── ErrorBoundary.tsx  # React error boundary
│   │   ├── GameCard.tsx
│   │   ├── MediaCard.tsx
│   │   ├── MusicCarousel.tsx
│   │   └── ...
│   ├── content/                # Markdown content
│   │   ├── blog/              # Blog posts
│   │   ├── papers/            # Research papers
│   │   ├── projects/          # Project showcases
│   │   ├── eulerProblems/     # Project Euler solutions
│   │   ├── pets/              # Pet profiles
│   │   └── config.ts          # Content schemas
│   ├── layouts/
│   │   └── BaseLayout.astro   # Main layout
│   ├── pages/                  # Routes
│   │   ├── index.astro        # Home
│   │   ├── blog/
│   │   ├── projects/
│   │   ├── games.astro
│   │   ├── music.astro
│   │   ├── movies.astro
│   │   ├── tv.astro
│   │   ├── anime.astro
│   │   ├── books.astro
│   │   ├── climbing.astro
│   │   └── ...
│   ├── styles/
│   │   └── global.css         # Global styles
│   ├── utils/                  # Utility functions
│   │   ├── cache.ts           # Generic FileCache<T> utility
│   │   ├── logger.ts          # Structured logger utility
│   │   ├── concurrency.ts     # pLimit concurrency helper
│   │   ├── retry.ts           # Retry logic with backoff
│   │   ├── steam.ts           # Steam API integration
│   │   ├── spotify.ts         # Spotify API integration
│   │   ├── trakt.ts           # Trakt API integration
│   │   ├── kaya.ts            # Kaya climbing API
│   │   ├── letterboxd.ts      # Letterboxd scraper
│   │   ├── __tests__/         # Unit tests (Vitest)
│   │   └── ...
│   └── middleware.ts          # Security headers
├── .env                        # Your secrets (not committed)
├── .env.example               # Template for secrets
├── .gitignore                 # Git ignore rules
├── astro.config.mjs           # Astro configuration
├── vitest.config.ts           # Test configuration
├── tsconfig.json              # TypeScript configuration
├── Dockerfile.cloudbuild      # Custom Cloud Build image
├── cloudbuild-image.yaml      # Build config for Docker image
└── package.json               # Dependencies
```

## Customization

### Personal Information

1. **Home page**: Edit `src/pages/index.astro`
   - Update name, bio, and links

2. **Navigation**: Edit `src/layouts/BaseLayout.astro`
   - Customize navigation menu
   - Update footer links

3. **Work Experience**: Edit `src/pages/work.astro`
   - Add your work history
   - Update resume link

### PGP Key Setup

1. Generate a PGP key:
   ```bash
   gpg --full-generate-key
   ```

2. Export your public key:
   ```bash
   gpg --armor --export your.email@example.com > public/publickey.asc
   ```

3. Update key information in `src/pages/pgp.astro`

### Adding Content

Create markdown files in the appropriate directory:

- **Blog posts**: `src/content/blog/post-title.md`
- **Projects**: `src/content/projects/project-name.md`
- **Papers**: `src/content/papers/paper-name.md`

Each content type has a schema defined in `src/content/config.ts`. Follow the existing examples for frontmatter format.

### Disabling Features

To disable specific integrations, simply don't add their API keys to `.env`. The site will gracefully handle missing credentials.

To completely remove a feature:
1. Remove the corresponding page from `src/pages/`
2. Remove the navigation link from `src/layouts/BaseLayout.astro`
3. Remove unused utility files from `src/utils/`
4. Uninstall unused dependencies from `package.json`

## Deployment

This site can be deployed to any static hosting platform:

### Google Cloud Storage + Cloud Build (Current Setup)

This site is currently deployed to Google Cloud Storage with automated daily builds via Cloud Build.

**Manual Deployment:**
```bash
./deploy.sh
```

**Automated Daily Builds:**
- Cloud Build runs daily at 2 AM UTC using a [custom Docker image](#cloud-build-docker-image) with Chrome dependencies pre-installed
- Fetches latest code and API data
- Deploys automatically to gs://atyansh.com/

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for full setup instructions.

#### Cloud Build Docker Image

Cloud Build uses a custom Docker image (`gcr.io/personal-website-334502/node-puppeteer:22`) with Chrome dependencies pre-installed. This avoids reinstalling ~25 packages on every build.

To rebuild the image (only needed for Node.js major version bumps or Puppeteer upgrades):
```bash
gcloud builds submit --config=cloudbuild-image.yaml .
```

### Vercel (Alternative)

1. Push your code to GitHub
2. Import repository in Vercel dashboard
3. Add environment variables in Vercel project settings
4. Deploy

### Netlify

1. Push your code to GitHub
2. Import repository in Netlify dashboard
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variables in site settings
6. Deploy

### Cloudflare Pages

1. Push your code to GitHub
2. Create new Pages project
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Add environment variables
6. Deploy

### Important for Production

1. **Security headers**: HSTS is enabled in `src/middleware.ts` for non-dev environments. For static hosting (e.g., GCS), configure security headers at the CDN/load balancer level.
2. **Environment variables**: Add all your API keys to your hosting platform's environment variable settings
3. **Caching**: All API integrations use file-based caching (24-hour TTL) to minimize external requests during builds

## Security Best Practices

This site implements security best practices:

- ✅ **Content Security Policy (CSP)** - Prevents XSS attacks
- ✅ **HSTS** - Enforces HTTPS connections
- ✅ **X-Content-Type-Options** - Prevents MIME sniffing
- ✅ **Referrer Policy** - Controls referrer information
- ✅ **Permissions Policy** - Restricts browser features
- ✅ **Comprehensive .gitignore** - Protects secrets
- ✅ **No client-side tracking** - Privacy-focused
- ✅ **Static site generation** - Minimal attack surface
- ✅ **security.txt** - Responsible disclosure contact

### Protecting Your Secrets

**NEVER commit `.env` to git.** It's already in `.gitignore`, but double-check:

```bash
git check-ignore .env
# Should output: .env
```

If you accidentally commit secrets:
1. Immediately rotate all API keys
2. Use `git filter-branch` or BFG Repo-Cleaner to remove from history
3. Force push the cleaned repository

## Troubleshooting

### API Tokens Expired

**IGDB, MyAnimeList, and Trakt tokens auto-refresh during builds** if you have the required credentials:
- IGDB: Requires `IGDB_CLIENT_SECRET` to auto-refresh
- MyAnimeList: Uses `MAL_REFRESH_TOKEN` to auto-refresh
- Trakt: Uses `TRAKT_REFRESH_TOKEN` to auto-refresh (expires every 7 days, proactively refreshed when <36h remain). In Cloud Build, the refresh uses Puppeteer with stealth to bypass Cloudflare's bot protection on Trakt's API.
- Refreshed tokens are automatically saved to Secret Manager for future builds

**Spotify tokens expire periodically:**
- Re-run `node scripts/get-spotify-token.cjs` to get new tokens
- Update `.env` with new values
- For production: Sync to Google Cloud with `./scripts/sync-secrets-to-gcloud.sh`

**PSN uses a refresh token flow** to avoid frequent manual renewal:
- The NPSSO bootstraps the refresh token on first use
- Each build uses the refresh token to get a new access token, extending the ~10-day window
- The NPSSO can be invalidated at any time (e.g. logging out of PSN on another device) — the refresh token keeps working until its window expires
- When the refresh token also expires, get a new NPSSO:
  - Log out of https://store.playstation.com, then log back in
  - Visit https://ca.account.sony.com/api/v1/ssocookie to get a fresh token
  - Update `PSN_NPSSO` in `.env` and sync to Secret Manager

**Automated monitoring:**
- If Discord notifications are configured, you'll automatically receive a DM when tokens expire
- The message includes exact commands to fix each issue
- See [API_HEALTH_MONITORING.md](./API_HEALTH_MONITORING.md) for setup

### Web Scraping Issues

**Letterboxd, Goodreads, Exophase, Kaya rely on scraping/public APIs:**
- If these fail, the site structure may have changed
- Check the respective utility file in `src/utils/`
- Update selectors or scraping logic
- Consider implementing caching to reduce requests

### Build Errors

**Missing environment variables:**
- The build will fail if required APIs return errors
- Make sure all API keys in `.env` are valid
- Or disable the failing integration

**TypeScript errors:**
```bash
npm run build
```
Check the console output for specific type errors.

### Port Already in Use

If port 4321 is already in use:
```bash
lsof -ti:4321 | xargs kill -9
npm run dev
```

## Performance Tips

1. **Caching**: All API integrations use a generic `FileCache<T>` with 24-hour TTL, reducing redundant API calls across builds
2. **Build time**: Cloud Build uses a custom Docker image with Chrome dependencies pre-installed, and Letterboxd scraping reuses a single Puppeteer browser instance across pages
3. **Image optimization**: Pet photos and other images are automatically optimized by Astro
4. **Lazy loading**: Activity sections use client-side rendering for faster initial loads
5. **Error resilience**: React components are wrapped with ErrorBoundary to isolate failures

## Contributing

This is a personal website, but feel free to:
- Report bugs via GitHub issues
- Suggest improvements
- Fork for your own use (attribution appreciated!)

## License

This project is open source and available for personal use. Please replace all personal content (resume, PGP key, blog posts, etc.) with your own.

## Built With

- [Astro](https://astro.build) - Static site generator
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [React](https://react.dev/) - UI components
- [Framer Motion](https://www.framer.com/motion/) - Animations
- [Satori](https://github.com/vercel/satori) - OG image generation
- [Shiki](https://shiki.matsu.io/) - Syntax highlighting
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) - XML/RSS parsing
- [Vitest](https://vitest.dev/) - Unit testing
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) - Client-side audio synthesis

## Resources

- [Astro Documentation](https://docs.astro.build)
- [Tailwind Documentation](https://tailwindcss.com/docs)
- [Steam Web API Documentation](https://steamcommunity.com/dev)
- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [MyAnimeList API Documentation](https://myanimelist.net/apiconfig/references/api/v2)
- [PlayStation API (Community)](https://github.com/achievements-app/psn-api)
- [IGDB API Documentation](https://api-docs.igdb.com)
- [Trakt API Documentation](https://trakt.docs.apiary.io/)
- [TMDB API Documentation](https://developer.themoviedb.org/docs)

## Acknowledgments

- OAuth helper scripts inspired by various community implementations
- Security practices based on OWASP recommendations
- Design patterns from the Astro community
