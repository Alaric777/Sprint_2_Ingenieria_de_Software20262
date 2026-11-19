(() => {
  "use strict";

  // Sinónimos por campo del perfil (se normalizan: sin tildes, minúsculas, sin símbolos)
  const CAMPOS = {
    nombre: ["nombre", "nombres", "primer nombre", "nombre de pila", "first name", "given name", "given", "fname", "firstname", "name"],
    apellido: ["apellido", "apellidos", "apellidos completos", "primer apellido", "last name", "family name", "surname", "lname", "lastname"],
    fechaNacimiento: ["fecha de nacimiento", "fecha nacimiento", "fecha en que naciste", "nacimiento", "naciste", "birth date", "birthdate", "date of birth", "dob", "bday", "birthday", "cumpleanos"],
    ciudadNacimiento: ["ciudad de nacimiento", "lugar de nacimiento", "ciudad nacimiento", "lugar nacimiento", "lugar nac", "municipio de nacimiento", "birthplace", "place of birth", "city of birth"],
    tipoDocumento: ["tipo de documento", "tipo documento", "tipo de identificacion", "tipo identificacion", "tipo de id", "tipo id", "document type", "id type"],
    numeroDocumento: ["numero de documento", "numero documento", "numero de identificacion", "no de identificacion", "documento de identidad", "documento", "identificacion", "cedula", "cc", "dni", "id number", "document number", "identification number"],
    correo: ["correo", "correo electronico", "direccion de correo", "email", "e mail", "mail", "email address"],
    telefono: ["telefono", "numero de telefono", "numero telefonico", "telefono de contacto", "celular", "movil", "cel", "tel", "whatsapp", "phone", "phone number", "mobile"],
    ciudadResidencia: ["ciudad de residencia", "ciudad donde vives", "donde vives", "lugar de residencia", "ciudad actual", "current city", "residencia", "ubicacion", "municipio", "ciudad", "city", "location", "town"],
    universidad: ["universidad", "nombre de la universidad", "institucion", "institucion educativa", "centro educativo", "plantel", "university", "school", "college", "institution", "alma mater"],
    carrera: ["carrera", "programa academico", "programa","Título","título", "grado academico","Campo de estudio","campo de estudio", ,"profesion", "especialidad", "major", "degree", "field of study", "career"],
    fechaInicioEstudios: ["fecha de inicio de estudios", "fecha de inicio", "fecha inicio", "inicio de estudios", "fecha de ingreso", "desde", "inicio", "ingreso", "comienzo", "start date"],
    fechaFinEstudios: ["fecha de finalizacion", "fecha de fin", "fecha fin", "fecha final", "fin de estudios", "fecha de grado", "fecha de terminacion", "finalizacion", "terminacion", "graduacion", "hasta", "fin", "end date"],
    empresa: ["empresa", "nombre de la empresa", "empresa donde trabajaste", "empresa actual", "ultima empresa", "lugar de trabajo", "empleador", "compania", "organizacion", "company", "company name", "employer", "organization"],
    cargo: ["cargo", "cargo desempenado", "puesto", "puesto de trabajo", "titulo del cargo", "ocupacion", "rol", "job title", "position", "role"],
    descripcionExperiencia: ["funciones", "funciones desempenadas", "descripcion de funciones", "funciones y logros", "responsabilidades", "logros", "descripcion del cargo", "descripcion de la experiencia", "descripcion de tu experiencia", "experiencia laboral", "descripcion", "job description", "responsibilities"],
    fechaInicioExperiencia: ["fecha de inicio laboral", "inicio laboral", "fecha de inicio del cargo", "inicio del cargo", "fecha inicio experiencia", "fecha de ingreso", "fecha de inicio", "fecha inicio", "desde", "inicio", "start date"],
    fechaFinExperiencia: ["fecha de fin laboral", "fin laboral", "fecha de retiro", "fecha de salida", "fin del cargo", "fecha fin experiencia", "fecha de finalizacion", "fecha de fin", "fecha fin", "fecha final", "hasta", "fin", "end date"],
    habilidades: ["habilidades", "habilidad", "competencias", "aptitudes", "destrezas","Idioma","idioma", "conocimientos", "tecnologias", "herramientas", "idiomas", "habilidades tecnicas", "habilidades blandas", "skills", "skill", "competencies", "abilities", "technologies", "tools", "hard skills", "soft skills"]
  };

  const FECHAS_ACADEMICAS = new Set(["fechaInicioEstudios", "fechaFinEstudios"]);
  const FECHAS_LABORALES = new Set(["fechaInicioExperiencia", "fechaFinExperiencia"]);
  const FECHAS = new Set(["fechaNacimiento", ...FECHAS_ACADEMICAS, ...FECHAS_LABORALES]);

  const CONTEXTO_LABORAL = /\b(trabajo|laboral|empleo|empresa|cargo|puesto|experiencia|empleador|work|job|employment|company)\b/;
  const CONTEXTO_ACADEMICO = /\b(estudio|estudios|academico|academica|universidad|carrera|grado|educacion|school|study|education|university)\b/;

  const ALIAS_OPCION = {
    cc: ["cedula de ciudadania", "cedula"],
    ti: ["tarjeta de identidad"],
    ce: ["cedula de extranjeria"],
    pasaporte: ["passport"],
    passport: ["pasaporte"]
  };

  const BLOQUEO = /\b(contrasena|password|cvv|cvc|salario|sueldo|salary|comentario|comment|observacion|mensaje|message|username|nombre de usuario|buscar|search|captcha|tarjeta de credito|numero de tarjeta|card number|codigo postal|zip)\b/;

  const TIPOS_EXCLUIDOS = new Set([
    "hidden", "password", "checkbox", "radio", "file", "submit",
    "button", "reset", "image", "range", "color"
  ]);

  const norm = (s) => {
    const limpio = String(s ?? "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    return ` ${limpio} `;
  };

  const SINONIMOS = Object.fromEntries(
    Object.entries(CAMPOS).map(([campo, lista]) => [
      campo,
      lista.map((s) => norm(s).trim()).filter(Boolean)
    ])
  );

  function mejorCoincidencia(texto, sinonimos) {
    let mejor = 0;
    for (const s of sinonimos) {
      if (texto.includes(` ${s} `)) mejor = Math.max(mejor, s.split(" ").length);
    }
    return mejor;
  }

  function textoLabel(label) {
    const copia = label.cloneNode(true);
    copia.querySelectorAll("input, select, textarea").forEach((n) => n.remove());
    return copia.textContent;
  }

  function textoContenedor(el) {
    let nodo = el.parentElement;
    for (let i = 0; i < 6 && nodo; i++, nodo = nodo.parentElement) {
      const entradas = nodo.querySelectorAll("input:not([type=hidden]), select, textarea");
      if (entradas.length > 1) break;
      const titulo = nodo.querySelector("label, legend, [role=heading], h1, h2, h3, h4, h5, h6");
      if (titulo && !titulo.contains(el)) return titulo.textContent;
    }
    return "";
  }

  function descriptores(el) {
    const etiquetas = [];
    for (const l of el.labels || []) etiquetas.push(textoLabel(l));

    const raiz = el.getRootNode();
    const ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const nodo = (raiz.getElementById ? raiz.getElementById(id) : null) || document.getElementById(id);
      if (nodo) etiquetas.push(nodo.textContent);
    }
    if (el.getAttribute("aria-label")) etiquetas.push(el.getAttribute("aria-label"));

    return {
      etiqueta: norm(etiquetas.join(" ")),
      pista: norm([el.placeholder, el.getAttribute("autocomplete"), el.title].join(" ")),
      nombre: norm([el.name, el.id].join(" ")),
      contexto: norm(textoContenedor(el))
    };
  }

  function mejorCampo(el, campos) {
    const d = descriptores(el);
    if (BLOQUEO.test(d.etiqueta + d.pista + d.nombre)) return null;

    const textoTotal = d.etiqueta + d.pista + d.nombre + d.contexto;

    const puntos = campos.map((campo) => {
      const s = SINONIMOS[campo];
      let p =
        3 * mejorCoincidencia(d.etiqueta, s) +
        2 * mejorCoincidencia(d.pista, s) +
        2 * mejorCoincidencia(d.nombre, s) +
        1 * mejorCoincidencia(d.contexto, s);
      if (campo === "correo" && el.type === "email") p += 3;
      if (campo === "telefono" && el.type === "tel") p += 3;

      // Si dice "empresa", "universidad" o "habilidad", evitar que lo gane el campo "nombre"
      if (campo === "nombre" && /\b(empresa|company|empleador|universidad|institucion|habilidad|habilidades|skill|skills)\b/.test(textoTotal)) {
        p = 0;
      }

      // Desempatar fechas de estudio vs experiencia laboral si ambas están seleccionadas
      if (p > 0 && FECHAS_LABORALES.has(campo)) {
        if (CONTEXTO_LABORAL.test(textoTotal)) p += 2;
        if (CONTEXTO_ACADEMICO.test(textoTotal)) p -= 2;
      }
      if (p > 0 && FECHAS_ACADEMICAS.has(campo)) {
        if (CONTEXTO_ACADEMICO.test(textoTotal)) p += 2;
        if (CONTEXTO_LABORAL.test(textoTotal)) p -= 2;
      }

      return [campo, p];
    }).sort((a, b) => b[1] - a[1]);

    const [campo, p1] = puntos[0];
    const p2 = puntos[1]?.[1] ?? 0;
    if (p1 < 2) return null;   // evidencia insuficiente
    if (p1 === p2) return null; // ambiguo: mejor no llenar
    return campo;
  }

  function elegible(el) {
    if (el.disabled || el.readOnly) return false;
    if (el instanceof HTMLInputElement && TIPOS_EXCLUIDOS.has(el.type)) return false;
    return el.getClientRects().length > 0; // visible
  }

  function recolectar(raiz, salida = []) {
    raiz.querySelectorAll("input, select, textarea").forEach((e) => salida.push(e));
    raiz.querySelectorAll("*").forEach((n) => {
      if (n.shadowRoot) recolectar(n.shadowRoot, salida);
    });
    return salida;
  }

  function valorPara(el, campo, valor) {
    if (FECHAS.has(campo) && /^\d{4}-\d{2}-\d{2}$/.test(valor) && el.type !== "date") {
      const [a, m, d] = valor.split("-");
      const ph = (el.placeholder || "").toLowerCase();
      if (/dd\/mm\/(yyyy|aaaa)/.test(ph)) return `${d}/${m}/${a}`;
      if (/mm\/dd\/(yyyy|aaaa)/.test(ph)) return `${m}/${d}/${a}`;
    }
    return valor;
  }

  function asignar(el, valor) {
    const proto =
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype :
      el instanceof HTMLSelectElement ? HTMLSelectElement.prototype :
      HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

    el.focus();
    if (setter) setter.call(el, valor); else el.value = valor;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: valor }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    el.blur();
  }

  function elegirOpcion(select, valor) {
    const objetivos = [norm(valor)];
    for (const alias of ALIAS_OPCION[norm(valor).trim()] || []) objetivos.push(norm(alias));

    for (const opcion of select.options) {
      if (!opcion.value && !opcion.text.trim()) continue;
      const texto = norm(opcion.text);
      const valorOpcion = norm(opcion.value);
      if (objetivos.some((t) => texto.includes(t) || valorOpcion.includes(t))) {
        asignar(select, opcion.value);
        return true;
      }
    }
    return false;
  }

  window.autocompletarPerfil = (perfil, seleccion) => {
    const campos = (seleccion || []).filter((c) => SINONIMOS[c] && perfil?.[c]);
    if (!campos.length) return 0;

    let cantidad = 0;
    for (const el of recolectar(document)) {
      if (!elegible(el)) continue;
      const campo = mejorCampo(el, campos);
      if (!campo) continue;

      const valor = valorPara(el, campo, String(perfil[campo]));
      if (el instanceof HTMLSelectElement) {
        if (elegirOpcion(el, valor)) cantidad++;
      } else {
        asignar(el, valor);
        cantidad++;
      }
    }
    return cantidad;
  };
})();