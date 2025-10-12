const fs = require('fs');
const https = require('https');

async function testUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode);
    }).on('error', () => {
      resolve(0);
    });
  });
}

async function validatePosters() {
  const data = JSON.parse(fs.readFileSync('.cache/letterboxd-data.json', 'utf-8'));

  console.log(`Testing ${data.movies.length} poster URLs...\n`);

  const results = {
    success: [],
    forbidden: [],
    other: []
  };

  for (const movie of data.movies) {
    const status = await testUrl(movie.posterImage);

    if (status === 200) {
      results.success.push(movie);
    } else if (status === 403) {
      results.forbidden.push(movie);
    } else {
      results.other.push({movie, status});
    }

    // Progress indicator
    const total = results.success.length + results.forbidden.length + results.other.length;
    if (total % 10 === 0) {
      process.stdout.write(`Tested ${total}/${data.movies.length}...\r`);
    }
  }

  console.log(`\n\n=== RESULTS ===`);
  console.log(`✅ Success (HTTP 200): ${results.success.length}`);
  console.log(`❌ Forbidden (HTTP 403): ${results.forbidden.length}`);
  console.log(`⚠️  Other errors: ${results.other.length}`);

  if (results.forbidden.length > 0) {
    console.log(`\n=== FORBIDDEN MOVIES (first 10) ===`);
    results.forbidden.slice(0, 10).forEach(movie => {
      console.log(`${movie.title} (${movie.year || 'unknown'})`);
      console.log(`  URL: ${movie.posterImage}`);
    });
  }

  if (results.other.length > 0) {
    console.log(`\n=== OTHER ERRORS ===`);
    results.other.forEach(({movie, status}) => {
      console.log(`${movie.title}: HTTP ${status}`);
    });
  }
}

validatePosters()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
