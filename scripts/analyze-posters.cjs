const puppeteer = require('puppeteer');

async function analyzePosters() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const url = 'https://letterboxd.com/atyansh/films/';
  console.log('Navigating to:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.poster-list', { timeout: 10000 });

  // Scroll to load images
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  const posterAnalysis = await page.evaluate(() => {
    const reactComponents = document.querySelectorAll('.react-component[data-item-name]');
    const withRealPosters = [];
    const withPlaceholders = [];

    reactComponents.forEach((container) => {
      const filmName = container.getAttribute('data-item-name') || '';
      const filmSlug = container.getAttribute('data-item-slug');
      const filmId = container.getAttribute('data-film-id') || '';
      const img = container.querySelector('img');
      const posterSrc = img?.getAttribute('src') || '';

      const movieData = { filmName, filmSlug, filmId, posterSrc };

      if (posterSrc.includes('empty-poster')) {
        withPlaceholders.push(movieData);
      } else if (posterSrc.includes('ltrbxd.com')) {
        withRealPosters.push(movieData);
      }
    });

    return {
      withRealPosters: withRealPosters.slice(0, 5),  // First 5 with real posters
      withPlaceholders: withPlaceholders.slice(0, 10) // First 10 with placeholders
    };
  });

  console.log('\n=== MOVIES WITH REAL POSTER URLs (first 5) ===');
  posterAnalysis.withRealPosters.forEach(movie => {
    console.log(`\n${movie.filmName}`);
    console.log(`  Slug: ${movie.filmSlug}`);
    console.log(`  ID: ${movie.filmId}`);
    console.log(`  URL: ${movie.posterSrc}`);
  });

  console.log('\n\n=== MOVIES WITH PLACEHOLDER URLs (first 10) ===');
  posterAnalysis.withPlaceholders.forEach(movie => {
    console.log(`\n${movie.filmName}`);
    console.log(`  Slug: ${movie.filmSlug}`);
    console.log(`  ID: ${movie.filmId}`);
  });

  await browser.close();
}

analyzePosters()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
