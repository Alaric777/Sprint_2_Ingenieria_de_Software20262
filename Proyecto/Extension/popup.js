const campos = [
  "nombre", "apellido", "fechaNacimiento", "ciudadNacimiento",
  "tipoDocumento", "numeroDocumento", "correo", "telefono",
  "ciudadResidencia", "universidad", "carrera",
  "fechaInicioEstudios", "fechaFinEstudios"
];

const API = "http://localhost:8000/api/perfiles";
const mensaje = document.getElementById("mensaje");

// La API usa snake_case, mientras que los identificadores HTML usan camelCase.
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
    document.getElementById(campo).value = perfil?.[campo] ?? "";
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

  const obligatorios = campos.filter(campo => campo !== "fechaFinEstudios");
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
    mensaje.textContent = id ? "Perfil actualizado correctamente." : "Perfil creado correctamente.";
  } catch (error) {
    console.error("Guardado de perfil:", error);
    mensaje.textContent = `No se pudo guardar el perfil: ${error.message}`;
  } finally {
    boton.disabled = false;
  }
});

document.getElementById("autocompletar").addEventListener("click", async () => {
  const seleccionados = Array.from(
    document.querySelectorAll('#seleccion input:checked')
  ).map(checkbox => checkbox.value);
  if (!seleccionados.length) {
    mensaje.textContent = "Selecciona al menos un dato.";
    return;
  }
  try {
    const { perfil: perfilGuardado } = await chrome.storage.local.get("perfil");
    if (!perfilGuardado) {
      mensaje.textContent = "Primero debes guardar un perfil.";
      return;
    }
    const perfil = desdeApi(perfilGuardado);
    const resumen = seleccionados.filter(campo => perfil[campo])
      .map(campo => `${campo}: ${perfil[campo]}`).join("\n");
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
      target: { tabId: pestana.id }, files: ["content.js"]
    });
    const respuesta = await chrome.scripting.executeScript({
      target: { tabId: pestana.id },
      func: (datos, seleccion) => window.autocompletarPerfil(datos, seleccion),
      args: [perfil, seleccionados]
    });
    const cantidad = respuesta[0]?.result ?? 0;
    mensaje.textContent = `${cantidad} campo(s) autocompletado(s).`;
  } catch (error) {
    mensaje.textContent = "No se pudo autocompletar esta página.";
    console.error(error);
  }
});
