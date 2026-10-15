#[macro_use]
extern crate rocket;

use rocket::http::Status;
use rocket::serde::{json::Json, Deserialize, Serialize};
use rocket::State;
use sqlx::postgres::PgPoolOptions;
use sqlx::{FromRow, PgPool};

// Estructura de un perfil (lo que devuelve la API)
#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(crate = "rocket::serde")]
struct Perfil {
    id: i32,
    nombre: String,
    apellido: String,
    fecha_nacimiento: String, // "YYYY-MM-DD"
    ciudad_nacimiento: String,
    tipo_documento: String,
    numero_documento: String,
    correo: String,
    telefono: String,
    ubicacion_ciudad: String,
    universidad: String, // se guarda en InformacionAcademica.Institucion
    carrera: String,     // se guarda en InformacionAcademica.Grado_Academico
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

const SELECT_PERFIL: &str = "
    SELECT u.Id_Usuario AS id,
           u.Nombres AS nombre,
           u.Apellidos AS apellido,
           to_char(u.Fecha_Nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
           u.Ciudad_Nacimiento AS ciudad_nacimiento,
           u.Tipo_Documento AS tipo_documento,
           u.Numero_Documento AS numero_documento,
           u.Correo_Electronico AS correo,
           u.Numero_Telefonico AS telefono,
           u.Ubicacion_Ciudad AS ubicacion_ciudad,
           COALESCE(a.Institucion, '') AS universidad,
           COALESCE(a.Grado_Academico, '') AS carrera,
           to_char(a.Fecha_Inical, 'YYYY-MM-DD') AS fecha_inicio_estudio,
           to_char(a.Fecha_Final, 'YYYY-MM-DD') AS fecha_fin_estudio
    FROM Usuario u
    LEFT JOIN LATERAL (
        SELECT Institucion, Grado_Academico, Fecha_Inical, Fecha_Final
        FROM InformacionAcademica
        WHERE Id_Usuario = u.Id_Usuario AND Fecha_Eliminacion_Academic IS NULL
        ORDER BY Id_infoAcademica DESC
        LIMIT 1
    ) a ON TRUE
    WHERE u.fecha_eliminacion IS NULL";

// Convierte un error de sqlx en un código HTTP
fn error_bd(e: sqlx::Error) -> Status {
    eprintln!("Error de base de datos: {e}");
    if let sqlx::Error::Database(db) = &e {
        match db.code().as_deref() {
           
            Some("23505") => return Status::Conflict,
           
            Some("23502") | Some("23514") | Some("22007") | Some("22008") => {
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
         SET Nombres = $2, Apellidos = $3, Fecha_Nacimiento = $4::text::date,
             Ciudad_Nacimiento = $5, Tipo_Documento = $6, Numero_Documento = $7,
             Correo_Electronico = $8, Numero_Telefonico = $9, Ubicacion_Ciudad = $10
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
         SET Institucion = $2, Grado_Academico = $3,
             Fecha_Inical = $4::text::date, Fecha_Final = $5::text::date
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

//para iniciar el servidor con la base de datos
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
                eliminar_perfil
            ],
        )
}
