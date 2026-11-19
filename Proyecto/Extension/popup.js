const campos = [
  "nombre", "apellido", "fechaNacimiento", "ciudadNacimiento",
  "tipoDocumento", "numeroDocumento", "correo", "telefono",
  "ciudadResidencia", "universidad", "carrera",
  "fechaInicioEstudios", "fechaFinEstudios"
];

const camposExperiencia = [
  "empresa",
  "cargo",
  "descripcionExperiencia",
  "fechaInicioExperiencia",
  "fechaFinExperiencia"
];

const API = "http://localhost:8000/api/perfiles";
const mensaje = document.getElementById("mensaje");

function asegurarElementos() {
  if (!document.getElementById("eliminarPerfil")) {
    const boton = document.createElement("button");
    boton.id = "eliminarPerfil";
    boton.type = "button";
    boton.textContent = "Eliminar perfil";
    document.body.append(boton);
  }

  if (!document.getElementById("administrarCampos")) {
    const seccion = document.createElement("section");
    seccion.innerHTML = `
      <h3>Administrar información del perfil</h3>
      <div id="administrarCampos"></div>
      <button id="ocultarDatos" type="button">Ocultar datos</button>
      <button id="recuperarDatos" type="button">Recuperar datos</button>
    `;
    document.body.append(seccion);
  }
}

asegurarElementos();

const campoApi = {
  nombre: "nombre",
  apellido: "apellido",
  fechaNacimiento: "fecha_nacimiento",
  ciudadNacimiento: "ciudad_nacimiento",
  tipoDocumento: "tipo_documento",
  numeroDocumento: "numero_documento",
  correo: "correo",
  telefono: "telefono",
  ciudadResidencia: "ubicacion_ciudad",
  universidad: "universidad",
  carrera: "carrera",
  fechaInicioEstudios: "fecha_inicio_estudio",
  fechaFinEstudios: "fecha_fin_estudio"
};

function desdeApi(datos) {
  const perfil = { id: datos.id };
  for (const campo of campos) {
    perfil[campo] = datos[campoApi[campo]] ?? datos[campo] ?? "";
  }
  return perfil;
}

function haciaApi(perfil) {
  const resultado = {};
  for (const campo of campos) {
    resultado[campoApi[campo]] = perfil[campo];
  }
  resultado.fecha_fin_estudio = resultado.fecha_fin_estudio || null;
  return resultado;
}

function mostrarPerfil(perfil) {
  for (const campo of campos) {
    const input = document.getElementById(campo);
    if (input) input.value = perfil?.[campo] ?? "";
  }
}

async function cargarPerfil() {
  try {
    const { perfil: perfilLocal } = await chrome.storage.local.get("perfil");
    if (!perfilLocal) return;
    mostrarPerfil(desdeApi(perfilLocal));
    if (!perfilLocal.id) return;

    try {
      const respuesta = await fetch(`${API}/${perfilLocal.id}`);

      if (respuesta.status === 404) {
        await chrome.storage.local.remove("perfil");
        mostrarPerfil(null);
        mensaje.textContent = "Tu perfil ya no existe en el servidor. Puedes crear uno nuevo.";
        return;
      }

      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const perfil = desdeApi(await respuesta.json());
      mostrarPerfil(perfil);
      await chrome.storage.local.set({ perfil });
    } catch (error) {
      mensaje.textContent = "No se pudo consultar Rocket. Mostrando copia local.";
      console.error("Consulta del perfil:", error);
    }
  } catch (error) {
    mensaje.textContent = "No se pudo cargar el perfil.";
    console.error(error);
  }
}

void cargarPerfil();

document.getElementById("guardar").addEventListener("click", async () => {
  const boton = document.getElementById("guardar");
  const perfil = {};
  for (const campo of campos) {
    perfil[campo] = document.getElementById(campo).value.trim();
  }

  const { perfil: perfilAnterior } = await chrome.storage.local.get("perfil");

  let ocultos = [];

  if (perfilAnterior?.id) {
    try {
      const respuesta = await fetch(`${API}/${perfilAnterior.id}/campos-ocultos`);

      if (respuesta.status === 404) {
        await chrome.storage.local.remove("perfil");
      } else if (!respuesta.ok) {
        throw new Error(`HTTP ${respuesta.status}`);
      } else {
        const datos = await respuesta.json();
        ocultos = datos.campos || [];
      }
    } catch (error) {
      mensaje.textContent = "No se pudo verificar qué campos están ocultos.";
      console.error(error);
      return;
    }
  }

  const obligatorios = campos.filter(campo =>
    campo !== "fechaFinEstudios" &&
    !ocultos.includes(campoApi[campo])
  );

  const faltantes = obligatorios.filter(campo => !perfil[campo]);

  if (faltantes.length) {
    mensaje.textContent = `Completa los campos obligatorios: ${faltantes.join(", ")}.`;
    return;
  }

  if (perfil.fechaFinEstudios && perfil.fechaFinEstudios < perfil.fechaInicioEstudios) {
    mensaje.textContent = "La fecha de finalización no puede ser anterior al inicio de estudios.";
    return;
  }

  boton.disabled = true;
  mensaje.textContent = "Guardando perfil...";
  try {
    const { perfil: perfilLocal } = await chrome.storage.local.get("perfil");
    const id = perfilLocal?.id;
    const respuesta = await fetch(id ? `${API}/${id}` : API, {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(haciaApi(perfil))
    });
    if (!respuesta.ok) {
      const detalle = (await respuesta.text()).slice(0, 200);
      throw new Error(`HTTP ${respuesta.status}: ${detalle}`);
    }
    const perfilGuardado = desdeApi(await respuesta.json());
    await chrome.storage.local.set({ perfil: perfilGuardado });
    mostrarPerfil(perfilGuardado);
    void refrescarListas();
    mensaje.textContent = id ? "Perfil actualizado correctamente." : "Perfil creado correctamente.";
  } catch (error) {
    console.error("Guardado de perfil:", error);
    mensaje.textContent = `No se pudo guardar el perfil: ${error.message}`;
  } finally {
    boton.disabled = false;
  }
});

document.getElementById("eliminarPerfil").addEventListener("click", async () => {
  const boton = document.getElementById("eliminarPerfil");
  const { perfil } = await chrome.storage.local.get("perfil");

  if (!perfil?.id) {
    mensaje.textContent = "No hay un perfil guardado para eliminar.";
    return;
  }

  if (!confirm("¿Seguro que deseas eliminar tu perfil? Esta acción no se puede deshacer desde la extensión.")) {
    return;
  }

  boton.disabled = true;
  mensaje.textContent = "Eliminando perfil...";

  try {
    const respuesta = await fetch(`${API}/${perfil.id}`, { method: "DELETE" });

    if (!respuesta.ok && respuesta.status !== 404) {
      throw new Error(`HTTP ${respuesta.status}`);
    }

    await chrome.storage.local.remove("perfil");
    mostrarPerfil(null);
    administrarCampos.querySelectorAll("input").forEach(c => {
      c.checked = false;
    });
    void refrescarListas();
    mensaje.textContent = "Perfil eliminado correctamente.";
  } catch (error) {
    console.error("Eliminación de perfil:", error);
    mensaje.textContent = `No se pudo eliminar el perfil: ${error.message}`;
  } finally {
    boton.disabled = false;
  }
});

document.getElementById("autocompletar").addEventListener("click", async () => {
  const seleccionados = Array.from(
    document.querySelectorAll("#seleccion input:checked")
  ).map(checkbox => checkbox.value);

  if (!seleccionados.length) {
    mensaje.textContent = "Selecciona al menos un dato.";
    return;
  }

  try {
    const { perfil: perfilGuardado } = await chrome.storage.local.get("perfil");

    if (!perfilGuardado?.id) {
      mensaje.textContent = "Primero debes guardar un perfil.";
      return;
    }

    const respuestaPerfil = await fetch(`${API}/${perfilGuardado.id}`);

    if (!respuestaPerfil.ok) {
      throw new Error(`HTTP ${respuestaPerfil.status}`);
    }

    const perfil = desdeApi(await respuestaPerfil.json());

    await chrome.storage.local.set({ perfil });

    Object.assign(
      perfil,
      await datosExperiencia(perfilGuardado.id, seleccionados),
      await datosHabilidades(perfilGuardado.id, seleccionados)
    );

    const resumen = seleccionados
      .filter(campo => perfil[campo])
      .map(campo => `${campo}: ${perfil[campo]}`)
      .join("\n");

    if (!resumen) {
      mensaje.textContent = "No hay datos guardados para los campos seleccionados.";
      return;
    }

    if (!confirm(`Se utilizarán estos datos:\n\n${resumen}\n\n¿Deseas autocompletar el formulario?`)) {
      mensaje.textContent = "Autocompletado cancelado.";
      return;
    }

    const [pestana] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!pestana?.id) throw new Error("No hay pestaña activa.");

    await chrome.scripting.executeScript({
      target: { tabId: pestana.id, allFrames: true },
      files: ["content.js"]
    });

    const respuesta = await chrome.scripting.executeScript({
      target: { tabId: pestana.id, allFrames: true },
      func: (datos, seleccion) => window.autocompletarPerfil?.(datos, seleccion) ?? 0,
      args: [perfil, seleccionados]
    });

    const cantidad = respuesta.reduce((total, r) => total + (r.result ?? 0), 0);
    mensaje.textContent = `${cantidad} campo(s) autocompletado(s).`;
  } catch (error) {
    mensaje.textContent = "No se pudo autocompletar esta página.";
    console.error(error);
  }
});

const administrarCampos = document.getElementById("administrarCampos");

for (const campo of campos) {
  const etiqueta = document.createElement("label");
  const casilla = document.createElement("input");
  casilla.type = "checkbox";
  casilla.value = campo;
  etiqueta.append(casilla, " " + campo);
  administrarCampos.append(etiqueta, document.createElement("br"));
}

function camposAdministrados() {
  return [...administrarCampos.querySelectorAll("input:checked")]
    .map(c => campoApi[c.value]);
}

async function administrarDatos(accion) {
  const seleccionados = camposAdministrados();

  if (!seleccionados.length) {
    mensaje.textContent = "Selecciona al menos un campo.";
    return;
  }

  const { perfil } = await chrome.storage.local.get("perfil");

  if (!perfil?.id) {
    mensaje.textContent = "Primero debes guardar un perfil.";
    return;
  }

  const verbo = accion === "ocultar" ? "ocultar" : "recuperar";

  if (!confirm(`¿Deseas ${verbo} estos campos?\n${seleccionados.join("\n")}`)) {
    return;
  }

  try {
    for (const campo of seleccionados) {
      const respuesta = await fetch(`${API}/${perfil.id}/${accion}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campo })
      });

      if (!respuesta.ok) {
        throw new Error(`HTTP ${respuesta.status}: ${campo}`);
      }
    }

    const respuesta = await fetch(`${API}/${perfil.id}`);
    if (!respuesta.ok) throw new Error("No se pudo actualizar el perfil.");

    const actualizado = desdeApi(await respuesta.json());

    await chrome.storage.local.set({ perfil: actualizado });
    mostrarPerfil(actualizado);

    administrarCampos.querySelectorAll("input").forEach(c => {
      c.checked = false;
    });

    mensaje.textContent = `Datos ${accion === "ocultar" ? "ocultados" : "recuperados"} correctamente.`;
  } catch (error) {
    console.error(error);
    mensaje.textContent = "Error al administrar los datos: " + error.message;
  }
}

document.getElementById("ocultarDatos").addEventListener("click", () => {
  administrarDatos("ocultar");
});

document.getElementById("recuperarDatos").addEventListener("click", () => {
  administrarDatos("recuperar");
});

const ERRORES_HTTP = {
  404: "no existe o ya fue eliminado",
  409: "ya existe un registro igual",
  422: "datos inválidos (revisa campos, fechas y longitudes)"
};
const JSON_HEADERS = { "Content-Type": "application/json" };

function el(tag, props = {}, ...hijos) {
  const nodo = document.createElement(tag);
  Object.assign(nodo, props);
  nodo.append(...hijos);
  return nodo;
}

async function idPerfil() {
  const { perfil } = await chrome.storage.local.get("perfil");
  return perfil?.id ?? null;
}

async function pedir(url, opciones) {
  const respuesta = await fetch(url, opciones);
  if (!respuesta.ok) {
    throw new Error(ERRORES_HTTP[respuesta.status] ?? `HTTP ${respuesta.status}`);
  }
  return respuesta.json();
}

function campoConRotulo(rotulo, control) {
  return el("div", {}, el("label", {}, rotulo + " ", control));
}

const selectorExperiencia = el("select");

function actualizarSelectorExperiencia(lista) {
  const anterior = selectorExperiencia.value;

  selectorExperiencia.replaceChildren(
    ...(lista.length
      ? lista.map(exp => el("option", {
          value: String(exp.id),
          textContent: `${exp.cargo} — ${exp.empresa}`
        }))
      : [el("option", { value: "", textContent: "Sin experiencias" })])
  );

  if (lista.some(exp => String(exp.id) === anterior)) {
    selectorExperiencia.value = anterior;
  }
}

async function datosExperiencia(id, seleccionados) {
  if (!seleccionados.some(campo => camposExperiencia.includes(campo))) return {};

  const lista = await pedir(`${API}/${id}/experiencias`);
  const exp = lista.find(e => String(e.id) === selectorExperiencia.value) ?? lista[0];
  if (!exp) return {};

  return {
    empresa: exp.empresa,
    cargo: exp.cargo,
    descripcionExperiencia: exp.descripcion,
    fechaInicioExperiencia: exp.fecha_inicio,
    fechaFinExperiencia: exp.fecha_fin ?? ""
  };
}

async function datosHabilidades(id, seleccionados) {
  if (!seleccionados.includes("habilidades")) return {};

  const lista = await pedir(`${API}/${id}/habilidades`);
  if (!lista.length) return {};

  return {
    habilidades: lista.map(hab => `${hab.nombre} (${hab.nivel})`).join(", ")
  };
}

const contenedorSeleccion = document.getElementById("seleccion");
if (contenedorSeleccion) {
  contenedorSeleccion.append(
    el("h4", { textContent: "Experiencia laboral" }),
    campoConRotulo("Experiencia a usar", selectorExperiencia),
    ...camposExperiencia.map(campo =>
      el("label", {}, el("input", { type: "checkbox", value: campo }), " " + campo, el("br"))
    ),
    el("h4", { textContent: "Habilidades" }),
    el("label", {}, el("input", { type: "checkbox", value: "habilidades" }), " habilidades", el("br"))
  );
}

let experienciaEditando = null;

const expCampos = {
  empresa: el("input", { type: "text", placeholder: "Empresa", maxLength: 100 }),
  cargo: el("input", { type: "text", placeholder: "Cargo", maxLength: 100 }),
  fecha_inicio: el("input", { type: "date" }),
  fecha_fin: el("input", { type: "date" }),
  descripcion: el("textarea", {
    placeholder: "Descripción de funciones y logros",
    rows: 3,
    maxLength: 600
  })
};
const expLista = el("ul");
const expGuardar = el("button", { type: "button", textContent: "Agregar experiencia" });
const expCancelar = el("button", { type: "button", textContent: "Cancelar edición", hidden: true });

function limpiarFormularioExperiencia() {
  for (const control of Object.values(expCampos)) control.value = "";
  experienciaEditando = null;
  expGuardar.textContent = "Agregar experiencia";
  expCancelar.hidden = true;
}

function renderExperiencias(lista) {
  actualizarSelectorExperiencia(lista);

  if (!lista.length) {
    expLista.replaceChildren(el("li", { textContent: "Sin experiencias registradas." }));
    return;
  }

  expLista.replaceChildren(...lista.map(exp => {
    const periodo = `${exp.fecha_inicio} – ${exp.fecha_fin ?? "actualidad"}`;

    const editar = el("button", { type: "button", textContent: "Editar" });
    editar.addEventListener("click", () => editarExperiencia(exp));

    const borrar = el("button", { type: "button", textContent: "Eliminar" });
    borrar.addEventListener("click", () => eliminarExperiencia(exp));

    return el("li", {},
      el("strong", { textContent: `${exp.cargo} — ${exp.empresa}` }), el("br"),
      el("small", { textContent: periodo }), el("br"),
      el("span", { textContent: exp.descripcion }), el("br"),
      editar, " ", borrar
    );
  }));
}

async function cargarExperiencias() {
  const id = await idPerfil();
  if (!id) {
    renderExperiencias([]);
    return;
  }

  try {
    renderExperiencias(await pedir(`${API}/${id}/experiencias`));
  } catch (error) {
    if (error.message === ERRORES_HTTP[404]) {
      renderExperiencias([]);
      return;
    }
    console.error("Carga de experiencias:", error);
    mensaje.textContent = "No se pudieron cargar las experiencias: " + error.message;
  }
}

function editarExperiencia(exp) {
  expCampos.empresa.value = exp.empresa;
  expCampos.cargo.value = exp.cargo;
  expCampos.fecha_inicio.value = exp.fecha_inicio;
  expCampos.fecha_fin.value = exp.fecha_fin ?? "";
  expCampos.descripcion.value = exp.descripcion;
  experienciaEditando = exp.id;
  expGuardar.textContent = "Actualizar experiencia";
  expCancelar.hidden = false;
  expCampos.empresa.focus();
}

async function guardarExperiencia() {
  const id = await idPerfil();
  if (!id) {
    mensaje.textContent = "Primero debes guardar un perfil.";
    return;
  }

  const datos = {};
  for (const [campo, control] of Object.entries(expCampos)) {
    datos[campo] = control.value.trim();
  }

  const faltantes = ["empresa", "cargo", "fecha_inicio", "descripcion"]
    .filter(campo => !datos[campo]);
  if (faltantes.length) {
    mensaje.textContent = `Completa los campos de la experiencia: ${faltantes.join(", ")}.`;
    return;
  }

  if (datos.fecha_fin && datos.fecha_fin < datos.fecha_inicio) {
    mensaje.textContent = "La fecha de fin no puede ser anterior a la de inicio.";
    return;
  }
  datos.fecha_fin = datos.fecha_fin || null;

  const editando = experienciaEditando;
  expGuardar.disabled = true;

  try {
    await pedir(
      editando ? `${API}/${id}/experiencias/${editando}` : `${API}/${id}/experiencias`,
      {
        method: editando ? "PUT" : "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(datos)
      }
    );
    limpiarFormularioExperiencia();
    await cargarExperiencias();
    mensaje.textContent = editando ? "Experiencia actualizada." : "Experiencia agregada.";
  } catch (error) {
    console.error("Guardado de experiencia:", error);
    mensaje.textContent = "No se pudo guardar la experiencia: " + error.message;
  } finally {
    expGuardar.disabled = false;
  }
}

async function eliminarExperiencia(exp) {
  const id = await idPerfil();
  if (!id) return;

  if (!confirm(`¿Eliminar la experiencia "${exp.cargo} — ${exp.empresa}"?`)) return;

  try {
    await pedir(`${API}/${id}/experiencias/${exp.id}`, { method: "DELETE" });
    if (experienciaEditando === exp.id) limpiarFormularioExperiencia();
    await cargarExperiencias();
    mensaje.textContent = "Experiencia eliminada.";
  } catch (error) {
    console.error("Eliminación de experiencia:", error);
    mensaje.textContent = "No se pudo eliminar la experiencia: " + error.message;
  }
}

expGuardar.addEventListener("click", guardarExperiencia);
expCancelar.addEventListener("click", limpiarFormularioExperiencia);

let habilidadEditando = null;

const habNombre = el("input", { type: "text", placeholder: "Habilidad (ej. SQL, Inglés)", maxLength: 100 });
const habNivel = el("input", { type: "text", placeholder: "Nivel (ej. Intermedio)", maxLength: 100 });
habNivel.setAttribute("list", "nivelesHabilidad");
const habNiveles = el(
  "datalist",
  { id: "nivelesHabilidad" },
  ...["Básico", "Intermedio", "Avanzado", "Experto"].map(valor => el("option", { value: valor }))
);
const habLista = el("ul");
const habGuardar = el("button", { type: "button", textContent: "Agregar habilidad" });
const habCancelar = el("button", { type: "button", textContent: "Cancelar edición", hidden: true });

function limpiarFormularioHabilidad() {
  habNombre.value = "";
  habNombre.disabled = false;
  habNivel.value = "";
  habilidadEditando = null;
  habGuardar.textContent = "Agregar habilidad";
  habCancelar.hidden = true;
}

function renderHabilidades(lista) {
  if (!lista.length) {
    habLista.replaceChildren(el("li", { textContent: "Sin habilidades registradas." }));
    return;
  }

  habLista.replaceChildren(...lista.map(hab => {
    const editar = el("button", { type: "button", textContent: "Cambiar nivel" });
    editar.addEventListener("click", () => editarHabilidad(hab));

    const borrar = el("button", { type: "button", textContent: "Eliminar" });
    borrar.addEventListener("click", () => eliminarHabilidad(hab));

    return el("li", {},
      el("strong", { textContent: hab.nombre }),
      ` — ${hab.nivel} `,
      editar, " ", borrar
    );
  }));
}

async function cargarHabilidades() {
  const id = await idPerfil();
  if (!id) {
    renderHabilidades([]);
    return;
  }

  try {
    renderHabilidades(await pedir(`${API}/${id}/habilidades`));
  } catch (error) {
    if (error.message === ERRORES_HTTP[404]) {
      renderHabilidades([]);
      return;
    }
    console.error("Carga de habilidades:", error);
    mensaje.textContent = "No se pudieron cargar las habilidades: " + error.message;
  }
}

function editarHabilidad(hab) {
  habNombre.value = hab.nombre;
  habNombre.disabled = true;
  habNivel.value = hab.nivel;
  habilidadEditando = hab.id;
  habGuardar.textContent = "Actualizar nivel";
  habCancelar.hidden = false;
  habNivel.focus();
}

async function guardarHabilidad() {
  const id = await idPerfil();
  if (!id) {
    mensaje.textContent = "Primero debes guardar un perfil.";
    return;
  }

  const nombre = habNombre.value.trim();
  const nivel = habNivel.value.trim();

  if (!nombre || !nivel) {
    mensaje.textContent = "Escribe la habilidad y su nivel.";
    return;
  }

  const editando = habilidadEditando;
  habGuardar.disabled = true;

  try {
    await pedir(
      editando ? `${API}/${id}/habilidades/${editando}` : `${API}/${id}/habilidades`,
      {
        method: editando ? "PUT" : "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(editando ? { nivel } : { nombre, nivel })
      }
    );
    limpiarFormularioHabilidad();
    await cargarHabilidades();
    mensaje.textContent = editando ? "Nivel actualizado." : "Habilidad agregada.";
  } catch (error) {
    console.error("Guardado de habilidad:", error);
    mensaje.textContent = error.message === ERRORES_HTTP[409]
      ? "Ya tienes registrada esa habilidad."
      : "No se pudo guardar la habilidad: " + error.message;
  } finally {
    habGuardar.disabled = false;
  }
}

async function eliminarHabilidad(hab) {
  const id = await idPerfil();
  if (!id) return;

  if (!confirm(`¿Eliminar la habilidad "${hab.nombre}"?`)) return;

  try {
    await pedir(`${API}/${id}/habilidades/${hab.id}`, { method: "DELETE" });
    if (habilidadEditando === hab.id) limpiarFormularioHabilidad();
    await cargarHabilidades();
    mensaje.textContent = "Habilidad eliminada.";
  } catch (error) {
    console.error("Eliminación de habilidad:", error);
    mensaje.textContent = "No se pudo eliminar la habilidad: " + error.message;
  }
}

habGuardar.addEventListener("click", guardarHabilidad);
habCancelar.addEventListener("click", limpiarFormularioHabilidad);

document.body.append(
  el("section", {},
    el("h3", { textContent: "Experiencia laboral" }),
    expLista,
    campoConRotulo("Empresa", expCampos.empresa),
    campoConRotulo("Cargo", expCampos.cargo),
    campoConRotulo("Inicio", expCampos.fecha_inicio),
    campoConRotulo("Fin (opcional)", expCampos.fecha_fin),
    campoConRotulo("Descripción", expCampos.descripcion),
    expGuardar, " ", expCancelar
  ),
  el("section", {},
    el("h3", { textContent: "Habilidades" }),
    habLista,
    campoConRotulo("Habilidad", habNombre),
    campoConRotulo("Nivel", habNivel),
    habNiveles,
    habGuardar, " ", habCancelar
  )
);

async function refrescarListas() {
  if (!(await idPerfil())) {
    limpiarFormularioExperiencia();
    limpiarFormularioHabilidad();
  }
  await Promise.all([cargarExperiencias(), cargarHabilidades()]);
}

void refrescarListas();
