'use strict';
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/js/vendor/insforge-sdk', express.static(path.join(__dirname, 'node_modules/@insforge/sdk/dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== START SERVER =====
const PORT = parseInt(process.env.PORT || '3443');
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3000');
const certDir = path.join(__dirname, 'certs');
const certFile = path.join(certDir, 'cert.pem');
const keyFile = path.join(certDir, 'key.pem');

if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
  const options = { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) };
  https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
    console.log(`Gym PWA running at https://localhost:${PORT}`);
    console.log('Use start.sh to get phone access instructions.');
  });
} else {
  http.createServer(app).listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`Gym PWA running at http://localhost:${HTTP_PORT}`);
    console.log('Tip: add certs/cert.pem + certs/key.pem for HTTPS. See start.sh');
  });
}

module.exports = app;
