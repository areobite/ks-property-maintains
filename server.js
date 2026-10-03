const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const dataFile = path.join(root, 'reviews.json');
const contentFile = path.join(root, 'site-content.json');
const port = Number(process.env.PORT) || 4173;
const adminCode = process.env.KSPM_ADMIN_CODE || '4442079';
const adminSessions = new Set();
const editablePhotos = new Set(['photo5.jpg', 'photo6.jpg', 'photo7.jpg', 'photo8.jpg', 'photo9.jpg', 'photo10.jpg']);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]\n', { flag: 'wx' });

function readReviews() {
  try {
    const value = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 7_000_000) {
        reject(new Error('Upload is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function isAdmin(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  return Boolean(token && adminSessions.has(token));
}

function readContent() {
  try { return JSON.parse(fs.readFileSync(contentFile, 'utf8')); }
  catch { return {}; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/content' && req.method === 'GET') {
    return send(res, 200, readContent());
  }

  if (url.pathname === '/api/admin/login' && req.method === 'POST') {
    try {
      const input = JSON.parse(await readBody(req));
      if (String(input.code || '') !== adminCode) return send(res, 401, { error: 'That code is not correct.' });
      const token = require('node:crypto').randomBytes(32).toString('hex');
      adminSessions.add(token);
      return send(res, 200, { token });
    } catch { return send(res, 400, { error: 'Could not sign in.' }); }
  }

  if (url.pathname.startsWith('/api/admin/') && !isAdmin(req)) {
    return send(res, 401, { error: 'Please sign in to manage the website.' });
  }

  if (url.pathname === '/api/admin/content' && req.method === 'GET') return send(res, 200, readContent());

  if (url.pathname === '/api/admin/content' && req.method === 'PUT') {
    try {
      const content = JSON.parse(await readBody(req));
      if (!content || typeof content !== 'object' || Array.isArray(content) || Object.keys(content).length > 100) return send(res, 400, { error: 'Invalid website text.' });
      const clean = Object.fromEntries(Object.entries(content).filter(([key, value]) => /^[a-zA-Z0-9_-]{1,80}$/.test(key) && typeof value === 'string').map(([key, value]) => [key, value.slice(0, 1000)]));
      fs.writeFileSync(contentFile, `${JSON.stringify(clean, null, 2)}\n`);
      return send(res, 200, { ok: true });
    } catch { return send(res, 400, { error: 'Could not save website text.' }); }
  }

  if (url.pathname === '/api/admin/photo' && req.method === 'PUT') {
    try {
      const input = JSON.parse(await readBody(req));
      if (!editablePhotos.has(input.name) || typeof input.data !== 'string' || !input.data.startsWith('data:image/jpeg;base64,')) return send(res, 400, { error: 'Choose a JPG gallery photo.' });
      const image = Buffer.from(input.data.slice('data:image/jpeg;base64,'.length), 'base64');
      if (image.length > 5_000_000 || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff) return send(res, 400, { error: 'The JPG must be smaller than 5 MB.' });
      fs.writeFileSync(path.join(root, input.name), image);
      return send(res, 200, { ok: true });
    } catch { return send(res, 400, { error: 'Could not replace that photo.' }); }
  }

  const adminReviewMatch = url.pathname.match(/^\/api\/admin\/reviews\/(\d+)$/);
  if (adminReviewMatch && req.method === 'PUT') {
    try {
      const reviews = readReviews();
      const index = Number(adminReviewMatch[1]);
      if (!reviews[index]) return send(res, 404, { error: 'Review not found.' });
      const input = JSON.parse(await readBody(req));
      const text = typeof input.text === 'string' ? input.text.trim().slice(0, 1000) : reviews[index].text;
      const response = typeof input.response === 'string' ? input.response.trim().slice(0, 1000) : '';
      if (!text) return send(res, 400, { error: 'A review cannot be empty.' });
      reviews[index] = { ...reviews[index], text, response };
      fs.writeFileSync(dataFile, `${JSON.stringify(reviews, null, 2)}\n`);
      return send(res, 200, reviews[index]);
    } catch { return send(res, 400, { error: 'Could not save the review.' }); }
  }

  if (url.pathname === '/api/reviews' && req.method === 'GET') {
    return send(res, 200, readReviews());
  }

  if (url.pathname === '/api/reviews' && req.method === 'POST') {
    try {
      const input = JSON.parse(await readBody(req));
      const name = typeof input.name === 'string' ? input.name.trim().slice(0, 40) : '';
      const text = typeof input.text === 'string' ? input.text.trim().slice(0, 1000) : '';
      const rating = Number(input.rating);
      if (!name || !text || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return send(res, 400, { error: 'Enter your name, review, and a rating from 1 to 5 stars.' });
      }
      const reviews = readReviews();
      const review = { name, text, rating, date: new Date().toISOString() };
      reviews.push(review);
      fs.writeFileSync(dataFile, `${JSON.stringify(reviews, null, 2)}\n`);
      return send(res, 201, review);
    } catch (error) {
      return send(res, 400, { error: error.message === 'Review is too large.' ? error.message : 'Could not save the review. Please check the submitted details.' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, { error: 'Method not allowed.' });
  }

  let requested;
  try {
    requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  } catch {
    return send(res, 400, { error: 'Invalid path.' });
  }
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(`${root}${path.sep}`)) return send(res, 404, { error: 'Not found.' });
  fs.readFile(file, (error, contents) => {
    if (error) return send(res, 404, 'Not found.', 'text/plain; charset=utf-8');
    res.writeHead(200, {
      'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : contents);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`K&S Property Maintenance is running at http://127.0.0.1:${port}`);
  console.log(`Reviews are saved in ${dataFile}`);
});
