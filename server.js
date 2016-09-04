
/* global __dirname */

// We need to use the express framework: have a real web servler that knows how to send mime types etc.
var express = require('express');
var fs = require('fs');
var myParser = require("body-parser");
var fetch = require('node-fetch');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var LocalStrategy = require('passport-local').Strategy;
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/presets');
var passport = require('passport');

// Init globals variables for each module required
var app = express()
        , http = require('http')
        , server = http.createServer(app);



// Indicate where static files are located. Without this, no external js file, no css...  


    app.use(express.static(__dirname + '/'));  
    app.use(myParser.json());
    app.use(myParser.urlencoded({extended : true}));
     var session = require('express-session');
    app.use(session({secret: "testwebaudio"}));
    app.use(passport.initialize());
    app.use(passport.session()); 
// Make our db accessible to our router
    app.use(function(req,res,next){
    req.db = db;
    next();
    });

//Mongodb
/*var url = 'mongodb://localhost:27017/test';
MongoClient.connect(url, function(err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to server.");
  db.close();
});*/
var Users = db.get('users');

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(new LocalStrategy(
  function(username, password, done) {
   

	  Users.findOne({'username':username},
		function(err, user) {
			if (err) { return done(err); }
			if (!user) { return done(null, false); }
			if (user.password != password) { return done(null, false); }
			return done(null, user);
		});
    
  }
));

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
}


// routing
app.get('/', passport.authenticate('local', {
    successRedirect: '/home',
    failureRedirect: '/auth'
  }));

app.post('/addPreset', function (req, res) {


   var db = req.db;
    var collection = db.get('presets');
    
    // Submit to the DB
    collection.insert(req.body, function (err, doc) {
        if (err) {
            // If it failed, return error
            res.send("There was a problem adding the information to the database.");
        }
        else {
            // And forward to success page
           // res.redirect(__dirname + '/index.html');
           
           console.log(req.body);
        }
    });
  	//console.log('body: ' + JSON.stringify(req.body));
        //res.send('POST');
        console.log("J'ai reçu cela");
        res.redirect('/');
   
        
});

app.get('/getAllPresets', function (req, res) {
   // res.sendfile(__dirname + '/allPresets.json');
   
    var db = req.db;
    var collection = db.get('presets');
    collection.find({},{},function(e,docs){
       // console.log(docs);
        res.send(docs);
        //res.render(docs);
    });
});

app.put('/updatePreset', function (req, res) {
    var db = req.db;
    var collection = db.get('presets');
    var parsedCollec = req.body;
    var name = parsedCollec["name"];
    collection.update({"name" : name}, {$set : req.body } );
    console.log("J'ai modifié " + name + " : " + JSON.stringify(req.body)); 
    res.redirect('/');
    
});

app.delete('/delPreset', function (req, res) {
    //res.send('DELETE');
    var db = req.db;
    var collection = db.get('presets');
    collection.remove(req.body);
    console.log("J'ai Supprimé : " + JSON.stringify(req.body));
    res.redirect(__dirname + '/');
});

app.get('/auth', function(req, res, next) {
  res.sendfile(__dirname + '/auth.html');
});

app.get('/home',isAuthenticated, function(req, res) {
  res.sendfile(__dirname + '/home.html');
});

app.get('/loginFailure' , function(req, res, next){
	res.send('Failure to authenticate');
});

app.get('/loginSuccess' , function(req, res, next){
	res.send('Successfully authenticated');
});

app.post('/login',
  passport.authenticate('local', {
    successRedirect: '/home',
    failureRedirect: '/loginFailure'
  }),function(req, res){
	console.log(res.user.username);
});
  
/* Handle Logout */
app.get('/signout', function(req, res) {
  req.logout();
  console.log("out");
  res.redirect('/');
});
// launch the http server on given port
server.listen(8082);