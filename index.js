/***************************************
* Mondragón Delgado Mezly Zahory       *
* 4 - C                                *
* Proyecto Chat con sesiones y salas   *
***************************************/

//Se declaran las variables para los paquetes/librerias que vamos a utilizar
const express = require('express'),
socket = require('socket.io'),
mysql = require('mysql'),
cookieParser = require('cookie-parser'),
session = require('express-session');

const port = 3030;

//Declaramos nuestra variable app con la que manejaremos nuestro server (express)
var app = express();
const nameBot = 'BotMez';

//Inicializamos el server en el puerto 3030
var server = app.listen(port, function () {
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

  //Realizamos la consulta para extraer las salas existentes
  db.query("SELECT * FROM salas", function(err,rows,fields){
	socket.emit("showRooms", rows); //Hacemos el emit a la función de showRooms
  });

  //console.log(req.session); //Imprimos en pantalla la sesión

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
	  pass = data.pass, //Obtenemos la contraseña del usuario
	  roomID = data.roomID, //Obtenemos el ID de la sala 
	  roomName = data.roomName; //Obtenemos el nombre de la sala
	  
	  //Revisamos que si este dado de alta en la base de datos, con el username
	  db.query("SELECT * FROM users WHERE Username=?", [user], function(err, rows, fields){
		  if(rows.length == 0){ //si al recorrer la columnas, nos da un 0, quiere decir que no esta registrado
		  	socket.emit("error"); //y mandamos este mensaje que no existe
		  }else{ //si no es igual a 0, quiere decir que si existe
		  	
		  		const userid = rows[0].id,
				dataUser = rows[0].Username, //Declaramos un variable, para obtener el username
			  	dataPass = rows[0].Password, //Para obtener la contraseña
			  	dataCorreo = rows[0].email; //Para obtener el correo

				//Validamos. Si la contraseña y usuario son nulos ->
				if(dataPass == null || dataUser == null){
				  	socket.emit("error"); //se manda con un socket.emit un error
				}
				//Ahora Validamos, si el usuario y contraseña introducidos son iguales a los que se tiene en la base
				if(user == dataUser && pass == dataPass){ //parametros user y pass definidos en el script (index.html)
					console.log("Usuario correcto!"); //si si, ingresa correctamente

					db.query("SELECT * FROM salas where id= ?", [roomID], function(err,rows,fields){
						if(rows.length == 0) //hacemos una consulta para verificar si existe esa en la base de datos
						{
						  socket.emit("errorS"); //si es igual a 0, significa que no, y mandamos un error
						}else{
							socket.emit("logged_in", {
														//se recupera esta info al ingresar
														user: user, //usuario
														email: dataCorreo, //correo
														roomID: roomID, //id de la sala
														roomName: roomName}); //nombre de la sala

								//toda esa info la mandamos a la sesión
								req.session.userID = userid;
								req.session.Username = dataUser; 
								req.session.correo = dataCorreo;
								req.session.roomID = roomID;
								req.session.roomName = roomName; 
								req.session.save(); //guaardamos esos datos en la sesión
								socket.join(req.session.roomName); //entramos a la sala elegida
								socket.emit('juntarHisto'); //emit con el historial de la sala a la que ingresa
								bottxt('entrarSala'); //mensaje del bot de que entro a la sala
								console.log(req.session);
							}
						});
				}else{
				  	socket.emit("invalido"); //si no son iguales los datos ingtesados con los que estan en la base, mandamos un mensaje de invalido
				}
		  }
	  });
	});
	
	//Funcion guardar historial de mensajes de sala
	socket.on('historial', function(data){
		console.log('Busqueda de historial en la sala: ' + req.session.roomName); //verifcar que si sea la sala elegida

		//consulta que devuelve el nombre de usuario, la sala y el mensaje (para ver los mensajes de esa sala)
		db.query('SELECT s.nombre_sala, u.Username, m.mensaje FROM mensajes m INNER JOIN salas S ON S.id = m.sala_id INNER JOIN users u ON u.id = m.user_id WHERE m.sala_id = '+ req.session.roomID +' ORDER BY m.id ASC', function(err, rows, fields){
			socket.emit('juntarHisto', rows); //emit a la función que une todos los mensajes
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

			//consulta para verificar que no alla datos iguales en el nombre de usuario y el correo
			db.query('SELECT * FROM users where Username = ? or email = ?', [user, email], function(err, rows, res){
				if(rows.length == 0){ //si ves igual a 0, quiere decir que no hay y que si se puede registrar con esos datos

					//consulta para añadir ese usuario a la tabla de usuarios
					db.query("INSERT INTO users(`Username`, `Password`, `email`) VALUES(?, ?, ?)", [user, pass, email], function(err, rows, result){
						if(!!err){
							throw err; //si algo sale mal, manda un error
						}else{ //si no, hacemos un emit de que el usuario se registro correctamente
							console.log('Usuario ' + user + " se dio de alta correctamente!."); //mandamos un console.log para revisar si se dio de alta o no
							socket.emit('UsuarioOK'); //si todo esta bien, mandamos un socket.emit diciendo que el usuario fue agregado
						}
					});
				}else{
					//si no es igual a 0, quiere decir que si hay datos existentes, mandamos una alerta de que los cambie
					socket.emit('errorRegis');
				}
			});
		}else{ //alerta de que dejo campos vacios
			socket.emit('vacio');
		}
	});

	//Funcion para cambiar de sala en el chat
	socket.on('cambiarSala', function(data){
		const IDroom = data.IDroom, //Obtenemos el id de la sala
		nameRoom = data.nameRoom; //Obtenemos el nombre de la sala

		socket.leave(req.session.roomName); //salimos de la sala

		//igualamos los nuevos datos a los datos de la sesion
		req.session.roomID = IDroom;
		req.session.roomName = nameRoom;
		
		socket.join(req.session.roomName); //entramos a la nueva sala
		bottxt('cambiarSala');//mensaje del bot de que cambio de sala

	});
	
	//Función para crear el mensaje nuevo.
	socket.on('mjsNuevo', function(data){ 
		
		//const sala = 0; // definimos el id de la sala para posterior función.

			//Realizamos la consulta para agregar los mensajes en la base de datos
			db.query("INSERT INTO mensajes(`mensaje`, `user_id`, `sala_id`, `fecha`) VALUES(?, ?, ?, CURDATE())", [data, req.session.userID, req.session.roomID], function(err, result){
			  if(!!err) //si ocurrio un fallo, devuelve un error
			  throw err;

			  console.log(result); //console.log para revisar los resultados

			  console.log('Mensaje dado de alta correctamente!.'); //console.log para revisar que si se alla dado de alta
					
					//hacemos un broadcast.to para que mande ese mensaje solo a la sala en la que se encuentre el usuario en sesion
					socket.broadcast.to(req.session.roomName).emit('mensaje',{
						usuario: req.session.Username, //con el nombre de usuario de la sesion
						mensaje: data //y el mensake
					});

					//de igual manera hacemos un emit del mensaje (es decir q lo envie y se vea)
					socket.emit('mensaje', {
						usuario: req.session.Username, //con el nombre de usuario
						mensaje: data //y con el mensaje 
					});
			});
	});
	
	//Función para salir de la sesión
	socket.on('salir', function(request, response){
		//bottxt('abandonarSala');
		socket.leave(req.session.roonName);
		req.session.destroy(); //si presionamos el boton de salir, se destruye la sesión con la que se habia ingresado
	});
	
	//Funcion para los mensajes del bot
	function bottxt(data){
		//Mensajes del bot de que entro y cambio de sala
		entrarSala = '<b style="font-size: 15px; font-family: fanstasy">Bienvenido a la sala ' + req.session.roomName + '</b>';
		cambiarSala = '<b style="font-size: 15px; font-family: fanstasy">Haz cambiado de sala. Tu nueva sala es: ' + req.session.roomName + '</b>';

		//si entro, le da la bienvenida
		if(data == 'entrarSala'){
			socket.emit('mensaje',{
				usuario: nameBot,
				mensaje: entrarSala
			});
		}

		//si cambio de sala, le dice que cambio de sala
		if(data == 'cambiarSala'){
			socket.emit('mensaje',{
				usuario: nameBot,
				mensaje: cambiarSala
			});
		}
	}
});