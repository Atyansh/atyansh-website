const puppeteer = require('puppeteer');
const fs = require('fs');

async function analyzeLetterboxdFilms() {
  console.log('Launching headless browser...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Array to store intercepted requests
  const requests = [];
  const responses = [];

  // Enable request interception
  await page.setRequestInterception(true);

  // Intercept all requests
  page.on('request', (request) => {
    const url = request.url();
    const method = request.method();
    const resourceType = request.resourceType();

    // Log interesting requests (API calls, XHR, fetch)
    if (resourceType === 'xhr' || resourceType === 'fetch' || url.includes('api') || url.includes('.json')) {
      requests.push({
        url,
        method,
        resourceType,
        headers: request.headers(),
        postData: request.postData()
      });
      console.log(`[REQUEST] ${method} ${resourceType}: ${url}`);
    }

    // Continue the request
    request.continue();
  });

  // Intercept responses
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    const resourceType = response.request().resourceType();

    // Log interesting responses
    if (resourceType === 'xhr' || resourceType === 'fetch' || url.includes('api') || url.includes('.json')) {
      console.log(`[RESPONSE] ${status} ${resourceType}: ${url}`);

      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          responses.push({
            url,
            status,
            contentType,
            data
          });
          console.log(`  → JSON data with ${JSON.stringify(data).length} characters`);
        }
      } catch (e) {
        // Not JSON or error reading response
      }
    }
  });

  console.log('\nNavigating to Letterboxd films page...');
  await page.goto('https://letterboxd.com/atyansh/films/', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  console.log('\nWaiting for content to load...');
  await page.waitForSelector('.poster-list', { timeout: 10000 });

  // Scroll down to trigger lazy loading if present
  console.log('\nScrolling page to load more content...');
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

  // Wait a bit more for any additional network requests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // First, save the HTML to inspect
  console.log('\nSaving HTML for inspection...');
  const html = await page.content();
  fs.writeFileSync('/tmp/letterboxd-page.html', html);
  console.log('✓ HTML saved to /tmp/letterboxd-page.html');

  // Extract film data from the page with multiple selector attempts
  console.log('\nExtracting film data from page...');
  const filmData = await page.evaluate(() => {
    const films = [];

    // Try different selectors
    let posterItems = document.querySelectorAll('.poster-container');
    console.log('Found', posterItems.length, 'items with .poster-container');

    if (posterItems.length === 0) {
      posterItems = document.querySelectorAll('.film-poster');
      console.log('Found', posterItems.length, 'items with .film-poster');
    }

    if (posterItems.length === 0) {
      posterItems = document.querySelectorAll('[data-film-slug]');
      console.log('Found', posterItems.length, 'items with [data-film-slug]');
    }

    if (posterItems.length === 0) {
      posterItems = document.querySelectorAll('.poster');
      console.log('Found', posterItems.length, 'items with .poster');
    }

    posterItems.forEach(item => {
      const filmSlug = item.getAttribute('data-film-slug');
      const filmId = item.getAttribute('data-film-id');
      const link = item.querySelector('a') || item;
      const img = item.querySelector('img');

      // Extract more data
      const filmName = item.getAttribute('data-film-name');
      const filmYear = item.getAttribute('data-film-year');
      const targetLink = item.getAttribute('data-target-link');

      films.push({
        slug: filmSlug,
        id: filmId,
        name: filmName,
        year: filmYear,
        href: link ? link.getAttribute('href') : targetLink,
        title: img ? img.getAttribute('alt') : filmName,
        posterUrl: img ? img.getAttribute('src') : null
      });
    });

    return films;
  });

  console.log(`\n✓ Found ${filmData.length} films on the page`);
  console.log(`✓ Captured ${requests.length} API requests`);
  console.log(`✓ Captured ${responses.length} API responses with JSON data`);

  // Output summary
  console.log('\n=== ANALYSIS SUMMARY ===\n');

  console.log('API Requests Found:');
  requests.forEach((req, i) => {
    console.log(`${i + 1}. ${req.method} ${req.url}`);
  });

  console.log('\nAPI Responses with JSON:');
  responses.forEach((res, i) => {
    console.log(`${i + 1}. ${res.url}`);
    console.log(`   Status: ${res.status}`);
    console.log(`   Data keys: ${Object.keys(res.data).join(', ')}`);
  });

  console.log('\nSample Films Found:');
  filmData.slice(0, 10).forEach((film, i) => {
    console.log(`${i + 1}. ${film.title} (${film.slug})`);
  });

  // Save detailed results to file
  const resultsPath = '/tmp/letterboxd-analysis.json';
  fs.writeFileSync(resultsPath, JSON.stringify({
    requests,
    responses,
    filmData
  }, null, 2));
  console.log(`\n✓ Detailed results saved to: ${resultsPath}`);

  await browser.close();

  return { requests, responses, filmData };
}

// Run the analysis
analyzeLetterboxdFilms()
  .then(() => {
    console.log('\n✓ Analysis complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n✗ Error during analysis:', err);
    process.exit(1);
  });
