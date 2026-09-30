// Recorre el portal como lo haría una persona y comprueba que cada cosa está
// donde tiene que estar. Saca capturas a tools/capturas.
//
// Necesita el servidor local en marcha (node tools/servir.js) y un Chrome o
// Edge instalado. Usa el puppeteer-core del Consman Hub, que ya está ahí.
//
// Uso: node tools/probar.js [http://localhost:4173]

const fs = require('node:fs')
const path = require('node:path')
const puppeteer = require('C:/Apps/consman-hub/node_modules/puppeteer-core')

const BASE = process.argv[2] || 'http://localhost:4173'
const DESTINO = path.join(__dirname, 'capturas')
const NAVEGADORES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

let fallos = 0
function comprobar(bien, que) {
  console.log(`  ${bien ? 'OK  ' : 'MAL '} ${que}`)
  if (!bien) fallos++
}

async function main() {
  const ejecutable = NAVEGADORES.find((c) => fs.existsSync(c))
  if (!ejecutable) throw new Error('No encuentro Chrome ni Edge')
  fs.mkdirSync(DESTINO, { recursive: true })

  const navegador = await puppeteer.launch({ executablePath: ejecutable, headless: true, args: ['--no-sandbox'] })
  try {
    const pagina = await navegador.newPage()
    const errores = []
    pagina.on('pageerror', (e) => errores.push(String(e)))
    pagina.on('dialog', (d) => d.accept())
    await pagina.setViewport({ width: 1400, height: 900 })
    const foto = (nombre) => pagina.screenshot({ path: path.join(DESTINO, nombre) })
    const pulsar = async (texto) => {
      for (const b of await pagina.$$('button')) {
        const t = await b.evaluate((e) => (e.textContent || '').trim())
        if (t.startsWith(texto)) {
          await b.click()
          return true
        }
      }
      return false
    }
    const textoDe = () => pagina.evaluate(() => document.body.innerText)

    console.log('\nEntrada')
    await pagina.goto(BASE, { waitUntil: 'networkidle2' })
    await esperar(800)
    comprobar((await textoDe()).includes('Entrar como invitado'), 'sale el botón de invitado')
    await foto('1-entrada.png')

    await pagina.type('#usuario', 'super')
    await pagina.type('#clave', 'mal')
    await pagina.click('button[type=submit]')
    await esperar(400)
    comprobar((await textoDe()).includes('no son correctos'), 'con la contraseña mal no entra')

    console.log('\nInvitado')
    await pulsar('Entrar como invitado')
    await esperar(500)
    let t = await textoDe()
    comprobar(/MAPA/i.test(t) && !/Editar el mapa/i.test(t), 've el apartado Mapa y no el de editar')
    await foto('2-apartados.png')

    await pulsar('Mapa')
    await pagina.waitForSelector('.punto', { timeout: 20000 })
    await esperar(3000)
    const puntos = await pagina.$$('.punto')
    comprobar(puntos.length === 29, `salen los 29 puntos (${puntos.length})`)
    comprobar((await pagina.$$('.punto--activado')).length > 0 && (await pagina.$$('.punto--marcado')).length > 0, 'con los colores de activado y marcado')
    comprobar((await pagina.$('.editor')) === null, 'sin panel de edición')

    await puntos[10].hover()
    await esperar(600)
    const globo = await pagina.$eval('.leaflet-tooltip', (e) => e.textContent).catch(() => '')
    comprobar(globo.length > 2 && !/\d{5}|@|·/.test(globo), `al pasar el ratón, sólo el nombre («${globo}»)`)
    await foto('3-mapa-invitado.png')

    await puntos[10].click()
    await esperar(500)
    comprobar((await pagina.$('.editor, .dialogo, .velo')) === null, 'al hacer clic no se abre nada')

    await pagina.evaluate(() => (location.hash = '/mapa/editar'))
    await esperar(600)
    comprobar((await pagina.$('.editor')) === null, 'no entra a editar escribiendo la dirección a mano')

    console.log('\nAdministrador')
    await pulsar('Salir')
    await esperar(400)
    await pagina.type('#usuario', 'super')
    await pagina.type('#clave', '1234')
    await pagina.click('button[type=submit]')
    await esperar(600)
    comprobar(/Editar el mapa/i.test(await textoDe()), 'con super / 1234 sale «Editar el mapa»')
    await foto('4-apartados-admin.png')

    await pulsar('Editar el mapa')
    await pagina.waitForSelector('.editor .fila', { timeout: 20000 })
    await esperar(2500)
    comprobar((await pagina.$$('.editor .fila')).length === 29, 'la lista trae los 29 talleres')

    // Esconder el primero de la lista
    await pagina.click('.editor .fila button')
    await esperar(400)
    comprobar((await pagina.$$('.punto--oculto')).length === 1, 'al pulsar el ojo, el punto queda marcado como escondido')
    comprobar(/1 escondidos|Hay cambios sin guardar/.test(await textoDe()), 'y avisa de que hay cambios sin guardar')

    // Abrir la ficha del segundo y cambiarle el nivel
    const filas = await pagina.$$('.editor .fila')
    await filas[1].click()
    await esperar(500)
    comprobar((await pagina.$('.ficha')) !== null, 'al pulsar un taller se abre su ficha para editarlo')
    await pulsar('Nivel 1')
    await esperar(300)
    await foto('5-editar.png')

    await pulsar('Añadir')
    await esperar(500)
    comprobar((await pagina.$$('.editor .fila')).length === 30, 'añadir crea un taller nuevo')

    await pulsar('Conectar con GitHub')
    await esperar(400)
    comprobar(/no está abierta desde GitHub Pages|Personal access tokens/.test(await textoDe()), 'el diálogo de la clave explica qué hace falta')
    await foto('6-clave.png')
    await pulsar('Cancelar')

    // Lo que ve el invitado no ha cambiado: nada se ha guardado
    await pagina.evaluate(() => sessionStorage.clear())
    await pagina.goto(BASE, { waitUntil: 'networkidle2' })
    await pulsar('Entrar como invitado')
    await esperar(300)
    await pulsar('Mapa')
    await pagina.waitForSelector('.punto', { timeout: 20000 })
    await esperar(1500)
    comprobar((await pagina.$$('.punto')).length === 29, 'sin guardar, el invitado sigue viendo los 29')

    console.log('\nMóvil')
    await pagina.setViewport({ width: 400, height: 850, deviceScaleFactor: 2 })
    await pagina.reload({ waitUntil: 'networkidle2' })
    await pagina.waitForSelector('.punto', { timeout: 20000 })
    await esperar(2500)
    await foto('7-movil-mapa.png')
    comprobar((await pagina.$$('.punto')).length === 29, 'el mapa sale también en el móvil')

    comprobar(errores.length === 0, `sin errores en la página${errores.length ? ': ' + errores.join(' | ') : ''}`)
  } finally {
    await navegador.close()
  }
  console.log(fallos === 0 ? '\nTodo bien.' : `\n${fallos} MAL.`)
  process.exitCode = fallos === 0 ? 0 : 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
