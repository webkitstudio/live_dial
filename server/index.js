var databaseServer = require('./app_modules/Database.js');
var http = require('./app_modules/HTTPServer.js');
var socketServer = require('./app_modules/SocketServer.js');

var uri = 'mongodb://#get-credentials';
// var uri = 'mongodb://localhost:27017/admin';
var root = __dirname + '/www/';
var port = process.env.PORT || 9000;

// Connect to database
databaseServer.connect({
  uri: uri,
  onConnect: startHTTPServer
});

// Start the HTTP server
function startHTTPServer() {
  http.initialize({
    root: root,
    port: port,
    database: databaseServer.database,
    onCreate: startSocketServer
  });
}

// Start the socket server
function startSocketServer() {
  socketServer.initialize({
    database: databaseServer.database,
    server: http.server
  });  
}
