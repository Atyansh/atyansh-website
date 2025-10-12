const puppeteer = require('puppeteer');

async function checkInceptionPoster() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Check both the film page and the user's films list
  const urls = [
    { name: 'Film page', url: 'https://letterboxd.com/film/inception/' },
    { name: 'User films list', url: 'https://letterboxd.com/atyansh/films/' }
  ];

  for (const {name, url} of urls) {
    console.log(`\n=== Checking ${name}: ${url} ===`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    if (name === 'User films list') {
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
    } else {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const posterData = await page.evaluate((pageName) => {
      if (pageName === 'Film page') {
        const poster = document.querySelector('.film-poster img');
        return {
          src: poster?.getAttribute('src') || '',
          srcset: poster?.getAttribute('srcset') || '',
          dataSrc: poster?.getAttribute('data-src') || ''
        };
      } else {
        // Find Inception in the films list
        const reactComponents = document.querySelectorAll('.react-component[data-item-name]');
        for (const container of reactComponents) {
          const filmName = container.getAttribute('data-item-name') || '';
          if (filmName.includes('Inception')) {
            const filmSlug = container.getAttribute('data-item-slug');
            const filmId = container.getAttribute('data-film-id');
            const img = container.querySelector('img');
            return {
              filmName,
              filmSlug,
              filmId,
              src: img?.getAttribute('src') || '',
              srcset: img?.getAttribute('srcset') || '',
              dataSrc: img?.getAttribute('data-src') || '',
              outerHTML: container.outerHTML.substring(0, 800)
            };
          }
        }
        return { error: 'Inception not found in list' };
      }
    }, name);

    console.log('Poster data:', JSON.stringify(posterData, null, 2));
  }

  await browser.close();
}

checkInceptionPoster()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
