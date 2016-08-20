
/* global __dirname */

// We need to use the express framework: have a real web servler that knows how to send mime types etc.
var express = require('express');
var fs = require('fs');
var myParser = require("body-parser");
var fetch = require('node-fetch');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');

var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/presets');


// Init globals variables for each module required
var app = express()
        , http = require('http')
        , server = http.createServer(app);



// Indicate where static files are located. Without this, no external js file, no css...  


    app.use(express.static(__dirname + '/'));  
    app.use(myParser.json());
    app.use(myParser.urlencoded({extended : true}));
    
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



// routing
app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

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
           res.redirect(__dirname + '/index.html');
           console.log("Je suis là");
        }
    });
  	//console.log('body: ' + JSON.stringify(req.body));
        //res.send('POST');
        console.log("J'ai reçu cela");
        
   
        
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

    
});

app.delete('/delPreset', function (req, res) {
    //res.send('DELETE');
    var db = req.db;
    var collection = db.get('presets');
    collection.remove(req.body);
    console.log("J'ai Supprimé : " + JSON.stringify(req.body)); 
});

// launch the http server on given port
server.listen(8082);