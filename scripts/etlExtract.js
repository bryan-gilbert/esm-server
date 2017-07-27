'use strict';
var etl = require('./etlHelper');

var host = "localhost";
var db = "esm";
var username = "";
var password = "";
var authSource = "";
var connectionString = etl.composeConnectString(host, db, username, password, authSource);


// db.docs.find({permissions : {$eq:0}})
var query = {permissions : {$eq:0}};
var fields = {_id:1, displayName: 1, project: 1};
etl.runExtract(connectionString,'docs', query, fields)
.then(function (results) {
	console.log(results);
});

