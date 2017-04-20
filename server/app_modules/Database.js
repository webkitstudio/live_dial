var mongodb = require('mongodb');

exports.connect = function (settings) {
//   temporary bypass mongodb for dev
//   settings.onConnect();
//   return true;
  
  mongodb.MongoClient.connect(settings.uri, function(err, db) {
    if (err) {
      console.log(err);
    } else {
      console.log("connected to database");
      exports.database = db;
      settings.onConnect();
    }
  });
};
