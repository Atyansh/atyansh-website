const puppeteer = require('puppeteer');

async function debugScrape() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const url = 'https://letterboxd.com/atyansh/films/';
  console.log('Navigating to:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  console.log('Waiting for .poster-list...');
  await page.waitForSelector('.poster-list', { timeout: 10000 });

  const filmData = await page.evaluate(() => {
    console.log('Evaluating page...');

    // Check what we have
    const posterContainers = document.querySelectorAll('.poster-container');
    console.log('Found', posterContainers.length, '.poster-container elements');

    const films = [];

    posterContainers.forEach((container, idx) => {
      if (idx < 5) { // Debug first 5 only
        const filmSlug = container.getAttribute('data-film-slug');
        const filmName = container.getAttribute('data-film-name') || '';
        const link = container.querySelector('a')?.getAttribute('href') || '';
        const img = container.querySelector('img');
        const posterUrl = img?.getAttribute('src') || '';

        console.log(`Film ${idx}:`, {
          filmSlug,
          filmName,
          link,
          hasImg: !!img,
          posterUrl
        });

        films.push({
          filmSlug,
          filmName,
          link,
          posterUrl,
          hasImg: !!img
        });
      }
    });

    return { films, totalCount: posterContainers.length };
  });

  console.log('\nResults:', JSON.stringify(filmData, null, 2));

  await browser.close();
}

debugScrape()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
