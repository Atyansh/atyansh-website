// Site-wide feature flags

// Gates the ambient audio system: the speaker-icon toggle in the header
// (BaseLayout) and the "Ambient Audio System" section on the project page.
// When enabling, also restore 'Web Audio API' to the technologies list and
// the audio mention in the description of personal-website.mdx's frontmatter
// (frontmatter can't read this flag).
export const ENABLE_AUDIO = false;
