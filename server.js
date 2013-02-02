#!/usr/bin/nodejs
var connect = require('connect');
var http = require('http');
var app = connect();
var server = http.createServer(app);
app.use(connect.logger('dev'));
app.use(connect.static(__dirname));
console.log("Serving files from this folder, access: http://localhost:8080");
server.listen(8080);

