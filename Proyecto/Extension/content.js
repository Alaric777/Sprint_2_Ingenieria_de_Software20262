window.autocompletarPerfil = function (perfil, seleccionados) {
  const claves = ["nombre", "apellido", "fechaNacimiento", "ciudadNacimiento", "tipoDocumento", "numeroDocumento", "correo", "telefono", "ciudadResidencia", "universidad", "carrera", "fechaInicioEstudios", "fechaFinEstudios"];
  const aliasDatos = {
    fechaNacimiento: ["fechaNacimiento", "fecha_nacimiento"],
    ciudadNacimiento: ["ciudadNacimiento", "ciudad_nacimiento"],
    tipoDocumento: ["tipoDocumento", "tipo_documento"],
    numeroDocumento: ["numeroDocumento", "numero_documento"],
    ciudadResidencia: ["ciudadResidencia", "ubicacion_ciudad", "ciudad_residencia"],
    fechaInicioEstudios: ["fechaInicioEstudios", "fecha_inicio_estudio"],
    fechaFinEstudios: ["fechaFinEstudios", "fecha_fin_estudio"]
  };
  const terminos = {
    nombre: ["nombre", "first name", "firstname", "given name", "givenname"],
    apellido: ["apellido", "apellidos", "last name", "lastname", "surname", "family name"],
    fechaNacimiento: ["fecha nacimiento", "fecha de nacimiento", "date of birth", "birth date", "birthdate", "dob"],
    ciudadNacimiento: ["ciudad nacimiento", "ciudad de nacimiento", "birth city", "city of birth", "birthplace"],
    tipoDocumento: ["tipo documento", "tipo de documento", "document type", "tipo identificacion", "identification type"],
    numeroDocumento: ["numero documento", "numero de documento", "document number", "numero identificacion", "identification number", "documento identidad"],
    correo: ["correo", "correo electronico", "email", "e mail", "email address"],
    telefono: ["telefono", "phone", "telephone", "mobile", "celular", "cellphone"],
    ciudadResidencia: ["ciudad residencia", "ciudad de residencia", "ciudad actual", "residence city", "current city", "ubicacion ciudad", "location city"],
    universidad: ["universidad", "university", "college", "institucion", "institution"],
    carrera: ["carrera", "career", "degree", "major", "grado academico", "programa academico"],
    fechaInicioEstudios: ["fecha inicio estudios", "fecha de inicio", "inicio estudios", "fecha inicio", "start date", "study start", "education start"],
    fechaFinEstudios: ["fecha fin estudios", "fecha finalizacion", "fecha de finalizacion", "fin estudios", "fecha fin", "end date", "graduation date", "education end"]
  };
  function normalizar(texto) {
    return String(texto ?? "").replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, "$1 $2")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[_\-]+/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  }
  function coincide(texto, termino) {
    const t = normalizar(texto), p = normalizar(termino);
    return p && (` ${t} `).includes(` ${p} `);
  }
  function valorPerfil(clave) {
    for (const nombre of (aliasDatos[clave] || [clave])) {
      const valor = perfil?.[nombre];
      if (valor !== undefined && valor !== null && String(valor).trim() !== "") return String(valor).trim();
    }
    return "";
  }
  function descripcion(campo) {
    const etiquetas = campo.labels ? Array.from(campo.labels).map(e => e.textContent).join(" ") : "";
    const cercana = campo.closest("[data-field], .form-group, .field, .form-field");
    const fragmentos = [campo.id, campo.name, campo.placeholder, campo.getAttribute("autocomplete"), campo.getAttribute("aria-label"), etiquetas];
    if (!etiquetas && cercana) {
      const label = cercana.querySelector("label");
      if (label) fragmentos.push(label.textContent);
    }
    return normalizar(fragmentos.filter(Boolean).join(" "));
  }
  function detectar(campo) {
    const texto = descripcion(campo);
    if (!texto) return null;
    if (["username", "user name", "usuario", "password", "contrasena", "confirm", "confirmation", "confirmar", "repetir", "repeat", "search", "busqueda"].some(t => coincide(texto, t))) return null;
    if (["full name", "fullname", "nombre completo"].some(t => coincide(texto, t))) return "nombreCompleto";
    // Priorizar etiquetas específicas (p. ej., ciudad de nacimiento antes que nombre).
    const prioridades = claves.flatMap(clave => terminos[clave].map(termino => ({ clave, termino, longitud: normalizar(termino).length })));
    prioridades.sort((a, b) => b.longitud - a.longitud);
    for (const item of prioridades) if (coincide(texto, item.termino)) return item.clave;
    return null;
  }
  function fechaISO(valor) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  }
  function seleccionarOpcion(campo, valor) {
    const opciones = Array.from(campo.options).filter(o => !o.disabled);
    const v = normalizar(valor);
    const sinonimos = { cc: ["cc", "cedula de ciudadania", "cedula ciudadania"], ce: ["ce", "cedula de extranjeria"], ti: ["ti", "tarjeta de identidad"], pas: ["pas", "pasaporte", "passport"], otro: ["otro", "other"] };
    const equivalentes = sinonimos[v] || [v];
    const opcion = opciones.find(o => equivalentes.some(x => normalizar(o.value) === x || normalizar(o.textContent) === x));
    if (!opcion) return false;
    campo.value = opcion.value;
    return true;
  }
  function asignar(campo, valor) {
    if (campo instanceof HTMLSelectElement) return seleccionarOpcion(campo, valor);
    const tipo = campo.type?.toLowerCase();
    if (tipo === "date") {
      valor = fechaISO(valor);
      if (!valor) return false;
    }
    const prototipo = campo instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototipo, "value")?.set;
    if (setter) setter.call(campo, valor); else campo.value = valor;
    return campo.value === valor;
  }
  let cantidad = 0;
  for (const campo of document.querySelectorAll("input, textarea, select")) {
    if (campo.disabled || campo.readOnly || campo.getClientRects().length === 0) continue;
    if (String(campo.value ?? "").trim() !== "") continue;
    if (campo instanceof HTMLInputElement && ["hidden", "password", "file", "checkbox", "radio", "submit", "button", "reset", "color", "number"].includes(campo.type.toLowerCase())) continue;
    const clave = detectar(campo);
    let valor = "";
    if (clave === "nombreCompleto") {
      if (seleccionados.includes("nombre") && seleccionados.includes("apellido")) valor = [valorPerfil("nombre"), valorPerfil("apellido")].filter(Boolean).join(" ");
    } else if (clave && seleccionados.includes(clave)) {
      valor = valorPerfil(clave);
    }
    if (!valor) continue;
    if (asignar(campo, valor)) {
      campo.dispatchEvent(new Event("input", { bubbles: true }));
      campo.dispatchEvent(new Event("change", { bubbles: true }));
      cantidad++;
    }
  }
  return cantidad;
};
