const puppeteer = require('puppeteer');

async function checkSpecificMovies() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const url = 'https://letterboxd.com/atyansh/films/';
  console.log('Navigating to:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  console.log('Waiting for .poster-list...');
  await page.waitForSelector('.poster-list', { timeout: 10000 });

  // Scroll to load all images
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

  const movieData = await page.evaluate(() => {
    const results = [];
    const reactComponents = document.querySelectorAll('.react-component[data-item-name]');

    reactComponents.forEach((container) => {
      const filmName = container.getAttribute('data-item-name') || '';

      // Only look for Blade Runner 2049 and Inception
      if (filmName.includes('Blade Runner 2049') || filmName.includes('Inception')) {
        const filmSlug = container.getAttribute('data-item-slug');
        const filmId = container.getAttribute('data-film-id') || '';
        const link = container.getAttribute('data-item-link') || '';
        const img = container.querySelector('img');
        const posterSrc = img?.getAttribute('src') || '';
        const posterSrcset = img?.getAttribute('srcset') || '';

        results.push({
          filmName,
          filmSlug,
          filmId,
          link,
          posterSrc,
          posterSrcset,
          outerHTML: container.outerHTML.substring(0, 1000)
        });
      }
    });

    return results;
  });

  console.log('\n=== FOUND MOVIES ===\n');
  movieData.forEach(movie => {
    console.log(`\nMovie: ${movie.filmName}`);
    console.log(`Film ID: ${movie.filmId}`);
    console.log(`Slug: ${movie.filmSlug}`);
    console.log(`Link: ${movie.link}`);
    console.log(`Poster src: ${movie.posterSrc}`);
    console.log(`Poster srcset: ${movie.posterSrcset}`);
    console.log(`HTML snippet: ${movie.outerHTML.substring(0, 500)}...`);
  });

  await browser.close();
}

checkSpecificMovies()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
