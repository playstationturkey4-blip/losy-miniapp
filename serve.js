const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8123;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname);
  if (pathname === '/') pathname = '/index.html';

  let filePath = path.normalize(path.join(ROOT_DIR, pathname));

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      console.log(`[404] ${req.method} ${req.url}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const etag = `W/"${stats.size.toString(16)}-${stats.mtimeMs.toString(16)}"`;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);
    res.setHeader('ETag', etag);

    if (ext === '.html' || pathname === '/sw.js') {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304);
      res.end();
      return;
    }

    // Compression for compressible types
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const compressible = /^(text\/|application\/javascript|application\/json|image\/svg\+xml)/.test(contentType);

    const stream = fs.createReadStream(filePath);
    stream.on('error', (streamErr) => {
      console.error(`Stream error: ${streamErr.message}`);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('500 Internal Server Error');
      }
    });

    if (compressible && acceptEncoding.includes('br')) {
      res.writeHead(200, { 'Content-Encoding': 'br', 'Vary': 'Accept-Encoding' });
      const zlib = require('zlib');
      stream.pipe(zlib.createBrotliCompress()).pipe(res);
    } else if (compressible && acceptEncoding.includes('gzip')) {
      res.writeHead(200, { 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' });
      const zlib = require('zlib');
      stream.pipe(zlib.createGzip()).pipe(res);
    } else {
      res.writeHead(200);
      stream.pipe(res);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Node Server running on http://0.0.0.0:${PORT}`);
  console.log(`📁 Serving directory: ${ROOT_DIR}`);
});
