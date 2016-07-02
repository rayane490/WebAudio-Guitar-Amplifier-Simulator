
/* global __dirname */

// We need to use the express framework: have a real web servler that knows how to send mime types etc.
var express=require('express');

// Init globals variables for each module required
var app = express()
  , http = require('http')
  , server = http.createServer(app);

// launch the http server on given port
server.listen(8082);

// Indicate where static files are located. Without this, no external js file, no css...  

    app.use(express.static(__dirname + '/'));    


// routing
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

app.post('/', function (req, res) {
  
  res.send('POST request to homepage');
  console.log("j'ai reçu cela");
});

app.put('/', function (req, res) {
  res.send('PUT request to homepage');
});

app.delete('/', function (req, res) {
  res.send('DELETE request to homepage');
});