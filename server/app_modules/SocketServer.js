var WebSocketServer = require("ws").Server;
var url = require('url');
var forwarded = require('forwarded-for')
var ObjectID = require('mongodb').ObjectID

var wss = null;
var database = null;
var users = [];
var channels = [];

exports.initialize = function (settings) {
  database = settings.database;
  wss = new WebSocketServer({ server: settings.server })
  addSocketListeners();
  broadcastChannels();
};

function addSocketListeners() {
  wss.on('connection', function onConnection(ws) {
    var ip = forwarded(ws).ip;
    
    // if user exists, disconnect and remove then first
    if (userExists(ip)) {
      removeUser(ip, false);
    }
    addUser(ip, ws);
    
    ws.on('message', function onMessage(data) {
      var data = JSON.parse(data);
      var id = data.id;
      
      switch(data.type) {
      case 'join':
        channelStatus(id, function onChannelStatus(status, channelData) {
          switch (status) {
          case 'active':
            establishChannel(id, channelData, function onEstablishedChannel() {
              joinChannel(ip, id, function onJoinChannel() {
                channelData.participants++;
                var data = {
                  type: 'joined',
                  status: 'active',
                  channelData: channelData
                };
                ws.send(JSON.stringify(data));
                // update number of participants
                updateParticipants(id);
              });
            });
            break;
          case 'expired':
            var data = {
              type: 'joined',
              status: 'expired',
              channelData: channelData
            };
            ws.send(JSON.stringify(data));
            break;
          case 'scheduled':
            establishChannel(id, channelData, function onEstablishedChannel() {
              joinChannel(ip, id, function onJoinChannel() {
                channelData.participants++;
                var data = {
                  type: 'joined',
                  status: 'scheduled',
                  channelData: channelData
                };
                ws.send(JSON.stringify(data));
                // update number of participants
                updateParticipants(id);
              });
            });
            // send message to user and close connection
            break;
          }
        });
        break;
      case 'dial':
        updateUserValue(ip, data.value);
        break;
      }
    });
    
    ws.on('close', function onClose() {
      var socketClosed = true;
      var id;
      dance:
      for (var i = 0; i < channels.length; i++) {
        for (var ii = 0; ii < channels[i].users.length; ii++) {
          if (channels[i].users[ii] === ip) {
            id = channels[i].id;
            break dance;
          }
        }
      }
      removeUser(ip, socketClosed);
      updateParticipants(id);
    });
  });
}

function updateParticipants(id) {
  var participants = 0;
  for (var i = 0; i < channels.length; i++) {
    if (channels[i].id === id) {
      participants = channels[i].users.length;
      break;
    }
  }
  
  database.collection('debates').update(
    {'_id': new ObjectID(id)}, 
    {$set: {'participants': participants}}
  );
}

function joinChannel(ip, id, onJoinChannel) {
  // join user to channel
  for (channel in channels) {
    if (channels[channel].id === id) {
      channels[channel].users.push(ip);
      break;
    }
  }
  onJoinChannel('joined channel');
}

function removeUser(ip, socketClosed) {
  var i = channels.length;
  while (i--) {
    if (channels[i].users.indexOf(ip) > -1) {
      channels[i].users.splice(channels[i].users.indexOf(ip), 1);
    }
  }
  
  var i = users.length;
  while (i--) {
    if (users[i].ip === ip) {
      if (socketClosed === false) {
        users[i].ws.close();
      }
      users[i].ws = null;
      users.splice(i, 1);
    }
  }
}

function userExists(ip) {
  var i = users.length;
  var exists = false;
  while (i--) {
    if (users[i].ip === ip) {
      exists = true;
      break;
    }
  }
  return exists;
}

function addUser(ip, ws) {
  users.push({
    ip: ip,
    value: 0.5,
    label: 'other',
    ws: ws
  });
}

function establishChannel(id, data, onChannelEstablished) {
  var exists = false;
  for (channel in channels) {
    if (channels[channel].id === id) {
      exists = true;
      break;
    }
  }
  if (exists === false) {
    channels.push({
      id: id,
      users: [],
      data: data
    });
  }
  onChannelEstablished();
}

function channelStatus(id, onChannelStatus) {
  var status;
  
  database.collection('debates').find({'_id': new ObjectID(id)}).toArray(function(err, debates) {
    if (debates.length > 0) {
      var debate = debates[0];
    
      if (debate.type === 'channel') {
        status = 'active';
      } else {
        var now = Date.now();
        if (now > debate.end) {
          status = 'expired';
        } else if (now < debate.start) {
          status = 'scheduled';
        } else {
          status = 'active';
        }
      }
      onChannelStatus(status, debate);
    }
  });
}

function createChannel(id, onCreateChannel) {
}

function broadcastChannels() {
  var broadcastInterval = setInterval(function sendBroadcastData() {
    // for each channel
    var i = channels.length;
    if (i > 0) {
      while (i--) {
        // for each user in that channel
        var ii = channels[i].users.length;
        if (ii > 0) {
          var values = getValues(channels[i].users);
          while (ii--) {
            // get the data out of the users array
            var iii = users.length;
            while (iii--) {
              // the user in the channel matches a user in the users array
              if (users[iii].ip === channels[i].users[ii]) {
                var now = Date.now();
                var data = {};
                var channelData = channels[i].data;
                if (channelData.type === 'channel' || (now >= channelData.start && now <= channelData.end)) {
                  data = {
                    type: 'chart',
                    other: {
                      value: values.other,
                      time: now
                    },
                    other: {
                      value: values.other,
                      time: now
                    },
                    other: {
                      value: values.other,
                      time: now
                    }
                  };
                } else if (channelData.start > now) {
                  data = {
                    type: 'timeToStart',
                    time: channelData.start - now
                  };
                } else if (channelData.end < now) {
                  var data = {
                    type: 'joined',
                    status: 'expired',
                    channelData: channelData
                  };
                }
                // send the data to that user
                users[iii].ws.send(JSON.stringify(data));
              }
            }
          }
        }
      }
    }
  }, 1000);
}

function getValues(channelUsers) {
  var values = {
    other: {
      users: 0,
      value: 0
    },
    rep: {
      users: 0,
      value: 0
    },
    dem: {
      users: 0,
      value: 0
    }
  };
  var i = channelUsers.length;
  while (i--) {
    var ii = users.length;
    while (ii--) {
      if (users[ii].ip === channelUsers[i]) {
        values[users[ii].label].value += users[ii].value;
        values[users[ii].label].users++;
      }
    }
  }
  values.other = values.other.value / values.other.users;
  values.rep = 0;
  values.dem = 0;
  
  return values;
}

function updateUserValue(ip, value) {
  var i = users.length;
  while (i--) {
    if (users[i].ip === ip) {
      users[i].value = value;
      break;
    }
  }
}