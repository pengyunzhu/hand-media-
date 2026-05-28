const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const PUBLIC_DIR = path.resolve(__dirname);

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg'
};

http.createServer((req, res) => {
  const safePath = path.normalize(req.url.split('?')[0]).replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath || 'index.html');
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, {'Content-Type': 'text/plain'});
    res.end('Forbidden');
    return;
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Not Found');
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type': contentType});
    fs.createReadStream(resolvedPath).pipe(res);
  });
}).listen(PORT, () => {
  console.log(`Static server running at http://127.0.0.1:${PORT}/`);
  console.log('Press Ctrl+C to stop.');
});
