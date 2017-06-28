var debug = require('debug')('dartapp:main');

var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var server = require('http').createServer(app);  
var io = require('socket.io')(server);


var helper = require('./helpers.js');

// Register all the routes
var matchController = require('./controller/match_controller');
var cakeController = require('./controller/owes_controller');
var playerController = require('./controller/player_controller');
app.use('/match', matchController);
app.use('/cake', cakeController);
app.use('/player', playerController)

app.use(bodyParser.json()); // Accept incoming JSON entities
app.set('view engine', 'pug');
app.use(express.static('public'));

/** Entry point for application, main route */
app.get('/', function (req, res, next) {
  var Player = require('./models/Player');
	Player.fetchAll().then(function(players) {
		res.render('index', { players: players.serialize() });
	})
  .catch(function(err) {
    helper.renderError(res, err);
	});
});

// Catch all route used to display custom 404 page
app.use(function(req, res, next){
  res.status(404);

  // respond with html page
  if (req.accepts('html')) {
	 res.render('404', { url: req.url });
	 return;
  }

  // respond with json
  if (req.accepts('json')) {
	 res.send({ error: 'Not found' });
	 return;
  }

  // default to plain-text. send()
  res.type('txt').send('Not found');
});

var Match = require.main.require('./models/Match');
var Score = require.main.require('./models/Score');
io.on('connection', function(client) {  
    console.log('Client connected');

    client.on('join', function(data) {
        client.emit('messages', 'Server response');
    });
    client.on('throw', function(data) {
      var body = JSON.parse(data);
      var matchId = body.matchId;

      new Score().addVisit(body, function(err, rows) {
        if (err) {
          debug('ERROR: ' + err);
          return;
        }
        new Match().setCurrentPlayer(matchId, body.currentPlayerId, body.playersInMatch, function(err, match) {
          if (err) {
            debug('ERROR: ' + err);
            return;
          }
          Score.forge()
            .where('match_id', '=', matchId)
            .fetchAll()
            .then(function (scores) {
              // Send update to client initiating the request
              client.emit('score_update', JSON.stringify(scores));
              // and all other clients listening
              client.broadcast.emit('score_update', JSON.stringify(scores));
            })
            .catch(function (err) {
              debug('ERROR: ' + err);
            });          
        });
      });
    });    
});

server.listen(3000, function () {
  debug('DartApp listening on port 3000');
});
