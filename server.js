
/* global __dirname */

// We need to use the express framework: have a real web servler that knows how to send mime types etc.
var express=require('express');
var myParser = require("body-parser");

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

app.post('/listAllPresets', function (req, res) {
    console.log(req.body.data);
    
  	console.log('body: ' + JSON.stringify(req.body));
  res.send('response send');
  console.log("J'ai reçu cela");
});


app.put('/', function (req, res) {
  res.send("J'ai modifié");
});

app.delete('/', function (req, res) {
  res.send("J'ai supprimé ");
});

// launch the http server on given port
server.listen(8082);