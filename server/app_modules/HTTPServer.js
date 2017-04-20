var http = require("http");
var express = require("express");
var forwarded = require('forwarded-for');
var app = express();
var cors = require('cors');

var database = null;

exports.initialize = function (settings) {
  var server = http.createServer(app);
  database = settings.database;
  app.use(cors());
  app.use(express.static(settings.root));
  server.listen(settings.port, function onServerListening() {
    console.log('HTTP server listening on ' + server.address().port);
    exports.server = server;
    settings.onCreate();
    setupPaths();
  });
};

function setupPaths() {
  app.get('/api/debates', function(req, res) {
    var debates = database.collection('debates');
    debates.find({ $or: [ { end: { $gt: Date.now() } }, { type: 'channel' } ] }).toArray(function(err, debates) {
      res.end(JSON.stringify(debates));
    });
  });
}