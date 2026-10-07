// Portal de Consman para clientes. Una página sin servidor: todo pasa en el
// navegador.
//
//   - Se entra como invitado (un botón) o como administrador.
//   - El invitado ve los apartados; de momento sólo hay uno, el mapa, con los
//     talleres como puntos y su nombre al pasar el ratón. Nada más.
//   - El administrador ve lo mismo y además puede editar el mapa: esconder
//     talleres, cambiarlos, moverlos, añadir y quitar. Al guardar, el fichero
//     data/talleres.json se escribe en el repositorio de GitHub y en un minuto
//     lo ve todo el mundo.

;(function () {
  'use strict'

  const CONFIG = window.CONSMAN_RED || {}
  const RUTA_DATOS = 'data/talleres.json'
  const CLAVE_SESION = 'consman-red.sesion'
  const CLAVE_GITHUB = 'consman-red.github'
  const app = document.getElementById('app')

  // ----------------------------------------------------------- utilidades

  /** Crea un elemento: h('button', { class: 'boton', onclick: f }, 'Texto', otro) */
  function h(etiqueta, atributos, ...hijos) {
    const el = document.createElement(etiqueta)
    for (const [k, v] of Object.entries(atributos || {})) {
      if (v == null || v === false) continue
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
      else if (k === 'html') el.innerHTML = v
      else el.setAttribute(k, v === true ? '' : v)
    }
    for (const hijo of hijos.flat(Infinity)) {
      if (hijo == null || hijo === false) continue
      el.append(hijo.nodeType ? hijo : document.createTextNode(String(hijo)))
    }
    return el
  }

  const ICONOS = {
    mapa: '<path d="M18 8c0 3.6-2.4 6.5-6 9.5-3.6-3-6-5.9-6-9.5a6 6 0 0 1 12 0"/><circle cx="12" cy="8" r="2"/><path d="M8.7 14.2 3.6 15.7a1 1 0 0 0-.6.9V20a1 1 0 0 0 1.3 1l4.1-1.2a1 1 0 0 1 .6 0l6 1.8a1 1 0 0 0 .6 0l4.8-1.4a1 1 0 0 0 .6-.9v-3.4a1 1 0 0 0-1.3-1l-4.3 1.3"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    atras: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    ojo: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
    ojoNo: '<path d="M10.7 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2"/><path d="M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    lapiz: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    papelera: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    mas: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    equis: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    encuadre: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/>',
    nube: '<path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.6A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/>',
  }

  // Con innerHTML y no con createElement: un <svg> tiene que nacer en su espacio de nombres para pintarse
  function svg(nombre) {
    const caja = document.createElement('span')
    caja.innerHTML = `<svg class="icono" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[nombre]}</svg>`
    return caja.firstChild
  }

  async function huella(texto) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
  }

  // ---------------------------------------------------------------- sesión
  // En sessionStorage: se acaba al cerrar la pestaña.

  function rol() {
    try {
      return sessionStorage.getItem(CLAVE_SESION)
    } catch {
      return null
    }
  }
  function ponerRol(r) {
    try {
      if (r) sessionStorage.setItem(CLAVE_SESION, r)
      else sessionStorage.removeItem(CLAVE_SESION)
    } catch {
      /* navegación privada estricta: se pierde al recargar, nada más */
    }
  }

  // ----------------------------------------------------------------- datos

  /** De qué repositorio es esta página: cuenta.github.io/repositorio */
  function repositorio() {
    const g = CONFIG.github || {}
    if (g.propietario && g.repositorio) return { propietario: g.propietario, nombre: g.repositorio, rama: g.rama || 'main' }
    const m = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i)
    if (!m) return null
    const carpeta = location.pathname.split('/').filter(Boolean)[0]
    return { propietario: m[1], nombre: carpeta || `${m[1]}.github.io`, rama: g.rama || 'main' }
  }

  function claveGithub() {
    try {
      return localStorage.getItem(CLAVE_GITHUB) || ''
    } catch {
      return ''
    }
  }

  function limpiar(t) {
    return {
      id: String(t.id),
      nombre: String(t.nombre || '').trim(),
      lat: Number(t.lat),
      lng: Number(t.lng),
      nivel: [1, 2, 3].includes(Number(t.nivel)) ? Number(t.nivel) : 3,
      activado: t.activado === true,
      marcado: t.marcado === true,
      visible: t.visible !== false,
    }
  }

  /** Lo publicado: lo que ve cualquiera que entre */
  async function leerPublicado() {
    const res = await fetch(`${RUTA_DATOS}?v=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`No se han podido leer los talleres (${res.status})`)
    const datos = await res.json()
    return (datos.talleres || []).map(limpiar)
  }

  function cabecerasGithub() {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${claveGithub()}`,
      'X-GitHub-Api-Version': '2022-11-28',
    }
  }

  function direccionApi() {
    const r = repositorio()
    return `https://api.github.com/repos/${r.propietario}/${r.nombre}/contents/${RUTA_DATOS}`
  }

  /** Lo que hay AHORA en el repositorio (la página tarda un minuto en publicarlo) y su versión */
  async function leerDeGithub() {
    const r = repositorio()
    const res = await fetch(`${direccionApi()}?ref=${encodeURIComponent(r.rama)}&v=${Date.now()}`, {
      headers: cabecerasGithub(),
      cache: 'no-store',
    })
    if (res.status === 401) throw new Error('GitHub no acepta la clave: ha caducado o está mal copiada.')
    if (res.status === 403 || res.status === 404)
      throw new Error('La clave no tiene permiso sobre este repositorio (o el repositorio no es el que toca).')
    if (!res.ok) throw new Error(`GitHub ha contestado ${res.status}`)
    const fichero = await res.json()
    const bytes = Uint8Array.from(atob(fichero.content.replace(/\s/g, '')), (c) => c.charCodeAt(0))
    const datos = JSON.parse(new TextDecoder().decode(bytes))
    return { talleres: (datos.talleres || []).map(limpiar), version: fichero.sha }
  }

  function comoFichero(talleres) {
    return JSON.stringify({ talleres }, null, 2) + '\n'
  }

  async function guardarEnGithub(talleres, version) {
    const r = repositorio()
    const bytes = new TextEncoder().encode(comoFichero(talleres))
    let binario = ''
    for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    const res = await fetch(direccionApi(), {
      method: 'PUT',
      headers: cabecerasGithub(),
      body: JSON.stringify({
        message: 'Mapa: cambios desde el portal',
        content: btoa(binario),
        sha: version,
        branch: r.rama,
      }),
    })
    if (res.status === 409 || res.status === 422)
      throw new Error('Alguien ha guardado otros cambios mientras tanto. Recarga la página y vuelve a hacer los tuyos.')
    if (res.status === 401) throw new Error('GitHub no acepta la clave: ha caducado o está mal copiada.')
    if (res.status === 403 || res.status === 404) throw new Error('La clave no tiene permiso para escribir en el repositorio.')
    if (!res.ok) throw new Error(`GitHub ha contestado ${res.status}`)
    return (await res.json()).content.sha
  }

  // ------------------------------------------------------------ navegación

  let limpiarVista = null
  /** La vista que tenga cambios a medias pregunta antes de dejar salir */
  let puedeSalir = () => true

  function ir(ruta) {
    if (!puedeSalir()) return
    if (location.hash === `#${ruta}`) pintar()
    else location.hash = ruta
  }

  function pintar() {
    if (limpiarVista) {
      limpiarVista()
      limpiarVista = null
    }
    const ruta = location.hash.replace(/^#/, '') || '/'
    const quien = rol()
    app.replaceChildren()

    if (!quien) return vistaEntrada()
    if (ruta === '/mapa') return vistaMapa(false)
    if (ruta === '/mapa/editar' && quien === 'admin') return vistaMapa(true)
    return vistaInicio()
  }

  function salir() {
    ponerRol(null)
    ir('/')
  }

  function cabecera({ titulo, subtitulo, atras, acciones }) {
    return h(
      'header',
      { class: 'cabecera' },
      atras
        ? h('button', { class: 'boton boton--fantasma boton--icono', 'aria-label': 'Volver', onclick: () => ir(atras) }, svg('atras'))
        : h('img', { class: 'logo', src: 'assets/logo-consman.png', alt: 'Consman' }),
      h('span', { class: 'cabecera-barra' }),
      h('div', { class: 'cabecera-textos' }, h('h1', { class: 'titulo' }, titulo), subtitulo ? h('p', null, subtitulo) : null),
      h(
        'div',
        { class: 'cabecera-acciones' },
        acciones || null,
        h('span', { class: 'rol solo-ancho' }, rol() === 'admin' ? 'Administrador' : 'Invitado'),
        h('button', { class: 'boton boton--fantasma boton--pequeno', onclick: salir }, svg('salir'), h('span', { class: 'solo-ancho' }, 'Salir'))
      )
    )
  }

  // --------------------------------------------------------------- entrada

  function vistaEntrada() {
    const usuario = h('input', { class: 'campo', id: 'usuario', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' })
    const clave = h('input', { class: 'campo', id: 'clave', type: 'password', autocomplete: 'current-password' })
    const aviso = h('p', { class: 'error', role: 'alert' })

    async function entrar(e) {
      e.preventDefault()
      aviso.textContent = ''
      if (!usuario.value.trim() || !clave.value) {
        aviso.textContent = 'Escribe el usuario y la contraseña.'
        return
      }
      let coincide = false
      try {
        coincide = (await huella(`${usuario.value.trim().toLowerCase()}:${clave.value}`)) === CONFIG.adminHuella
      } catch {
        aviso.textContent = 'Este navegador no deja comprobar la contraseña. Entra por la dirección https.'
        return
      }
      if (!coincide) {
        aviso.textContent = 'El usuario o la contraseña no son correctos.'
        clave.value = ''
        clave.focus()
        return
      }
      ponerRol('admin')
      ir('/inicio')
    }

    app.append(
      h(
        'main',
        { class: 'entrada' },
        h(
          'div',
          { class: 'entrada-marca' },
          h('img', { class: 'logo', src: 'assets/logo-consman.png', alt: 'Consman' }),
          h('p', { class: 'titulo entrada-lema' }, 'Nuestra red de servicio, ', h('span', null, 'cerca de donde esté tu flota.')),
          h('p', { class: 'entrada-pie' }, 'Consman · Portal de clientes')
        ),
        h(
          'div',
          { class: 'entrada-formulario' },
          h(
            'div',
            { class: 'entrada-caja' },
            h('img', { class: 'logo-movil', src: 'assets/logo-consman.png', alt: 'Consman' }),
            h('h1', { class: 'titulo' }, 'Portal de clientes'),
            h('p', { class: 'apagado' }, 'Entra para ver nuestra red de servicio.'),
            h(
              'button',
              { class: 'boton boton--acento boton--grande', style: 'margin-top:20px', onclick: () => (ponerRol('invitado'), ir('/inicio')) },
              'Entrar como invitado'
            ),
            h('div', { class: 'separador' }, 'o con tu usuario'),
            h(
              'form',
              { onsubmit: entrar, style: 'margin-top:0' },
              h('div', null, h('label', { class: 'etiqueta', for: 'usuario' }, 'Usuario'), usuario),
              h('div', null, h('label', { class: 'etiqueta', for: 'clave' }, 'Contraseña'), clave),
              aviso,
              h('button', { class: 'boton boton--grande', type: 'submit' }, 'Entrar')
            )
          )
        )
      )
    )
  }

  // ---------------------------------------------------------------- inicio

  function vistaInicio() {
    const admin = rol() === 'admin'
    // Los apartados. Para añadir uno nuevo, otra línea aquí y su vista
    const apartados = [
      { titulo: 'Mapa', texto: 'Los talleres de nuestra red de servicio.', icono: 'mapa', ruta: '/mapa' },
      admin && { titulo: 'Editar el mapa', texto: 'Qué talleres se ven, cuáles no y cómo salen.', icono: 'lapiz', ruta: '/mapa/editar' },
    ].filter(Boolean)

    app.append(
      cabecera({ titulo: 'Portal de clientes', subtitulo: 'Consman' }),
      h(
        'main',
        { class: 'pagina' },
        h('h2', { class: 'titulo' }, 'Apartados'),
        h(
          'div',
          { class: 'apartados' },
          apartados.map((a, i) =>
            h(
              'button',
              { class: 'apartado', style: `animation-delay:${i * 80}ms`, onclick: () => ir(a.ruta) },
              h('span', { class: 'apartado-icono' }, svg(a.icono)),
              h('span', null, h('span', { class: 'titulo', style: 'display:block' }, a.titulo), h('p', null, a.texto))
            )
          )
        )
      )
    )
  }

  // ------------------------------------------------------------------ mapa

  const PENINSULA = [
    [35.9, -9.5],
    [43.9, 4.4],
  ]
  const esCanarias = (t) => t.lat < 32

  function vistaMapa(editando) {
    let talleres = []
    let version = null // la del fichero en GitHub, para no pisar cambios de otro
    let elegidoId = null
    let sinGuardar = false
    let guardando = false
    let estado = { tipo: '', texto: '' }
    const marcas = new Map()

    const cajaMapa = h('div', { class: 'mapa' })
    const lienzo = h('div', { class: 'lienzo' }, cajaMapa)
    const zonas = h('div', { class: 'flotante zonas' })
    const panel = editando ? h('aside', { class: 'flotante editor' }) : null

    app.append(
      cabecera({
        titulo: editando ? 'Editar el mapa' : 'Red de servicio',
        subtitulo: editando ? 'Lo que guardes aquí es lo que verán los clientes.' : 'Nuestros talleres. Pasa por encima de un punto para ver cuál es.',
        atras: '/inicio',
      }),
      lienzo
    )
    if (panel) lienzo.append(panel)
    lienzo.append(zonas)

    const mapa = L.map(cajaMapa, { zoomControl: false, minZoom: 4, maxZoom: 18 })
    L.control.zoom({ position: 'bottomleft', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(mapa)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(mapa)
    mapa.fitBounds(PENINSULA)

    const alCambiarTamano = () => mapa.invalidateSize()
    window.addEventListener('resize', alCambiarTamano)
    const antesDeIrse = (e) => {
      if (sinGuardar) e.preventDefault()
    }
    window.addEventListener('beforeunload', antesDeIrse)
    puedeSalir = () => !sinGuardar || confirm('Hay cambios sin guardar. ¿Salir y perderlos?')
    limpiarVista = () => {
      puedeSalir = () => true
      window.removeEventListener('resize', alCambiarTamano)
      window.removeEventListener('beforeunload', antesDeIrse)
      mapa.remove()
    }

    /** Lo que tapa el panel de edición, para encuadrar en lo que queda a la vista */
    function margenes() {
      const ancho = lienzo.clientWidth > 900
      return {
        paddingTopLeft: [40, 40],
        paddingBottomRight: editando ? (ancho ? [440, 70] : [40, Math.round(lienzo.clientHeight * 0.6)]) : [40, 70],
      }
    }

    const aLaVista = () => (editando ? talleres : talleres.filter((t) => t.visible))

    function encuadrar(zona) {
      const todos = aLaVista()
      const islas = todos.filter(esCanarias)
      const resto = todos.filter((t) => !esCanarias(t))
      const grupo = zona === 'canarias' ? (islas.length ? islas : resto) : resto.length ? resto : islas
      if (!grupo.length) return mapa.fitBounds(PENINSULA)
      mapa.fitBounds(L.latLngBounds(grupo.map((t) => [t.lat, t.lng])), { ...margenes(), maxZoom: 11 })
    }

    function pintarZonas() {
      const islas = aLaVista().filter(esCanarias).length
      zonas.replaceChildren(
        h('button', { class: 'boton boton--claro boton--pequeno', onclick: () => encuadrar('peninsula') }, svg('encuadre'), 'Península'),
        islas ? h('button', { class: 'boton boton--claro boton--pequeno', onclick: () => encuadrar('canarias') }, `Canarias (${islas})`) : null
      )
    }

    function pintarPuntos() {
      const visibles = aLaVista()
      const ids = new Set(visibles.map((t) => t.id))
      for (const [id, marca] of marcas) {
        if (!ids.has(id)) {
          marca.remove()
          marcas.delete(id)
        }
      }
      for (const t of visibles) {
        const clases = ['punto', t.activado && 'punto--activado', t.marcado && 'punto--marcado', !t.visible && 'punto--oculto', t.id === elegidoId && 'punto--elegido']
          .filter(Boolean)
          .join(' ')
        // El número del nivel sólo lo ve el administrador al editar: el
        // cliente ve el círculo a secas, con su color.
        const dibujo = L.divIcon({
          className: clases,
          html: editando ? `<span>${t.nivel}</span>` : '<span></span>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        })
        let marca = marcas.get(t.id)
        if (!marca) {
          marca = L.marker([t.lat, t.lng], { icon: dibujo, alt: t.nombre, keyboard: false, draggable: editando })
          if (editando) {
            marca.on('click', () => elegir(t.id))
            marca.on('dragend', () => {
              const p = marca.getLatLng()
              cambiar(t.id, { lat: Number(p.lat.toFixed(5)), lng: Number(p.lng.toFixed(5)) })
            })
          }
          marca.addTo(mapa)
          marcas.set(t.id, marca)
        } else {
          marca.setLatLng([t.lat, t.lng])
          marca.setIcon(dibujo)
        }
        // El nombre y nada más. Como texto, no como HTML: lo escribe una persona
        const etiqueta = document.createElement('span')
        etiqueta.textContent = t.nombre
        marca.unbindTooltip()
        marca.bindTooltip(etiqueta, { direction: 'top', offset: [0, -16] })
        marca.setZIndexOffset(t.id === elegidoId ? 1000 : 0)
      }
      pintarZonas()
    }

    // ------------------------------------------------------ sólo edición

    function cambiar(id, cambios) {
      talleres = talleres.map((t) => (t.id === id ? { ...t, ...cambios } : t))
      sinGuardar = true
      estado = { tipo: '', texto: '' }
      pintarPuntos()
      pintarPanel()
    }

    function elegir(id) {
      elegidoId = elegidoId === id ? null : id
      const t = talleres.find((x) => x.id === elegidoId)
      if (t) mapa.panInside([t.lat, t.lng], margenes())
      pintarPuntos()
      pintarPanel()
    }

    function nuevo() {
      const centro = mapa.getCenter()
      const id = `t${Date.now().toString(36)}`
      talleres = [...talleres, { id, nombre: 'Taller nuevo', lat: Number(centro.lat.toFixed(5)), lng: Number(centro.lng.toFixed(5)), nivel: 3, activado: false, marcado: false, visible: true }]
      sinGuardar = true
      elegidoId = id
      pintarPuntos()
      pintarPanel()
    }

    function quitar(t) {
      if (!confirm(`¿Quitar «${t.nombre}» del mapa para siempre?\n\nSi sólo quieres que no se vea, usa el ojo.`)) return
      talleres = talleres.filter((x) => x.id !== t.id)
      if (elegidoId === t.id) elegidoId = null
      sinGuardar = true
      pintarPuntos()
      pintarPanel()
    }

    async function guardar() {
      const malos = talleres.filter((t) => !t.nombre || !Number.isFinite(t.lat) || !Number.isFinite(t.lng))
      if (malos.length) {
        estado = { tipo: 'mal', texto: 'Hay algún taller sin nombre o sin posición: arréglalo antes de guardar.' }
        return pintarPanel()
      }
      guardando = true
      estado = { tipo: 'pendiente', texto: 'Guardando…' }
      pintarPanel()
      try {
        version = await guardarEnGithub(talleres, version)
        sinGuardar = false
        estado = { tipo: '', texto: 'Guardado. Los clientes lo verán en un minuto o dos.' }
      } catch (e) {
        estado = { tipo: 'mal', texto: e.message || 'No se ha podido guardar.' }
      }
      guardando = false
      pintarPanel()
    }

    function descargar() {
      const enlace = h('a', { href: URL.createObjectURL(new Blob([comoFichero(talleres)], { type: 'application/json' })), download: 'talleres.json' })
      enlace.click()
      URL.revokeObjectURL(enlace.href)
    }

    function fichaDe(t) {
      const nombre = h('input', { class: 'campo', value: t.nombre, maxlength: '150' })
      nombre.addEventListener('change', () => cambiar(t.id, { nombre: nombre.value.trim() }))
      const posicion = h('input', { class: 'campo', value: `${t.lat}, ${t.lng}`, inputmode: 'decimal' })
      posicion.addEventListener('change', () => {
        const m = posicion.value.match(/(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)/)
        const lat = m ? Number(m[1].replace(',', '.')) : NaN
        const lng = m ? Number(m[2].replace(',', '.')) : NaN
        if (!m || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          estado = { tipo: 'mal', texto: 'Esa posición no vale. Tiene que ser como «41.4685, 1.9718».' }
          return pintarPanel()
        }
        cambiar(t.id, { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) })
        mapa.panInside([lat, lng], margenes())
      })
      const pastilla = (texto, puesta, alPulsar, roja) =>
        h('button', { class: `pastilla${roja ? ' pastilla--rojo' : ''}`, type: 'button', 'aria-pressed': String(puesta), onclick: alPulsar }, texto)

      return h(
        'div',
        { class: 'ficha' },
        h('div', null, h('label', { class: 'etiqueta' }, 'Nombre (lo único que ve el cliente al pasar el ratón)'), nombre),
        h('div', null, h('span', { class: 'etiqueta' }, 'Nivel'), h('div', { class: 'pastillas' }, [1, 2, 3].map((n) => pastilla(`Nivel ${n}`, t.nivel === n, () => cambiar(t.id, { nivel: n }))))),
        h(
          'div',
          null,
          h('span', { class: 'etiqueta' }, 'Color del punto'),
          h(
            'div',
            { class: 'pastillas' },
            pastilla('Activado', t.activado, () => cambiar(t.id, { activado: !t.activado })),
            pastilla('Marcado', t.marcado, () => cambiar(t.id, { marcado: !t.marcado }), true)
          )
        ),
        h(
          'div',
          null,
          h('label', { class: 'etiqueta' }, 'Posición'),
          posicion,
          h('p', { class: 'ayuda' }, 'Arrastra el punto en el mapa, o pega aquí las coordenadas: en Google Maps, clic derecho sobre el sitio y pulsa los números.')
        ),
        h('button', { class: 'boton boton--fantasma boton--pequeno boton--peligro', style: 'justify-self:start', onclick: () => quitar(t) }, svg('papelera'), 'Quitar del mapa')
      )
    }

    function pintarPanel() {
      if (!panel) return
      const conectado = Boolean(repositorio() && claveGithub())
      const ocultos = talleres.filter((t) => !t.visible).length
      const arriba = panel.querySelector('.editor-cuerpo')?.scrollTop ?? 0

      panel.replaceChildren(
        h(
          'div',
          { class: 'editor-cabeza' },
          h('h2', { class: 'titulo' }, `Talleres (${talleres.length})`),
          h('button', { class: 'boton boton--claro boton--pequeno', onclick: nuevo }, svg('mas'), 'Añadir')
        ),
        h(
          'div',
          { class: 'editor-cuerpo' },
          talleres
            .slice()
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
            .map((t) => [
              h(
                'div',
                { class: `fila${t.id === elegidoId ? ' fila--elegida' : ''}${t.visible ? '' : ' fila--oculta'}`, onclick: () => elegir(t.id) },
                h('span', { class: `fila-punto${t.marcado ? ' fila-punto--marcado' : t.activado ? ' fila-punto--activado' : ''}` }, t.nivel),
                h('span', { class: 'fila-nombre' }, t.nombre || '(sin nombre)'),
                h(
                  'button',
                  {
                    class: 'boton boton--fantasma boton--icono',
                    title: t.visible ? 'Los clientes lo ven. Pulsa para esconderlo.' : 'Escondido. Pulsa para que se vea.',
                    'aria-label': t.visible ? 'Esconder' : 'Enseñar',
                    onclick: (e) => (e.stopPropagation(), cambiar(t.id, { visible: !t.visible })),
                  },
                  svg(t.visible ? 'ojo' : 'ojoNo')
                )
              ),
              t.id === elegidoId ? fichaDe(t) : null,
            ])
        ),
        h(
          'div',
          { class: 'editor-pie' },
          h('span', { class: 'apagado' }, `${talleres.length - ocultos} a la vista${ocultos ? ` · ${ocultos} escondidos` : ''}`),
          estado.texto
            ? h('span', { class: `estado${estado.tipo ? ` estado--${estado.tipo}` : ''}` }, estado.texto)
            : sinGuardar
              ? h('span', { class: 'estado estado--pendiente' }, 'Hay cambios sin guardar')
              : null,
          conectado
            ? h('button', { class: 'boton boton--acento', disabled: !sinGuardar || guardando, onclick: guardar }, svg('nube'), guardando ? 'Guardando…' : 'Guardar y publicar')
            : h('button', { class: 'boton boton--acento', onclick: dialogoClave }, 'Conectar con GitHub para guardar'),
          h(
            'div',
            { style: 'display:flex;gap:8px;flex-wrap:wrap' },
            conectado ? h('button', { class: 'boton boton--fantasma boton--pequeno', onclick: dialogoClave }, 'Cambiar la clave') : null,
            h('button', { class: 'boton boton--fantasma boton--pequeno', onclick: descargar }, 'Descargar el fichero')
          )
        )
      )
      panel.querySelector('.editor-cuerpo').scrollTop = arriba
    }

    function dialogoClave() {
      const r = repositorio()
      // El campo va SIEMPRE vacío. Antes venía relleno con la clave guardada,
      // escondida con puntos, y al pegar la nueva se quedaba pegada detrás de
      // la vieja: GitHub decía que la clave estaba mal y era verdad, eran dos.
      const guardada = claveGithub()
      const campo = h('input', {
        class: 'campo',
        type: 'password',
        placeholder: guardada ? 'Ya hay una guardada · pega aquí la nueva' : 'github_pat_…',
        value: '',
        autocomplete: 'off',
      })
      const aviso = h('p', { class: 'error' })
      const cerrar = () => velo.remove()

      async function probar() {
        aviso.textContent = ''
        const antes = claveGithub()
        // Sin escribir nada se vuelve a probar la que ya estaba
        const nueva = campo.value.trim() || antes
        if (!nueva) {
          aviso.textContent = 'Pega la clave de GitHub.'
          return
        }
        if (!/^(github_pat_|ghp_)/.test(nueva)) {
          aviso.textContent = 'Eso no parece una clave de GitHub: tiene que empezar por «github_pat_».'
          return
        }
        // Una clave fine-grained entera mide 93 caracteres. En la pantalla de
        // GitHub sale cortada, y si se copia seleccionando el texto en vez de
        // con su botón de copiar, se lleva sólo un trozo.
        if (nueva.startsWith('github_pat_') && nueva.length !== 93) {
          aviso.textContent =
            `La clave pegada tiene ${nueva.length} caracteres y una entera tiene 93: se ha copiado a medias ` +
            '(o con algo de más). Cópiala con el botón de copiar que hay al lado de la clave en GitHub.'
          return
        }
        try {
          localStorage.setItem(CLAVE_GITHUB, nueva)
          const leido = await leerDeGithub()
          // Si no había cambios a medias, se trabaja sobre lo último guardado
          if (!sinGuardar) talleres = leido.talleres
          version = leido.version
          cerrar()
          pintarPuntos()
          pintarPanel()
        } catch (e) {
          try {
            localStorage.setItem(CLAVE_GITHUB, antes)
          } catch {
            /* nada */
          }
          aviso.textContent = e.message || 'No se ha podido comprobar la clave.'
        }
      }

      const velo = h(
        'div',
        { class: 'velo', onclick: (e) => e.target === velo && cerrar() },
        h(
          'div',
          { class: 'dialogo', role: 'dialog', 'aria-modal': 'true' },
          h('h2', { class: 'titulo' }, 'Conectar con GitHub'),
          r
            ? h(
                'div',
                null,
                h('p', null, 'Para que los cambios se guarden hace falta una clave de GitHub con permiso para escribir en ', h('strong', null, `${r.propietario}/${r.nombre}`), '. Se queda guardada sólo en este navegador.'),
                h(
                  'ol',
                  null,
                  h('li', null, 'En GitHub: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.'),
                  h('li', null, `En «Repository access» elige «Only select repositories» y marca ${r.nombre}.`),
                  h('li', null, 'En «Permissions» → «Repository permissions», pon «Contents» en «Read and write».'),
                  h('li', null, 'Genera la clave, cópiala y pégala aquí.')
                ),
                campo,
                aviso
              )
            : h('p', null, 'Esta página no está abierta desde GitHub Pages, así que no sé en qué repositorio guardar. Puedes editar y usar «Descargar el fichero».'),
          h(
            'div',
            { class: 'dialogo-botones' },
            h('button', { class: 'boton boton--fantasma', onclick: cerrar }, 'Cancelar'),
            r ? h('button', { class: 'boton boton--acento', onclick: probar }, 'Comprobar y guardar la clave') : null
          )
        )
      )
      document.body.append(velo)
      campo.focus()
    }

    // ------------------------------------------------------------- carga

    ;(async () => {
      try {
        // Editando se lee del repositorio si se puede: la página publicada va
        // un minuto por detrás de lo último que se guardó.
        if (editando && repositorio() && claveGithub()) {
          try {
            const leido = await leerDeGithub()
            talleres = leido.talleres
            version = leido.version
          } catch (e) {
            talleres = await leerPublicado()
            estado = { tipo: 'mal', texto: e.message }
          }
        } else {
          talleres = await leerPublicado()
        }
        pintarPuntos()
        encuadrar('peninsula')
        pintarPanel()
      } catch (e) {
        lienzo.append(h('div', { class: 'aviso' }, h('p', { class: 'error' }, 'No se han podido cargar los talleres.'), h('p', { class: 'apagado' }, 'Prueba a recargar la página.')))
        console.error(e)
      }
    })()
  }

  window.addEventListener('hashchange', pintar)
  pintar()
})()
