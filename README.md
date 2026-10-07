# Consman · Portal de clientes

Página pública para enseñar a clientes la red de servicio de Consman. Es
independiente del Consman Hub: no comparte ni servidor ni base de datos.

Es una página **sin servidor** (HTML, CSS y JavaScript a pelo, sin compilar),
pensada para GitHub Pages.

## Qué hace

- **Entrada**: botón «Entrar como invitado» o usuario y contraseña.
- **Invitado**: ve los apartados (de momento sólo «Mapa») y, en el mapa, los
  talleres como círculos de color, sin número: el nivel sólo lo ve el
  administrador al editar. Al pasar el ratón sale el nombre del taller y nada
  más. Al hacer clic no pasa nada.
- **Administrador**: además puede **editar el mapa**: esconder talleres (el
  ojo), cambiarles nombre, nivel y color, moverlos arrastrando el punto,
  añadir y quitar. Al pulsar «Guardar y publicar» los cambios se escriben en
  `data/talleres.json` de este repositorio y en un minuto o dos los ve todo
  el mundo.

## Dónde está cada cosa

| Fichero | Qué es |
|---|---|
| `index.html` | La página. |
| `config.js` | La entrada del administrador y, si hiciera falta, el repositorio. |
| `assets/app.js` | Todo el funcionamiento. |
| `assets/app.css` | El aspecto (el mismo estilo que el Consman Hub). |
| `data/talleres.json` | Los talleres: nombre, posición, nivel, color y si se ve. |
| `assets/vendor/leaflet` | La librería del mapa, copiada aquí para no depender de nadie. |
| `tools/` | Para trabajar en local; no forma parte de la página. |

El fondo del mapa es de OpenStreetMap, gratis y sin clave.

## Sobre la seguridad, sin engañarse

- El repositorio es público: **lo que hay en `data/talleres.json` lo puede ver
  cualquiera**, también los talleres escondidos. Esconder es «no sale en el
  mapa», no «es secreto». Lo que no deba saberse, se quita.
- El usuario y la contraseña del administrador sólo deciden qué se **enseña**.
  Quien sepa mirar el código puede saltárselos.
- Lo que de verdad impide que otro cambie el mapa es la **clave de GitHub**:
  la pega el administrador en su navegador la primera vez y sin ella no se
  guarda nada. No está en el código ni en el repositorio.

## Publicarlo (una sola vez)

1. En la cuenta de GitHub, crear un repositorio **público** y vacío, por
   ejemplo `red`.
2. Subir esta carpeta:
   ```
   git init -b main
   git add .
   git commit -m "Portal de clientes: mapa de la red de servicio"
   git remote add origin https://github.com/CUENTA/red.git
   git push -u origin main
   ```
3. En el repositorio: **Settings → Pages → Build and deployment →
   Deploy from a branch → `main` / `(root)` → Save**.
4. En un par de minutos está en `https://CUENTA.github.io/red/`.

## La clave para guardar desde la página (una sola vez por navegador)

1. GitHub → **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. **Repository access**: «Only select repositories» → este repositorio.
3. **Permissions → Repository permissions → Contents: Read and write**.
4. Generar, copiar y pegarla en la página: «Editar el mapa» → «Conectar con
   GitHub para guardar».

Conviene ponerle caducidad (un año) y apuntarse cuándo toca renovarla.

## Cambiar el usuario o la contraseña del administrador

En `config.js` no va la contraseña sino su huella. Para sacar una nueva:

```
node -e "console.log(require('crypto').createHash('sha256').update('usuario:contraseña').digest('hex'))"
```

El usuario va en minúsculas. Se pega el resultado en `adminHuella` y se sube.

## Trabajar en local

```
node tools/servir.js        # http://localhost:4173
node tools/probar.js        # recorre la página y comprueba que todo está en su sitio
```

En local no se puede guardar en GitHub (la página no sabe de qué repositorio
es); sí se puede editar y usar «Descargar el fichero».

## Añadir otro apartado

En `assets/app.js`, en `vistaInicio`, una línea más en la lista de apartados y
su vista correspondiente en `pintar`.
