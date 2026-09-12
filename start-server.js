const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const localtunnel = require('localtunnel');

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
  '.webm': 'video/webm',
  '.m4v': 'video/mp4',
  '.ogv': 'video/ogg'
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
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      try {
        stats = fs.statSync(filePath);
      } catch (e) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const totalSize = stats.size;
    const isMedia = ext === '.mp4' || ext === '.webm' || ext === '.m4v' || ext === '.mp3' || ext === '.ogg';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');

    if (isMedia) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (isNaN(start) || isNaN(end) || start > end || start >= totalSize) {
        res.writeHead(416, {
          'Content-Range': `bytes */${totalSize}`,
          'Content-Type': contentType
        });
        res.end();
        return;
      }

      const chunkSize = (end - start) + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', (streamErr) => {
        console.error(`Stream error: ${streamErr.message}`);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end('500 Internal Server Error');
        }
      });
      console.log(`[206] ${req.method} ${pathname} range=${range} (${chunkSize} bytes)`);
      stream.pipe(res);
      return;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', totalSize);

    if (req.method === 'HEAD') {
      res.writeHead(200);
      res.end();
      return;
    }

    res.writeHead(200);
    const stream = fs.createReadStream(filePath);
    stream.on('error', (streamErr) => {
      console.error(`Stream error: ${streamErr.message}`);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('500 Internal Server Error');
      }
    });

    console.log(`[200] ${req.method} ${pathname} from ${req.socket.remoteAddress}`);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 [LOCAL] Node Server: http://192.168.31.254:${PORT}`);
  console.log(`🚀 [LOCAL UPGRADE]: http://192.168.31.254:${PORT}/modes/losy-upgrade-v24.html`);

  async function connectTunnel() {
    try {
      console.log('📡 Connecting to public HTTPS tunnel (localtunnel)...');
      const tunnel = await localtunnel({ port: PORT });
      console.log(`🌍 [PUBLIC HTTPS URL]: ${tunnel.url}`);
      console.log(`🌍 [PUBLIC UPGRADE]: ${tunnel.url}/modes/losy-upgrade-v24.html`);
      
      tunnel.on('close', () => {
        console.log('Tunnel closed, reconnecting in 5s...');
        setTimeout(connectTunnel, 5000);
      });
      tunnel.on('error', (err) => {
        console.error('Tunnel error:', err.message);
      });
    } catch (e) {
      console.error('Failed to create tunnel:', e.message);
      setTimeout(connectTunnel, 5000);
    }
  }

  connectTunnel();
});
