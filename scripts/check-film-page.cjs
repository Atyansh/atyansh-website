const puppeteer = require('puppeteer');

async function checkFilmPage() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const films = [
    { url: 'https://letterboxd.com/film/blade-runner-2049/', name: 'Blade Runner 2049' },
    { url: 'https://letterboxd.com/film/inception/', name: 'Inception' }
  ];

  for (const film of films) {
    console.log(`\n=== Checking ${film.name} ===`);
    console.log(`URL: ${film.url}`);

    await page.goto(film.url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const posterData = await page.evaluate(() => {
      const poster = document.querySelector('.poster img');
      const posterDiv = document.querySelector('.film-poster');

      return {
        src: poster?.getAttribute('src') || '',
        srcset: poster?.getAttribute('srcset') || '',
        posterHTML: posterDiv?.outerHTML.substring(0, 800) || ''
      };
    });

    console.log(`Poster src: ${posterData.src}`);
    console.log(`Poster srcset: ${posterData.srcset}`);
    console.log(`HTML: ${posterData.posterHTML.substring(0, 400)}...`);
  }

  await browser.close();
}

checkFilmPage()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
