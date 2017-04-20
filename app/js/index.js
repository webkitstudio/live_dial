var app = {

  hosts: {
    socket: 'ws://project-name.herokuapp.com',
    server: 'http://project-name.herokuapp.com/api'
  },

  initialize: function() {
    $(document).on('deviceready', this.onDeviceReady);
  },
  
  /* event listeners */
  
  bindEvents: function() {
    $('#bottomMenu .button:not([rel="more"])').on('click', this.menuNavigate);
    $('#bottomMenu .button[rel="more"]').on('click', this.toggleMore);
    $('.app').on('click', this.removeMore);
  },
  
  onDeviceReady: function() {
    $.Mustache.addFromDom();
    app.setupRoutes();
    app.bindEvents();
    
    // if route not set, direct to debates
    if (window.location.hash.length === 0) {
      app.showDebates();
    }
  },
  
  /* menu functions */
  
  menuNavigate: function() {
    var path = this.getAttribute('rel');
    routie(path);
  },
  
  toggleMore: function() {
    $(this).find('.moreMenu').toggleClass('show');
  },
  
  removeMore: function(e) {
    if ($(e.target).closest('.button[rel="more"]').length === 0) {
      if ($('.moreMenu').hasClass('show')) {
        $('.moreMenu').removeClass('show');
      }
    }
  },
  
  /* routes */
  
  setupRoutes: function() {
    var routes = {
      ':path' : function(path) {
        if ($('body').hasClass('modalOpen')) {
          $('body').removeClass('modalOpen');
          $('#modal').empty();
        }
        $('.button.active').removeClass('active');
        $('.button[rel="' + path + '"]').addClass('active');
        app[path].init();
      },
      'debate/:id': function(id) {
        $('#content').empty().mustache('templateLoading');
        app.debate.init(id);
      },
      'profile': function() {
        $('#content').empty().mustache('templateLoading');
        app.profile.init();
      }
    };
    routie(routes);
  },
  
  /* api handler */
  
  api: {
    get: function(query, callback) {
      $.ajax({
        method: 'get',
        url: app.hosts.server + query,
        error: function(error) {
          $("#content").html("error: " + error.msg);
        },
        success: function(data) {
          callback(JSON.parse(data));
        }
      });
    },
    post: function(query, callback) {
      $.ajax({
        method: 'post',
        url: 'path/to/api/' + query,
        always: callback
      });
    },
    connect: function(id, onJoinedChannel) {
      var ws = new WebSocket(app.hosts.socket);
      app.socket.ws = ws;
      
      ws.onopen = function(event) {
        app.socket.join(id);
        
        ws.onmessage = function (event) {
          var data = JSON.parse(event.data);
          switch (data.type) {
          case 'joined':
            switch (data.status) {
            case 'active':
              onJoinedChannel(data);
              break;
            case 'scheduled':
              onJoinedChannel(data);
              break;
            case 'expired':
              onJoinedChannel(data);
              break;
            }
            break;
          case 'chart':
            if (app.debate.scheduled) {
              app.debate.initComponents();
            }
            app.chart.timelines.other.markers.push({
              value: data.other.value,
              time: Date.now()
            });
            app.chart.renderTimelines();
            break;
          case 'timeToStart':
            app.debate.renderTimeToStart(data.time);
            break;
          }
        };
      };
      
      ws.onclose = function(event) {
        clearInterval(app.sendDialValueInterval);
      };
    }
  },
  
  /* socket api */
  
  socket: {
    ws: null,
    connect: function() {
    },
    disconnect: function() {
    },
    join: function(id) {
      var data = {
        type: 'join',
        id: id
      };
      app.socket.send(data);
    },
    send: function(data) {
      try {
        app.socket.ws.send(JSON.stringify(data));
      } catch(error) {
        console.log(error);
      }
    },
    receive: function() {
    }
  },
  
  /* loading screen */
  
  loading: function() {
    $('#content').empty().mustache('templateLoading');
  },
  
  /* show page events */
  
  debates: {
    init: function() {
      app.loading();
      app.api.get('/debates', app.debates.render);
    },
  
    render: function(data) {
      var channels = [];
      var debates = [];
      
      $(data).each(function(i, el){
        if (this.type === "debate") {
          if (app.helpers.withinTimeRange(this.start, this.end)) {
            this.statusClass = "inProgress";
            this.status = "In Progress";
          } else {
            this.statusClass = "scheduled";
            this.status = "Scheduled";
          }
          debates.push(this);
        } else {
          channels.push(this);
        }
      });
      
      $('#content').empty().mustache('templateDebateListings');
      $('#debateListings').mustache('templateDebateListing', {items: debates});
      $('#channelListings').mustache('templateDebateListing', {items: channels});
      $('.debateListing').on('click', app.showDebate);
    }
  },
  
  debate: {
    scheduled: false,
    
    init: function(id) {
      // connect client to server where room === id
      // on error, say couldn't connect and why (error or not currently a session)
      app.api.connect(id, function onJoinedChannel(data) {
        app.debate.render(data);
      });
    },
    
    render: function(data) {
      $('body').attr('class', '');
      $('body').addClass('modalOpen');
      $('#content').empty().mustache('templateDebateModal', data.channelData);
      $('.closeButton').on('click', app.debate.closeDebate);
//       $('.filterSection').on('click', app.filters.toggle);

      switch(data.status) {
      case 'active':
        app.debate.initComponents();
        break;
      case 'scheduled':
        app.debate.scheduled = true;
        $('body').addClass('scheduled');
        break;
      case 'expired':
        $('body').addClass('expired');
        setTimeout(function(){
          if ($('body').hasClass('expired')) {
            app.debate.closeDebate();
          }
        }, 5000);
        break;
      }
    },
    
    renderTimeToStart: function(time) {
      $('.timeToStart .time').html('Debate starts ' + moment(0).to(time));
    },
    
    initComponents: function() {
      app.debate.scheduled = false;
      $('body').addClass('active');
      $('.waypoint').on('click', app.onWaypointClicked);
      app.createDraggable('dial');
      app.createSmoothie('chart');
      app.createSendDialValueInterval();
    },
    
    closeDebate: function() {
      app.socket.ws.close();
      app.showDebates();
    }
  },
  
  createSendDialValueInterval: function() {
    app.sendDialValueInterval = setInterval(app.sendDialValue, 1000);
  },
  
  sendDialValue: function() {
    var data = {
      type: 'dial',
      value: (1 / 268 * (app.dial.rotation + 134)).toFixed(2)
    };
    app.socket.send(data);
  },
  
  archive: {
    // get /api/upcoming
    // if no results show message
    // else
    // get template, loop through results and render to app
    init: function() {
    }
  },
  
  polls: {
    // get /api/polls
    // show chart and options to cast vote post /api/vote/token/candidate_id
    init: function() {
      app.polls.render();
    },
    
    render: function() {
      $('#content').empty().mustache('templatePolls');
    }
  },
  
  profile:  {
    init: function() {
      app.profile.getUserInfo();
      
    },
    getUserInfo: function() {
      var party = localStorage.getItem('party');
      var data = {};
      if (party === null) {
        data.other = 'selected';
      } else {
        data[party] = 'selected';
      }
      // look in local storage for info
      app.profile.render(data);
    },
    saveParty: function(party) {
      localStorage.setItem('party', party);
    },
    toggleRadio: function(e) {
      var selectedOption = $(this).find('label').attr('for');
      $('.form .radioItem.selected').removeClass('selected');
      $(this).addClass('selected');
      app.profile.saveParty(selectedOption);
    },
    render: function(data) {
      $('#content').empty().mustache('templateProfile', data);
      $('.form .radioItem').on('click', app.profile.toggleRadio);
    }
  },
  
  settings: {
    init: function() {
    }
  },
  
  help: {
    init: function() {
    }
  },
  
  /* app methods */
    
  showDebate: function() {
    routie('debate/' + this.id);
  },
    
  showDebates: function() {
    routie('debates');
  },
  
  createDraggable: function(id) {
    Draggable.create('#' + id, {
      type: 'rotation', 
      throwProps: true,
      bounds: {
        minRotation: -134, 
        maxRotation: 134
      },
      onClick: app.onDialClick
    });

    app.dial = Draggable.get('#' + id);
  },
  
  onWaypointClicked: function() {
    var value = $(this).data().value;
    var rotation = (value * 67 - 134);
    TweenLite.to('#dial', 0.3, {rotation: rotation});
    app.dial.update();
    app.dial.rotation = rotation;
  },
  
  onDialClick: function(e) {
    var event = (typeof e.changedTouches !== 'undefined') ? e.changedTouches[0] : e;
    
    var diameter = $('#dial').width();
    
    var container = {
      x: $('#dialContainer').offset().left,
      y: $('#dialContainer').offset().top,
      h: $('#dialContainer').width(),
      w: $('#dialContainer').width()
    };
    
    var offset = {
    	x: event.pageX - (container.x + (container.w / 2)),
      y: (container.y + (container.h * 0.2) + (diameter / 2)) - event.pageY
    };
    
    var start = {
      x: 0,
      y: Math.abs(dist(0, 0, offset.x, offset.y))
    };
        
    var radians = angle(start.x, start.y, offset.x, offset.y);
    
    var degrees = radians * (180 / Math.PI * 2);
    
    if (degrees > 180) {
      degrees -= 360;
    }
    
    degrees *= -1;
    
    if (Math.abs(degrees) > 134) {
      if (degrees < 0) {
        degrees = -134;
      } else {
        degrees = 134;
      }
    }
    
    TweenLite.to('#dial', 0.3, {rotation: degrees});
    app.dial.update();
    app.dial.rotation = degrees;
    
    function dist(x1, y1, x2, y2) {
      var a = x1 - x2;
      var b = y1 - y2;
      var c = Math.sqrt(a * a + b * b);
      return c;
    }

    function angle( x1, y1, x2, y2 ) {
      var	dx = x1 - x2,
      dy = y1 - y2;
      return Math.atan2(dy, dx);
    }
  },
  
  chart: {
    smoothie: null,
    timelines: {},
    renderTimelines: function renderTimelines() {
      // other
      var other = app.chart.timelines.other;
      var time = other.markers[other.markers.length - 1].time + 1000;
      var value = other.markers[other.markers.length - 1].value;
      other.timeline.append(time, value);
    }
  },
  
  createSmoothie: function(id) {
    var verticalSections = 6;
    
    $('#' + id).attr('width', $(window).width() - 60);
    
    var height = $(window).height() - 460;
    if (height > 160) {
      height = 160;
    } else if (height < 80) {
      height = 80;
    }
    
    if (height > 120) {
      verticalSections = 8;
    }
    
    $('#' + id).attr('height', height);
  
    app.chart.smoothie = new SmoothieChart({
      grid: {
        fillStyle: '#ddd',
        strokeStyle: '#cdcdcd',
        verticalSections: verticalSections,
        sharpLines: true
      },
      borderVisible: false,
      millisPerPixel: 60,
      yRangeFunction: app.helpers.myYRangeFunction,
      labels: {
        disabled: true
      }
    });
    app.chart.smoothie.streamTo(document.getElementById(id), 100);
  
    // Data
    app.chart.timelines.other = {
      timeline: new TimeSeries(),
      markers: []
    };
    
    app.chart.smoothie.addTimeSeries(app.chart.timelines.other.timeline, {
      lineWidth: 2,
      strokeStyle: '#e51b23'
    });
    
    var userLine = new TimeSeries();
    
    // Add a random value to each line every second
    setInterval(function() {
      userLine.append(new Date().getTime() + 1000, Math.random());
    }, 1000);
    
    app.chart.smoothie.addTimeSeries(userLine, {
      lineWidth: 2,
      strokeStyle: '#888'
    });
  },
  
  filters: {
    options: ['none', 'party'],
    currentOption: 0,
    toggle: function() {
      app.filters.currentOption = (app.filters.currentOption + 1) % app.filters.options.length;
      var filter = app.filters.options[app.filters.currentOption];
      $('.filters.show').removeClass('show');
      $('.filters[rel="' + filter + '"]').addClass('show');
    }
  },
  
  /* helpers */
  
  helpers: {
    withinTimeRange: function(start, end) {
      var now = new Date().getTime(); // replace with server time
      var beforeEnd = (end - now > 0);
      var afterStart = (now - start > 0);
      var inRange = (beforeEnd && afterStart);
      return inRange;
    },
  
    myYRangeFunction: function(range) {
      // TODO implement your calculation using range.min and range.max
      var min = -0.1;
      var max = 1.1;
      return {min: min, max: max};
    }
  }
};

app.initialize();