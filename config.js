// Lo poco que se configura del portal.
window.CONSMAN_RED = {
  // La entrada del administrador. No va la contraseña sino su huella:
  // SHA-256 de «usuario:contraseña». Para cambiarla, en una terminal:
  //   node -e "console.log(require('crypto').createHash('sha256').update('usuario:contraseña').digest('hex'))"
  //
  // OJO: esto es una página sin servidor. Esta entrada sólo decide qué se
  // ENSEÑA; quien sepa mirar el código puede saltársela. Lo que de verdad
  // impide que otro cambie el mapa es la clave de GitHub, que no está aquí:
  // la pega el administrador en su navegador y sin ella no se guarda nada.
  adminHuella: '09690ba1bc8fcb0af312ef77eb9ad4a05e4ffef6b4d109fb3a17c753c5339266',

  // Dónde se guardan los cambios. Vacío = se deduce de la dirección de la
  // página (cuenta.github.io/repositorio). Sólo hay que rellenarlo si se pone
  // un dominio propio.
  github: { propietario: '', repositorio: '', rama: 'main' },
}
