/***************************************
* Mondragón Delgado Mezly Zahory       *
* 4 - C                                *
* Actividad 4 - Complemento            *
***************************************/

//Se declaran las variables para los paquetes/librerias que vamos a utilizar
const express = require('express'),
socket = require('socket.io'),
mysql = require('mysql'),
cookieParser = require('cookie-parser'),
session = require('express-session');

//Declaramos nuestra variable app con la que manejaremos nuestro server (express)
var app = express();

//Inicializamos el server en el puerto 3030
var server = app.listen(3030, function () {
  console.log("Servidor en marcha, port 3030.");
});

//Declaramos la variable de socket con la que conectará al server
var io = socket(server);

//Definimos los parametros necesarios para configurar la parte de sesiones
var sessionMiddleware = session({
  secret: "keyUltraSecret",
  resave: true,
  saveUninitialized: true
});

//Aqui es donde conectamos las sesiones con el socket
io.use(function (socket, next) {
  sessionMiddleware(socket.request, socket.request.res, next);
});

/*Le decimos a nuestro app que va trabajar con las sesiones que declaramos previamente
nota: cookie parse facilita el manejo de sesiones*/
app.use(sessionMiddleware);
app.use(cookieParser());

//Conexión con nuestra base de datos y sus respectivos parametros
const config = {
  "host": "localhost",
  "user": "root",
  "password": "",
  "base": "chat"
};

var db = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : '',
  database : 'chat'
});

//Verificar la conexión a la base de datos
db.connect(function (err) {
  if (!!err) //si ocurrio un fallo en la conexión, manda un error
  throw err;
  //si no, manda un mensaje de que esta conectado en los sig. parametros
  console.log('MySQL conectado: ' + config.host + ", usuario: " + config.user + ", Base de datos: " + config.base);
});

//Declaramos un ruta estatica para raiz
app.use(express.static('./'));

//Funcion para iniciar la conexión | Iniciamos la conexión con socket
io.on('connection', function (socket) {
  var req = socket.request;

  console.log(req.session); //Imprimos en pantalla la sesión

	//Aqui definimos quien es el que inicia sesion
	if(req.session.userID != null){ //si el userID no es nulo, realiza la sig. consulta para extraer los datos del user
		db.query("SELECT * FROM users WHERE id=?", [req.session.userID], function(err, rows, fields){ //consulta para extraer los datos
			console.log('Sesión iniciada con el UserID: ' + req.session.userID + ' Y nombre de usuario: ' + req.session.Username); //Hacemos un console.log solo para checar de quien es la sesion
			socket.emit("logged_in", {user: req.session.Username, email: req.session.correo}); //mandamos un emit de que se inicio sesion correctamente con los datos del user
		});
	}else{ //si el userID fue nulo, quiere decir que nadie inicio sesión
		console.log('No hay sesión iniciada');
	}

	//Funcion para ingresar. | Aqui vamos a validar el login del usuario
	socket.on("login", function(data){
	  const user = data.user, //Obtenemos el nombre usuario
	  pass = data.pass; //Obtenemos la contraseña del usuario

	  //Revisamos que si este dado de alta en la base de datos, con el username
	  db.query("SELECT * FROM users WHERE Username=?", [user], function(err, rows, fields){
		  if(rows.length == 0){ //si al recorrer la columnas, nos da un 0, quiere decir que no esta registrado
		  	console.log("El usuario no existe, favor de registrarse!"); //y mandamos este mensaje que no existe
		  }else{ //si no es igual a 0, quiere decir que si existe
		  		console.log(rows); //imprimimos las columnas existentes
		  		
		  		const dataUser = rows[0].Username, //Declaramos un variable, para obtener el username
			  	dataPass = rows[0].Password, //Para obtener la contraseña
			  	dataCorreo = rows[0].email; //Para obtener el correo

				//Validamos. Si la contraseña y usuario son nulos ->
				if(dataPass == null || dataUser == null){
				  	socket.emit("error"); //se manda con un socket.emit un error
				}
				//Ahora Validamos, si el usuario y contraseña introducidos son iguales a los que se tiene en la base
				if(user == dataUser && pass == dataPass){ //parametros user y pass definidos en el script (index.html)
					console.log("Usuario correcto!"); //si si, ingresa correctamente
					socket.emit("logged_in", {user: user, email: dataCorreo}); //se hace un emit con los datos ingresados para la sesión
					req.session.userID = rows[0].id; //mandamos el userID a la sesión
					req.session.Username = dataUser; //mandamos el username a la sesión
					req.session.correo = dataCorreo; //mandamos el correo a la sesión
					req.session.save(); //y guaardamos esos datos en la sesión
				}else{
				  	socket.emit("invalido"); //si no son iguales los datos ingtesados con los que estan en la base, mandamos un mensaje de invalido
				}
		  }
	  });
	});
	
	//Funcion Registrar Usuarios | los parametros del botón y inputs estan en el script del html (index.html)
	socket.on('addUser', function(data){
		const user = data.user, //Obtenemos el user y lo guardamos en la variable user
		pass = data.pass, //Obtenemos la contraseña y la guardamos en la variable pass
		email = data.email; //Obtenemos el mail y lo guardamos en la variable email
		
		//si el user, pass y email, son diferentes a espacios vacios
		if(user != "" && pass != "" && email != ""){
			console.log("Registrando el usuario: " + user); //mandamos el mensaje de que lo estamos registrando
			//mandamos la consulta para insertar el usuario con los datos ingresados que guardamos en user, pass y email
		  	db.query("INSERT INTO users(`Username`, `Password`, `email`) VALUES(?, ?, ?)", [user, pass, email], function(err, result){
			  if(!!err) //si ocurrio un fallo, regresamos un error
			  throw err;

			  console.log(result); //mandamos un console.log para revisar los resultados

			  console.log('Usuario ' + user + " se dio de alta correctamente!."); //mandamos un console.log para revisar si se dio de alta o no
			  socket.emit('UsuarioOK'); //si todo esta bien, mandamos un socket.emit diciendo que el usuario fue agregado
			});
		}else{
			socket.emit('vacio');
		}
	});
	
	//Función para crear el mensaje nuevo.
	socket.on('mjsNuevo', function(data){ 
		
		const sala = 0; // definimos el id de la sala para posterior función.
			//Realizamos la consulta para agregar los mensajes en la base de datos
			db.query("INSERT INTO mensajes(`mensaje`, `user_id`, `sala_id`, `fecha`) VALUES(?, ?, ?, CURDATE())", [data, req.session.userID, sala], function(err, result){
			  if(!!err) //si ocurrio un fallo, devuelve un error
			  throw err;

			  console.log(result); //console.log para revisar los resultados

			  console.log('Mensaje dado de alta correctamente!.'); //console.log para revisar que si se alla dado de alta
					//mandamos con un broadcast (es decir a todos los usuarios) el mensaje
			  		socket.broadcast.emit('mensaje', {
						usuario: req.session.Username, //con el nombre de usuario
						mensaje: data //y el mensaje
					});
					
					//de igual manera hacemos un emit del mensaje (es decir q lo envie)
					socket.emit('mensaje', {
						usuario: req.session.Username, //con el nombre de usuario
						mensaje: data //y con el mensaje 
					});
			});
		
	});
	
	//Función para salir de la sesión
	socket.on('salir', function(request, response){
		req.session.destroy(); //si presionamos el boton de salir, se destruye la sesión con la que se habia ingresado
	});
});