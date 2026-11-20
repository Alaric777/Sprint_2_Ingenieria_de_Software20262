#[macro_use]
extern crate rocket;

use rocket::http::Status;
use rocket::serde::{json::Json, Deserialize, Serialize};
use rocket::State;
use sqlx::postgres::PgPoolOptions;
use sqlx::{FromRow, PgConnection, PgPool};

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(crate = "rocket::serde")]
struct Perfil {
    id: i32,
    nombre: String,
    apellido: String,
    fecha_nacimiento: String,
    ciudad_nacimiento: String,
    tipo_documento: String,
    numero_documento: String,
    correo: String,
    telefono: String,
    ubicacion_ciudad: String,
    universidad: String,
    carrera: String,
    fecha_inicio_estudio: Option<String>,
    fecha_fin_estudio: Option<String>,
}


#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct NuevoPerfil {
    nombre: String,
    apellido: String,
    fecha_nacimiento: String,
    ciudad_nacimiento: String,
    tipo_documento: String,
    numero_documento: String,
    correo: String,
    telefono: String,
    ubicacion_ciudad: String,
    universidad: String,
    carrera: String,
    fecha_inicio_estudio: String,
    fecha_fin_estudio: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(crate = "rocket::serde")]
struct CampoSolicitud {
    campo: String,
}

#[derive(Debug, Serialize)]
#[serde(crate = "rocket::serde")]
struct CamposOcultosRespuesta {
    campos: Vec<String>,
}

fn campo_valido(campo: &str) -> bool {
    matches!(
        campo,
        "nombre"
            | "apellido"
            | "fecha_nacimiento"
            | "ciudad_nacimiento"
            | "tipo_documento"
            | "numero_documento"
            | "correo"
            | "telefono"
            | "ubicacion_ciudad"
            | "universidad"
            | "carrera"
            | "fecha_inicio_estudio"
            | "fecha_fin_estudio"
    )
}
const SELECT_PERFIL: &str = "
    SELECT u.Id_Usuario AS id,

           CASE WHEN 'nombre' = ANY(COALESCE(o.campos, ARRAY[]::text[]))
                THEN '' ELSE u.Nombres END AS nombre,

           CASE WHEN 'apellido' = ANY(COALESCE(o.campos, ARRAY[]::text[]))
                THEN '' ELSE u.Apellidos END AS apellido,

           CASE WHEN 'fecha_nacimiento' = ANY(COALESCE(o.campos, ARRAY[]::text[]))
                THEN '' ELSE to_char(u.Fecha_Nacimiento, 'YYYY-MM-DD') END AS fecha_nacimiento,

           CASE WHEN 'ciudad_nacimiento' = ANY(COALESCE(o.campos, ARRAY[]::text[]))
                THEN '' ELSE u.Ciudad_Nacimiento END AS ciudad_nacimiento,

           CASE WHEN 'tipo_documento' = ANY(COALESCE(o.campos, ARRAY[]::text[]))
                THEN '' ELSE u.Tipo_Documento END AS tipo_documento,

           CASE WHEN 'numero_documento' = ANY(COALESCE(o.campos, ARRAY[]::text[]))
                THEN '' ELSE u.Numero_Documento END AS numero_documento,

           CASE WHEN 'correo' = ANY(COALESCE(o.campos, ARRAY[]::text[]))
                THEN '' ELSE u.Correo_Electronico END AS correo,

           CASE WHEN 'telefono' = ANY(COALESCE(o.campos, ARRAY[]::text[]))
                THEN '' ELSE u.Numero_Telefonico END AS telefono,

           CASE WHEN 'ubicacion_ciudad' = ANY(COALESCE(o.campos, ARRAY[]::text[]))
                THEN '' ELSE u.Ubicacion_Ciudad END AS ubicacion_ciudad,

           CASE WHEN 'universidad' = ANY(COALESCE(o.campos, ARRAY[]::text[]))
                THEN '' ELSE COALESCE(a.Institucion, '') END AS universidad,

           CASE WHEN 'carrera' = ANY(COALESCE(o.campos, ARRAY[]::text[]))
                THEN '' ELSE COALESCE(a.Grado_Academico, '') END AS carrera,

           CASE WHEN 'fecha_inicio_estudio' = ANY(COALESCE(o.campos, ARRAY[]::text[]))
                THEN '' ELSE to_char(a.Fecha_Inical, 'YYYY-MM-DD') END AS fecha_inicio_estudio,

           CASE WHEN 'fecha_fin_estudio' = ANY(COALESCE(o.campos, ARRAY[]::text[]))
                THEN '' ELSE to_char(a.Fecha_Final, 'YYYY-MM-DD') END AS fecha_fin_estudio

    FROM Usuario u

    LEFT JOIN LATERAL (
        SELECT Institucion, Grado_Academico, Fecha_Inical, Fecha_Final
        FROM InformacionAcademica
        WHERE Id_Usuario = u.Id_Usuario
          AND Fecha_Eliminacion_Academic IS NULL
        ORDER BY Id_infoAcademica DESC
        LIMIT 1
    ) a ON TRUE

    LEFT JOIN LATERAL (
        SELECT array_agg(Campo)::text[] AS campos
        FROM CamposOcultos
        WHERE Id_Usuario = u.Id_Usuario
    ) o ON TRUE

    WHERE u.fecha_eliminacion IS NULL";

fn error_bd(e: sqlx::Error) -> Status {
    eprintln!("Error de base de datos: {e}");
    if let sqlx::Error::Database(db) = &e {
        match db.code().as_deref() {

            Some("23505") => return Status::Conflict,

            Some("23502") | Some("23514") | Some("22001") | Some("22007") | Some("22008") => {
                return Status::UnprocessableEntity
            }
            _ => {}
        }
    }
    Status::InternalServerError
}

async fn buscar_perfil(pool: &PgPool, id: i32) -> Result<Option<Perfil>, sqlx::Error> {
    let consulta = format!("{SELECT_PERFIL} AND u.Id_Usuario = $1");
    sqlx::query_as::<_, Perfil>(&consulta)
        .bind(id)
        .fetch_optional(pool)
        .await
}


#[get("/")]
fn inicio() -> &'static str {
    "Backend de hojas de vida funcionando!"
}


#[get("/perfiles")]
async fn obtener_perfiles(pool: &State<PgPool>) -> Result<Json<Vec<Perfil>>, Status> {
    let consulta = format!("{SELECT_PERFIL} ORDER BY u.Id_Usuario");
    let perfiles = sqlx::query_as::<_, Perfil>(&consulta)
        .fetch_all(pool.inner())
        .await
        .map_err(error_bd)?;
    Ok(Json(perfiles))
}

#[get("/perfiles/<id>")]
async fn obtener_perfil(id: i32, pool: &State<PgPool>) -> Result<Json<Perfil>, Status> {
    buscar_perfil(pool.inner(), id)
        .await
        .map_err(error_bd)?
        .map(Json)
        .ok_or(Status::NotFound)
}


#[post("/perfiles", format = "json", data = "<nuevo>")]
async fn crear_perfil(
    nuevo: Json<NuevoPerfil>,
    pool: &State<PgPool>,
) -> Result<Json<Perfil>, Status> {
    let mut tx = pool.begin().await.map_err(error_bd)?;

    let correo = nuevo.correo.trim().to_lowercase();

    let id: i32 = sqlx::query_scalar(
        "INSERT INTO Usuario
            (Nombres, Apellidos, Fecha_Nacimiento, Ciudad_Nacimiento,
             Tipo_Documento, Numero_Documento, Correo_Electronico,
             Numero_Telefonico, Ubicacion_Ciudad)
         VALUES ($1, $2, $3::text::date, $4, $5, $6, $7, $8, $9)
         RETURNING Id_Usuario",
    )
    .bind(&nuevo.nombre)
    .bind(&nuevo.apellido)
    .bind(&nuevo.fecha_nacimiento)
    .bind(&nuevo.ciudad_nacimiento)
    .bind(&nuevo.tipo_documento)
    .bind(&nuevo.numero_documento)
    .bind(&correo)
    .bind(&nuevo.telefono)
    .bind(&nuevo.ubicacion_ciudad)
    .fetch_one(&mut *tx)
    .await
    .map_err(error_bd)?;

    sqlx::query(
        "INSERT INTO InformacionAcademica
            (Id_Usuario, Institucion, Grado_Academico, Fecha_Inical, Fecha_Final)
         VALUES ($1, $2, $3, $4::text::date, $5::text::date)",
    )
    .bind(id)
    .bind(&nuevo.universidad)
    .bind(&nuevo.carrera)
    .bind(&nuevo.fecha_inicio_estudio)
    .bind(&nuevo.fecha_fin_estudio)
    .execute(&mut *tx)
    .await
    .map_err(error_bd)?;

    tx.commit().await.map_err(error_bd)?;

    buscar_perfil(pool.inner(), id)
        .await
        .map_err(error_bd)?
        .map(Json)
        .ok_or(Status::InternalServerError)
}


#[put("/perfiles/<id>", format = "json", data = "<actualizado>")]
async fn actualizar_perfil(
    id: i32,
    actualizado: Json<NuevoPerfil>,
    pool: &State<PgPool>,
) -> Result<Json<Perfil>, Status> {
    let mut tx = pool.begin().await.map_err(error_bd)?;

    let correo = actualizado.correo.trim().to_lowercase();

    let filas = sqlx::query(
    "UPDATE Usuario
     SET
         Nombres = CASE WHEN EXISTS
             (SELECT 1 FROM CamposOcultos WHERE Id_Usuario = $1 AND Campo = 'nombre')
             THEN Nombres ELSE $2 END,

         Apellidos = CASE WHEN EXISTS
             (SELECT 1 FROM CamposOcultos WHERE Id_Usuario = $1 AND Campo = 'apellido')
             THEN Apellidos ELSE $3 END,

         Fecha_Nacimiento = CASE WHEN EXISTS
             (SELECT 1 FROM CamposOcultos WHERE Id_Usuario = $1 AND Campo = 'fecha_nacimiento')
             THEN Fecha_Nacimiento ELSE $4::text::date END,

         Ciudad_Nacimiento = CASE WHEN EXISTS
             (SELECT 1 FROM CamposOcultos WHERE Id_Usuario = $1 AND Campo = 'ciudad_nacimiento')
             THEN Ciudad_Nacimiento ELSE $5 END,

         Tipo_Documento = CASE WHEN EXISTS
             (SELECT 1 FROM CamposOcultos WHERE Id_Usuario = $1 AND Campo = 'tipo_documento')
             THEN Tipo_Documento ELSE $6 END,

         Numero_Documento = CASE WHEN EXISTS
             (SELECT 1 FROM CamposOcultos WHERE Id_Usuario = $1 AND Campo = 'numero_documento')
             THEN Numero_Documento ELSE $7 END,

         Correo_Electronico = CASE WHEN EXISTS
             (SELECT 1 FROM CamposOcultos WHERE Id_Usuario = $1 AND Campo = 'correo')
             THEN Correo_Electronico ELSE $8 END,

         Numero_Telefonico = CASE WHEN EXISTS
             (SELECT 1 FROM CamposOcultos WHERE Id_Usuario = $1 AND Campo = 'telefono')
             THEN Numero_Telefonico ELSE $9 END,

         Ubicacion_Ciudad = CASE WHEN EXISTS
             (SELECT 1 FROM CamposOcultos WHERE Id_Usuario = $1 AND Campo = 'ubicacion_ciudad')
             THEN Ubicacion_Ciudad ELSE $10 END

     WHERE Id_Usuario = $1 AND fecha_eliminacion IS NULL",
)
    .bind(id)
    .bind(&actualizado.nombre)
    .bind(&actualizado.apellido)
    .bind(&actualizado.fecha_nacimiento)
    .bind(&actualizado.ciudad_nacimiento)
    .bind(&actualizado.tipo_documento)
    .bind(&actualizado.numero_documento)
    .bind(&correo)
    .bind(&actualizado.telefono)
    .bind(&actualizado.ubicacion_ciudad)
    .execute(&mut *tx)
    .await
    .map_err(error_bd)?
    .rows_affected();

    if filas == 0 {
        return Err(Status::NotFound);
    }

    let filas_acad = sqlx::query(
        "UPDATE InformacionAcademica
     SET
         Institucion = CASE WHEN EXISTS
             (SELECT 1 FROM CamposOcultos WHERE Id_Usuario = $1 AND Campo = 'universidad')
             THEN Institucion ELSE $2 END,

         Grado_Academico = CASE WHEN EXISTS
             (SELECT 1 FROM CamposOcultos WHERE Id_Usuario = $1 AND Campo = 'carrera')
             THEN Grado_Academico ELSE $3 END,

         Fecha_Inical = CASE WHEN EXISTS
             (SELECT 1 FROM CamposOcultos WHERE Id_Usuario = $1 AND Campo = 'fecha_inicio_estudio')
             THEN Fecha_Inical ELSE $4::text::date END,

         Fecha_Final = CASE WHEN EXISTS
             (SELECT 1 FROM CamposOcultos WHERE Id_Usuario = $1 AND Campo = 'fecha_fin_estudio')
             THEN Fecha_Final ELSE $5::text::date END

     WHERE Id_Usuario = $1 AND Fecha_Eliminacion_Academic IS NULL",
)
    .bind(id)
    .bind(&actualizado.universidad)
    .bind(&actualizado.carrera)
    .bind(&actualizado.fecha_inicio_estudio)
    .bind(&actualizado.fecha_fin_estudio)
    .execute(&mut *tx)
    .await
    .map_err(error_bd)?
    .rows_affected();


    if filas_acad == 0 {
    let ocultos_academicos: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)
         FROM CamposOcultos
         WHERE Id_Usuario = $1
           AND Campo IN (
               'universidad',
               'carrera',
               'fecha_inicio_estudio',
               'fecha_fin_estudio'
           )"
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    .map_err(error_bd)?;

    if ocultos_academicos > 0 {
        return Err(Status::Conflict);
    }
        sqlx::query(
            "INSERT INTO InformacionAcademica
                (Id_Usuario, Institucion, Grado_Academico, Fecha_Inical, Fecha_Final)
             VALUES ($1, $2, $3, $4::text::date, $5::text::date)",
        )
        .bind(id)
        .bind(&actualizado.universidad)
        .bind(&actualizado.carrera)
        .bind(&actualizado.fecha_inicio_estudio)
        .bind(&actualizado.fecha_fin_estudio)
        .execute(&mut *tx)
        .await
        .map_err(error_bd)?;
    }

    tx.commit().await.map_err(error_bd)?;

    buscar_perfil(pool.inner(), id)
        .await
        .map_err(error_bd)?
        .map(Json)
        .ok_or(Status::NotFound)
}


#[delete("/perfiles/<id>")]
async fn eliminar_perfil(id: i32, pool: &State<PgPool>) -> Result<Json<Perfil>, Status> {
    let perfil = buscar_perfil(pool.inner(), id)
        .await
        .map_err(error_bd)?
        .ok_or(Status::NotFound)?;

    let mut tx = pool.begin().await.map_err(error_bd)?;

    sqlx::query(
        "UPDATE InformacionAcademica SET Fecha_Eliminacion_Academic = NOW()
         WHERE Id_Usuario = $1 AND Fecha_Eliminacion_Academic IS NULL",
    )
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(error_bd)?;

    sqlx::query(
        "UPDATE ExperienciaLaboral SET Fecha_Eliminacion_Experiencia_Laboral = NOW()
         WHERE Id_Usuario = $1 AND Fecha_Eliminacion_Experiencia_Laboral IS NULL",
    )
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(error_bd)?;

    sqlx::query(
        "UPDATE Usuario_Tiene_Habilidades SET Fecha_eliminacion_Usuario_Tiene_habilidades = NOW()
         WHERE Id_Usuario = $1 AND Fecha_eliminacion_Usuario_Tiene_habilidades IS NULL",
    )
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(error_bd)?;

    sqlx::query(
        "UPDATE Usuario SET fecha_eliminacion = NOW()
         WHERE Id_Usuario = $1 AND fecha_eliminacion IS NULL",
    )
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(error_bd)?;

    tx.commit().await.map_err(error_bd)?;

    Ok(Json(perfil))
}


#[get("/perfiles/<id>/campos-ocultos")]
async fn consultar_campos_ocultos(
    id: i32,
    pool: &State<PgPool>,
) -> Result<Json<CamposOcultosRespuesta>, Status> {

    buscar_perfil(pool.inner(), id)
        .await
        .map_err(error_bd)?
        .ok_or(Status::NotFound)?;

    let campos: Vec<String> = sqlx::query_scalar(
        "SELECT Campo
         FROM CamposOcultos
         WHERE Id_Usuario = $1
         ORDER BY Campo"
    )
    .bind(id)
    .fetch_all(pool.inner())
    .await
    .map_err(error_bd)?;

    Ok(Json(CamposOcultosRespuesta { campos }))
}

#[post("/perfiles/<id>/ocultar", format = "json", data = "<solicitud>")]
async fn ocultar_campo(
    id: i32,
    solicitud: Json<CampoSolicitud>,
    pool: &State<PgPool>,
) -> Result<Status, Status> {

    if !campo_valido(&solicitud.campo) {
        return Err(Status::BadRequest);
    }

    buscar_perfil(pool.inner(), id)
        .await
        .map_err(error_bd)?
        .ok_or(Status::NotFound)?;

    sqlx::query(
        "INSERT INTO CamposOcultos (Id_Usuario, Campo)
         VALUES ($1, $2)
         ON CONFLICT (Id_Usuario, Campo) DO NOTHING"
    )
    .bind(id)
    .bind(&solicitud.campo)
    .execute(pool.inner())
    .await
    .map_err(error_bd)?;

    Ok(Status::Ok)
}

#[post("/perfiles/<id>/recuperar", format = "json", data = "<solicitud>")]
async fn recuperar_campo(
    id: i32,
    solicitud: Json<CampoSolicitud>,
    pool: &State<PgPool>,
) -> Result<Status, Status> {

    if !campo_valido(&solicitud.campo) {
        return Err(Status::BadRequest);
    }

    buscar_perfil(pool.inner(), id)
        .await
        .map_err(error_bd)?
        .ok_or(Status::NotFound)?;

    sqlx::query(
        "DELETE FROM CamposOcultos
         WHERE Id_Usuario = $1 AND Campo = $2"
    )
    .bind(id)
    .bind(&solicitud.campo)
    .execute(pool.inner())
    .await
    .map_err(error_bd)?;

    Ok(Status::Ok)
}



const MAX_CORTO: usize = 100;
const MAX_DESCRIPCION: usize = 600;
const MAX_TEXTO_CAMBIO: usize = 250;

fn longitud_valida(texto: &str, max: usize) -> bool {
    !texto.is_empty() && texto.chars().count() <= max
}

fn recortar(texto: &str, max: usize) -> String {
    texto.chars().take(max).collect()
}

fn describir_cambio(antes: &str, despues: &str) -> String {
    let mostrar = |t: &str| -> String {
        if t.is_empty() {
            "(vacío)".to_string()
        } else {
            recortar(t, MAX_TEXTO_CAMBIO)
        }
    };
    format!("{} -> {}", mostrar(antes), mostrar(despues))
}

async fn usuario_activo(pool: &PgPool, id: i32) -> Result<bool, sqlx::Error> {
    let existe: Option<i32> = sqlx::query_scalar(
        "SELECT Id_Usuario FROM Usuario
         WHERE Id_Usuario = $1 AND fecha_eliminacion IS NULL",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(existe.is_some())
}



#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(crate = "rocket::serde")]
struct Experiencia {
    id: i32,
    empresa: String,
    cargo: String,
    descripcion: String,
    fecha_inicio: String,
    fecha_fin: Option<String>,
}

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct NuevaExperiencia {
    empresa: String,
    cargo: String,
    descripcion: String,
    fecha_inicio: String,
    fecha_fin: Option<String>,
}

impl NuevaExperiencia {
    fn normalizar(&self) -> Result<NuevaExperiencia, Status> {
        let empresa = self.empresa.trim().to_string();
        let cargo = self.cargo.trim().to_string();
        let descripcion = self.descripcion.trim().to_string();
        let fecha_inicio = self.fecha_inicio.trim().to_string();
        let fecha_fin = self
            .fecha_fin
            .as_deref()
            .map(str::trim)
            .filter(|f| !f.is_empty())
            .map(str::to_string);

        if !longitud_valida(&empresa, MAX_CORTO)
            || !longitud_valida(&cargo, MAX_CORTO)
            || !longitud_valida(&descripcion, MAX_DESCRIPCION)
            || fecha_inicio.is_empty()
        {
            return Err(Status::UnprocessableEntity);
        }

        // Las fechas llegan como YYYY-MM-DD, así que comparar texto equivale a comparar fechas
        if let Some(fin) = &fecha_fin {
            if fin.as_str() < fecha_inicio.as_str() {
                return Err(Status::UnprocessableEntity);
            }
        }

        Ok(NuevaExperiencia {
            empresa,
            cargo,
            descripcion,
            fecha_inicio,
            fecha_fin,
        })
    }
}

const SELECT_EXPERIENCIA: &str = "
    SELECT Id_Experiencia AS id,
           Empresa AS empresa,
           Cargo AS cargo,
           Descripcion AS descripcion,
           to_char(Fecha_Inicial_ExperLab, 'YYYY-MM-DD') AS fecha_inicio,
           to_char(Fecha_Final, 'YYYY-MM-DD') AS fecha_fin
    FROM ExperienciaLaboral
    WHERE Id_Usuario = $1
      AND Fecha_Eliminacion_Experiencia_Laboral IS NULL";

async fn buscar_experiencia(
    conn: &mut PgConnection,
    id_usuario: i32,
    id_exp: i32,
    bloquear: bool,
) -> Result<Option<Experiencia>, sqlx::Error> {
    let candado = if bloquear { " FOR UPDATE" } else { "" };
    let consulta = format!("{SELECT_EXPERIENCIA} AND Id_Experiencia = $2{candado}");
    sqlx::query_as::<_, Experiencia>(&consulta)
        .bind(id_usuario)
        .bind(id_exp)
        .fetch_optional(&mut *conn)
        .await
}

async fn registrar_edicion_experiencia(
    conn: &mut PgConnection,
    id_exp: i32,
    campo: &str,
    descripcion: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO EdicionExperienciaLaboral
            (Fecha_Edicion_Experiencia, CampoEditado, Descripcion_Edicion_Experiencia, Id_Experiencia)
         VALUES (NOW(), $1, $2, $3)",
    )
    .bind(campo)
    .bind(descripcion)
    .bind(id_exp)
    .execute(&mut *conn)
    .await?;
    Ok(())
}

#[get("/perfiles/<id>/experiencias")]
async fn listar_experiencias(
    id: i32,
    pool: &State<PgPool>,
) -> Result<Json<Vec<Experiencia>>, Status> {
    if !usuario_activo(pool.inner(), id).await.map_err(error_bd)? {
        return Err(Status::NotFound);
    }

    let consulta = format!(
        "{SELECT_EXPERIENCIA} ORDER BY Fecha_Inicial_ExperLab DESC, Id_Experiencia DESC"
    );
    let experiencias = sqlx::query_as::<_, Experiencia>(&consulta)
        .bind(id)
        .fetch_all(pool.inner())
        .await
        .map_err(error_bd)?;

    Ok(Json(experiencias))
}

#[post("/perfiles/<id>/experiencias", format = "json", data = "<nueva>")]
async fn crear_experiencia(
    id: i32,
    nueva: Json<NuevaExperiencia>,
    pool: &State<PgPool>,
) -> Result<Json<Experiencia>, Status> {
    let datos = nueva.normalizar()?;

    if !usuario_activo(pool.inner(), id).await.map_err(error_bd)? {
        return Err(Status::NotFound);
    }

    let mut tx = pool.begin().await.map_err(error_bd)?;

    let id_exp: i32 = sqlx::query_scalar(
        "INSERT INTO ExperienciaLaboral
            (Id_Usuario, Empresa, Cargo, Descripcion, Fecha_Inicial_ExperLab, Fecha_Final)
         VALUES ($1, $2, $3, $4, $5::text::date, $6::text::date)
         RETURNING Id_Experiencia",
    )
    .bind(id)
    .bind(&datos.empresa)
    .bind(&datos.cargo)
    .bind(&datos.descripcion)
    .bind(&datos.fecha_inicio)
    .bind(&datos.fecha_fin)
    .fetch_one(&mut *tx)
    .await
    .map_err(error_bd)?;

    let creada = buscar_experiencia(&mut *tx, id, id_exp, false)
        .await
        .map_err(error_bd)?
        .ok_or(Status::InternalServerError)?;

    tx.commit().await.map_err(error_bd)?;

    Ok(Json(creada))
}

#[put("/perfiles/<id>/experiencias/<exp_id>", format = "json", data = "<actualizada>")]
async fn actualizar_experiencia(
    id: i32,
    exp_id: i32,
    actualizada: Json<NuevaExperiencia>,
    pool: &State<PgPool>,
) -> Result<Json<Experiencia>, Status> {
    let datos = actualizada.normalizar()?;

    let mut tx = pool.begin().await.map_err(error_bd)?;

    let actual = buscar_experiencia(&mut *tx, id, exp_id, true)
        .await
        .map_err(error_bd)?
        .ok_or(Status::NotFound)?;

    let fin_actual = actual.fecha_fin.clone().unwrap_or_default();
    let fin_nuevo = datos.fecha_fin.clone().unwrap_or_default();

    let cambios: [(&str, &str, &str); 5] = [
        ("empresa", actual.empresa.as_str(), datos.empresa.as_str()),
        ("cargo", actual.cargo.as_str(), datos.cargo.as_str()),
        ("descripcion", actual.descripcion.as_str(), datos.descripcion.as_str()),
        ("fecha_inicio", actual.fecha_inicio.as_str(), datos.fecha_inicio.as_str()),
        ("fecha_fin", fin_actual.as_str(), fin_nuevo.as_str()),
    ];

    if cambios.iter().any(|(_, antes, despues)| antes != despues) {
        sqlx::query(
            "UPDATE ExperienciaLaboral
             SET Empresa = $1,
                 Cargo = $2,
                 Descripcion = $3,
                 Fecha_Inicial_ExperLab = $4::text::date,
                 Fecha_Final = $5::text::date
             WHERE Id_Experiencia = $6
               AND Id_Usuario = $7
               AND Fecha_Eliminacion_Experiencia_Laboral IS NULL",
        )
        .bind(&datos.empresa)
        .bind(&datos.cargo)
        .bind(&datos.descripcion)
        .bind(&datos.fecha_inicio)
        .bind(&datos.fecha_fin)
        .bind(exp_id)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(error_bd)?;

        for (campo, antes, despues) in cambios {
            if antes != despues {
                registrar_edicion_experiencia(
                    &mut *tx,
                    exp_id,
                    campo,
                    &describir_cambio(antes, despues),
                )
                .await
                .map_err(error_bd)?;
            }
        }
    }

    let guardada = buscar_experiencia(&mut *tx, id, exp_id, false)
        .await
        .map_err(error_bd)?
        .ok_or(Status::NotFound)?;

    tx.commit().await.map_err(error_bd)?;

    Ok(Json(guardada))
}

#[delete("/perfiles/<id>/experiencias/<exp_id>")]
async fn eliminar_experiencia(
    id: i32,
    exp_id: i32,
    pool: &State<PgPool>,
) -> Result<Json<Experiencia>, Status> {
    let mut tx = pool.begin().await.map_err(error_bd)?;

    let actual = buscar_experiencia(&mut *tx, id, exp_id, true)
        .await
        .map_err(error_bd)?
        .ok_or(Status::NotFound)?;

    sqlx::query(
        "UPDATE ExperienciaLaboral SET Fecha_Eliminacion_Experiencia_Laboral = NOW()
         WHERE Id_Experiencia = $1
           AND Id_Usuario = $2
           AND Fecha_Eliminacion_Experiencia_Laboral IS NULL",
    )
    .bind(exp_id)
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(error_bd)?;

    registrar_edicion_experiencia(
        &mut *tx,
        exp_id,
        "eliminacion",
        &format!("Experiencia eliminada: {} en {}", actual.cargo, actual.empresa),
    )
    .await
    .map_err(error_bd)?;

    tx.commit().await.map_err(error_bd)?;

    Ok(Json(actual))
}



#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(crate = "rocket::serde")]
struct HabilidadUsuario {

    id: i32,
  
    habilidad_id: i32,
    nombre: String,
    nivel: String,
}

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct NuevaHabilidad {
    nombre: String,
    nivel: String,
}

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct CambioNivel {
    nivel: String,
}

const SELECT_HABILIDAD_USUARIO: &str = "
    SELECT uh.Id_Nivel_Habilidades AS id,
           h.Id_Habilidades AS habilidad_id,
           h.Nombre_Habilidad AS nombre,
           uh.Nivel_Habilidades AS nivel
    FROM Usuario_Tiene_Habilidades uh
    JOIN Habilidades h ON h.Id_Habilidades = uh.Id_Habilidades
    WHERE uh.Id_Usuario = $1
      AND uh.Fecha_eliminacion_Usuario_Tiene_habilidades IS NULL
      AND h.Fecha_eliminacion_habilidades IS NULL";

async fn buscar_habilidad_usuario(
    conn: &mut PgConnection,
    id_usuario: i32,
    id_nivel: i32,
    bloquear: bool,
) -> Result<Option<HabilidadUsuario>, sqlx::Error> {
    let candado = if bloquear { " FOR UPDATE OF uh" } else { "" };
    let consulta =
        format!("{SELECT_HABILIDAD_USUARIO} AND uh.Id_Nivel_Habilidades = $2{candado}");
    sqlx::query_as::<_, HabilidadUsuario>(&consulta)
        .bind(id_usuario)
        .bind(id_nivel)
        .fetch_optional(&mut *conn)
        .await
}

async fn registrar_edicion_habilidad(
    conn: &mut PgConnection,
    id_habilidad: i32,
    id_nivel: i32,
    campo: &str,
    descripcion: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO EdicionHabilidades
            (Fecha_Edicion_Habilidades, CampoEditado, Descripcion_Edicion_Habilidades,
             Id_Habilidades, Id_Nivel_Habilidades)
         VALUES (NOW(), $1, $2, $3, $4)",
    )
    .bind(campo)
    .bind(descripcion)
    .bind(id_habilidad)
    .bind(id_nivel)
    .execute(&mut *conn)
    .await?;
    Ok(())
}

#[get("/perfiles/<id>/habilidades")]
async fn listar_habilidades(
    id: i32,
    pool: &State<PgPool>,
) -> Result<Json<Vec<HabilidadUsuario>>, Status> {
    if !usuario_activo(pool.inner(), id).await.map_err(error_bd)? {
        return Err(Status::NotFound);
    }

    let consulta = format!("{SELECT_HABILIDAD_USUARIO} ORDER BY h.Nombre_Habilidad");
    let habilidades = sqlx::query_as::<_, HabilidadUsuario>(&consulta)
        .bind(id)
        .fetch_all(pool.inner())
        .await
        .map_err(error_bd)?;

    Ok(Json(habilidades))
}


#[post("/perfiles/<id>/habilidades", format = "json", data = "<nueva>")]
async fn crear_habilidad(
    id: i32,
    nueva: Json<NuevaHabilidad>,
    pool: &State<PgPool>,
) -> Result<Json<HabilidadUsuario>, Status> {
    let nombre = nueva.nombre.trim().to_string();
    let nivel = nueva.nivel.trim().to_string();

    if !longitud_valida(&nombre, MAX_CORTO) || !longitud_valida(&nivel, MAX_CORTO) {
        return Err(Status::UnprocessableEntity);
    }

    if !usuario_activo(pool.inner(), id).await.map_err(error_bd)? {
        return Err(Status::NotFound);
    }

    let mut tx = pool.begin().await.map_err(error_bd)?;

    let existente: Option<i32> = sqlx::query_scalar(
        "SELECT Id_Habilidades FROM Habilidades
         WHERE lower(Nombre_Habilidad) = lower($1)
           AND Fecha_eliminacion_habilidades IS NULL
         ORDER BY Id_Habilidades
         LIMIT 1",
    )
    .bind(&nombre)
    .fetch_optional(&mut *tx)
    .await
    .map_err(error_bd)?;

    let id_habilidad: i32 = match existente {
        Some(encontrada) => encontrada,
        None => sqlx::query_scalar(
            "INSERT INTO Habilidades (Nombre_Habilidad) VALUES ($1) RETURNING Id_Habilidades",
        )
        .bind(&nombre)
        .fetch_one(&mut *tx)
        .await
        .map_err(error_bd)?,
    };

    let duplicada: Option<i32> = sqlx::query_scalar(
        "SELECT Id_Nivel_Habilidades FROM Usuario_Tiene_Habilidades
         WHERE Id_Usuario = $1
           AND Id_Habilidades = $2
           AND Fecha_eliminacion_Usuario_Tiene_habilidades IS NULL",
    )
    .bind(id)
    .bind(id_habilidad)
    .fetch_optional(&mut *tx)
    .await
    .map_err(error_bd)?;

    if duplicada.is_some() {
        return Err(Status::Conflict);
    }

    let id_nivel: i32 = sqlx::query_scalar(
        "INSERT INTO Usuario_Tiene_Habilidades (Nivel_Habilidades, Id_Usuario, Id_Habilidades)
         VALUES ($1, $2, $3)
         RETURNING Id_Nivel_Habilidades",
    )
    .bind(&nivel)
    .bind(id)
    .bind(id_habilidad)
    .fetch_one(&mut *tx)
    .await
    .map_err(error_bd)?;

    let creada = buscar_habilidad_usuario(&mut *tx, id, id_nivel, false)
        .await
        .map_err(error_bd)?
        .ok_or(Status::InternalServerError)?;

    tx.commit().await.map_err(error_bd)?;

    Ok(Json(creada))
}


#[put("/perfiles/<id>/habilidades/<nivel_id>", format = "json", data = "<cambio>")]
async fn actualizar_habilidad(
    id: i32,
    nivel_id: i32,
    cambio: Json<CambioNivel>,
    pool: &State<PgPool>,
) -> Result<Json<HabilidadUsuario>, Status> {
    let nivel_nuevo = cambio.nivel.trim().to_string();

    if !longitud_valida(&nivel_nuevo, MAX_CORTO) {
        return Err(Status::UnprocessableEntity);
    }

    let mut tx = pool.begin().await.map_err(error_bd)?;

    let actual = buscar_habilidad_usuario(&mut *tx, id, nivel_id, true)
        .await
        .map_err(error_bd)?
        .ok_or(Status::NotFound)?;

    if actual.nivel != nivel_nuevo {
        sqlx::query(
            "UPDATE Usuario_Tiene_Habilidades SET Nivel_Habilidades = $1
             WHERE Id_Nivel_Habilidades = $2
               AND Id_Usuario = $3
               AND Fecha_eliminacion_Usuario_Tiene_habilidades IS NULL",
        )
        .bind(&nivel_nuevo)
        .bind(nivel_id)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(error_bd)?;

        registrar_edicion_habilidad(
            &mut *tx,
            actual.habilidad_id,
            nivel_id,
            "nivel",
            &describir_cambio(&actual.nivel, &nivel_nuevo),
        )
        .await
        .map_err(error_bd)?;
    }

    let guardada = buscar_habilidad_usuario(&mut *tx, id, nivel_id, false)
        .await
        .map_err(error_bd)?
        .ok_or(Status::NotFound)?;

    tx.commit().await.map_err(error_bd)?;

    Ok(Json(guardada))
}

#[delete("/perfiles/<id>/habilidades/<nivel_id>")]
async fn eliminar_habilidad(
    id: i32,
    nivel_id: i32,
    pool: &State<PgPool>,
) -> Result<Json<HabilidadUsuario>, Status> {
    let mut tx = pool.begin().await.map_err(error_bd)?;

    let actual = buscar_habilidad_usuario(&mut *tx, id, nivel_id, true)
        .await
        .map_err(error_bd)?
        .ok_or(Status::NotFound)?;

    sqlx::query(
        "UPDATE Usuario_Tiene_Habilidades SET Fecha_eliminacion_Usuario_Tiene_habilidades = NOW()
         WHERE Id_Nivel_Habilidades = $1
           AND Id_Usuario = $2
           AND Fecha_eliminacion_Usuario_Tiene_habilidades IS NULL",
    )
    .bind(nivel_id)
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(error_bd)?;

    registrar_edicion_habilidad(
        &mut *tx,
        actual.habilidad_id,
        nivel_id,
        "eliminacion",
        &format!("Habilidad eliminada (nivel: {})", actual.nivel),
    )
    .await
    .map_err(error_bd)?;

    tx.commit().await.map_err(error_bd)?;

    Ok(Json(actual))
}


#[launch]
async fn rocket() -> _ {
    dotenvy::dotenv().ok();

    let url = std::env::var("DATABASE_URL").expect("Falta la variable DATABASE_URL");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .expect("No se pudo conectar a PostgreSQL");

    rocket::build()
        .manage(pool)
        .mount("/", routes![inicio])
        .mount(
            "/api",
            routes![
            obtener_perfiles,
            obtener_perfil,
            crear_perfil,
            actualizar_perfil,
            eliminar_perfil,
            consultar_campos_ocultos,
            ocultar_campo,
            recuperar_campo,
            listar_experiencias,
            crear_experiencia,
            actualizar_experiencia,
            eliminar_experiencia,
            listar_habilidades,
            crear_habilidad,
            actualizar_habilidad,
            eliminar_habilidad
        ],
    )
}
