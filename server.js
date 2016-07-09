
/* global __dirname */

// We need to use the express framework: have a real web servler that knows how to send mime types etc.
var express=require('express');
var myParser = require("body-parser");
var fetch = require('node-fetch');

// Init globals variables for each module required
var app = express()
  , http = require('http')
  , server = http.createServer(app);



// Indicate where static files are located. Without this, no external js file, no css...  

    app.use(express.static(__dirname + '/'));  
    app.use(myParser.json());
    app.use(myParser.urlencoded({extended : true}));

// routing
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

app.post('/addPreset', function (req, res) {

    
  	console.log('body: ' + JSON.stringify(req.body));
  res.send('POST');
  console.log("J'ai reçu cela");
});

app.get('/getAllPresets', function (req, res) {
    res.send("{\"name\":\"current\",\"distoName\":\"standard\",\"boost\":false,\"LCF\":200,\"HCF\":12000,\"K1\":\"0.0\",\"K2\":\"0.0\",\"K3\":\"0.0\",\"K4\":\"0.0\",\"F1\":147,\"F2\":569,\"F3\":1915,\"F4\":4680,\"Q1\":\"0.0\",\"Q2\":\"49.0\",\"Q3\":\"42.0\",\"Q4\":\"11.0\",\"OG\":\"5.0\",\"BF\":\"5.0\",\"MF\":\"4.2\",\"TF\":\"3.1\",\"PF\":\"5.0\",\"EQ\":[-2,-1,0,3,-9,-4],\"MV\":\"5.8\",\"RN\":\"Fender Hot Rod\",\"RG\":\"2.0\",\"CN\":\"Vintage Marshall 1\",\"CG\":\"2.0\"} ");
});

app.put('/', function (req, res) {
  res.send("J'ai modifié");
});

app.delete('/', function (req, res) {
  res.send("J'ai supprimé ");
});

// launch the http server on given port
server.listen(8082);