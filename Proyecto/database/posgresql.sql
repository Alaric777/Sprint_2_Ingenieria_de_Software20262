CREATE TABLE Usuario(
	Id_Usuario INT primary key GENERATED ALWAYS AS IDENTITY,
	Nombres Varchar(250) not null,
	Apellidos Varchar(250) not null,
	Fecha_Nacimiento date not null,
	Ciudad_Nacimiento Varchar(250) not null,
	Numero_Documento varchar(50) not null,
	Tipo_Documento varchar(50) not null,
	Correo_Electronico varchar(250) unique not null,
	Numero_Telefonico varchar(15) not null,
	Ubicacion_Ciudad varchar(250) not null,
	fecha_eliminacion TIMESTAMPTZ,
	constraint Documento_Numero Unique(Tipo_Documento,Numero_Documento),
	constraint correo_minus check(Correo_Electronico=lower(Correo_Electronico))
);


Create table InformacionAcademica(
	Id_infoAcademica INT primary key GENERATED ALWAYS AS IDENTITY,
	Fecha_Inical date not null,
	Fecha_Final date,
	Grado_Academico varchar(250),
	Institucion varchar(250) not null,
	Fecha_Eliminacion_Academic TIMESTAMPTZ,
	Id_Usuario int not null,
	constraint fk_usuario foreign key (Id_Usuario) References Usuario(Id_Usuario)	
);


Create Table ExperienciaLaboral(
	Id_Experiencia INT primary key GENERATED ALWAYS AS IDENTITY,
	Empresa varchar(100) not null,
	Fecha_Inicial_ExperLab date not null,
	Fecha_Final date,
	Cargo varchar(100) not null,
	Descripcion varchar(600) not null,
	Fecha_Eliminacion_Experiencia_Laboral TIMESTAMPTZ,
	Id_Usuario INT not null,
	constraint fk_usuario foreign key (Id_Usuario) References Usuario(Id_Usuario)
);

Create Table Permiso_Extension(
	Id_Permiso INT primary key GENERATED ALWAYS AS IDENTITY,
	Fecha_Inicial_Perm date not null,
	Fecha_Final_Perm date,
	Id_Usuario INT not null,
	constraint fk_usuario_Permiso foreign key (Id_Usuario) References Usuario(Id_Usuario)
);

Create table Autocompletado(
	Id_Autocompletado BigINT primary key GENERATED ALWAYS AS IDENTITY not null,
	Casilla_Completada varchar(50) not null,
	Descripcion_autocompletado varchar(500),
	Fecha_Autocompletado TIMESTAMPTZ NOT NULL DEFAULT now(),
	Id_Usuario INT not null,
	constraint fk_usuario_Autocompletado foreign key (Id_Usuario) References Usuario(Id_Usuario)
);

Create table Habilidades(
	Id_Habilidades int primary key GENERATED ALWAYS AS IDENTITY,
	Nombre_Habilidad varchar(100) not null,
	Fecha_eliminacion_habilidades TIMESTAMPTZ
);

Create table Usuario_Tiene_Habilidades(
	Id_Nivel_Habilidades INT primary key GENERATED ALWAYS AS IDENTITY,
	Nivel_Habilidades Varchar(100) not null, 
	Id_Usuario INT not null,
	Id_Habilidades int not null,
	Fecha_eliminacion_Usuario_Tiene_habilidades TIMESTAMPTZ,
	constraint fk_usuariohabilid_User foreign key (Id_Usuario) references Usuario(Id_Usuario),
	constraint fk_usuariohabilid_Habilidad foreign key (Id_Habilidades) references Habilidades(Id_Habilidades)
);

Create table EdicionHabilidades(
	Id_EdicionHabilidades INT primary key GENERATED ALWAYS AS IDENTITY,
	Fecha_Edicion_Habilidades TIMESTAMPTZ not null,
	CampoEditado Varchar(100) not null,
	Descripcion_Edicion_Habilidades varchar(550) not null,
	Id_Habilidades int not null,
	Id_Nivel_Habilidades int not null,
	constraint fk_Habilidades_edicion foreign key (Id_Habilidades) references Habilidades(Id_Habilidades),
	constraint fk_Habilidades_edicionUsuario foreign key (Id_Nivel_Habilidades) references Usuario_Tiene_Habilidades(Id_Nivel_Habilidades)
);

create table EdicionExperienciaLaboral(
	Id_EdicionExperiencia int primary key GENERATED ALWAYS AS IDENTITY,
	Fecha_Edicion_Experiencia TIMESTAMPTZ not null,
	CampoEditado Varchar(100) not null,
	Descripcion_Edicion_Experiencia varchar(550) not null,
	Id_Experiencia INT not null, 
	constraint fk_lab_edicion foreign key (Id_Experiencia) references ExperienciaLaboral(Id_Experiencia)
	);

Create table EdicionDatosUsuarios(
	Id_EdicionUser INT primary key GENERATED ALWAYS AS IDENTITY,
	Fecha_Edicion_User TIMESTAMPTZ not null,
	CampoEditado Varchar(100) not null,
	Descripcion_Edicion_User varchar(550) not null,
	Id_Usuario int not null,
	constraint fk_User_Edicion foreign key (Id_Usuario) references Usuario(Id_Usuario)
	);
	
Create table EdicionInfoAcademica(
	Id_EdicionAcademic int primary key GENERATED ALWAYS AS IDENTITY,
	Fecha_Edicion_Academic TIMESTAMPTZ not null,
	CampoEditado Varchar(100) not null,
	Descripcion_Edicion_Academic varchar(550 )not null,
	Id_infoAcademica INT not null,
	constraint fk_infoAcademic_Edicion foreign key (Id_infoAcademica) References InformacionAcademica(Id_infoAcademica)
);
