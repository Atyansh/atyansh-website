# Personal Website

A modern, privacy-focused personal website built with Astro and Tailwind CSS.

## Features

- 📝 Blog with markdown support
- 📄 Papers/Publications section
- 💼 Projects showcase
- 🔐 PGP key page for secure communication
- 🛡️ Security-first approach with proper headers and CSP
- 🎨 Responsive design with Tailwind CSS
- 🌙 Dark mode support
- ⚡ Fast static site generation with Astro

## Project Structure

```
/
├── public/
│   ├── favicon.svg
│   ├── publickey.asc      # Your PGP public key
│   └── robots.txt
├── src/
│   ├── content/
│   │   ├── blog/           # Blog posts (markdown)
│   │   ├── papers/         # Research papers (markdown)
│   │   ├── projects/       # Projects (markdown)
│   │   └── config.ts       # Content collection schemas
│   ├── layouts/
│   │   └── BaseLayout.astro # Main layout with navigation
│   ├── pages/
│   │   ├── blog/           # Blog pages
│   │   ├── papers/         # Papers pages
│   │   ├── projects/       # Projects pages
│   │   ├── index.astro     # Home page
│   │   └── pgp.astro       # PGP key page
│   ├── styles/
│   │   └── global.css      # Global styles (Tailwind)
│   └── middleware.ts       # Security headers middleware
└── package.json
```

## Getting Started

### Development

```bash
npm run dev
```

Your site will be available at `http://localhost:4321`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Customization

### Personal Information

1. Update your name and bio in `src/pages/index.astro`
2. Update navigation links in `src/layouts/BaseLayout.astro`
3. Update social media links in the footer of `src/layouts/BaseLayout.astro`

### PGP Key

1. Generate your PGP key:
   ```bash
   gpg --full-generate-key
   ```

2. Export your public key:
   ```bash
   gpg --armor --export your.email@example.com > public/publickey.asc
   ```

3. Update the key information in `src/pages/pgp.astro`

### Content

- **Blog posts**: Add markdown files to `src/content/blog/`
- **Projects**: Add markdown files to `src/content/projects/`
- **Papers**: Add markdown files to `src/content/papers/`

Each content type has a defined schema in `src/content/config.ts`

### Security Headers

Security headers are configured in `src/middleware.ts`. When deploying to production with HTTPS, uncomment the HSTS header.

### Deployment

This site can be deployed to any static hosting platform:

- **Vercel**: Connect your GitHub repo
- **Netlify**: Connect your GitHub repo
- **Cloudflare Pages**: Connect your GitHub repo
- **GitHub Pages**: Configure in repo settings

## Security Best Practices

This site is built with security in mind:

- ✅ Content Security Policy (CSP)
- ✅ X-Frame-Options
- ✅ X-Content-Type-Options
- ✅ Referrer Policy
- ✅ Permissions Policy
- ✅ Comprehensive .gitignore for secrets
- ✅ No client-side tracking
- ✅ Static site generation (no server-side vulnerabilities)

## License

This project structure is open source and available for use. Replace the content with your own.

## Built With

- [Astro](https://astro.build) - Static site generator
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
