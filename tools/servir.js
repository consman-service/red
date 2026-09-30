// Sirve la carpeta en local para verla antes de publicarla.
//
// Uso: node tools/servir.js [puerto]      →  http://localhost:4173

const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.resolve(__dirname, '..')
const PUERTO = Number(process.argv[2]) || 4173
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
}

http
  .createServer((req, res) => {
    const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const fichero = path.join(RAIZ, ruta.endsWith('/') ? ruta + 'index.html' : ruta)
    // Nada de salirse de la carpeta
    if (!fichero.startsWith(RAIZ)) return res.writeHead(403).end()
    fs.readFile(fichero, (err, datos) => {
      if (err) return res.writeHead(404).end('No está')
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(fichero)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
      res.end(datos)
    })
  })
  .listen(PUERTO, () => console.log(`http://localhost:${PUERTO}`))
