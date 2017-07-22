/**
 * Script to fill empty document display and file name fields with the original file name.
 */
'use strict';
var etl = require('./etlHelper');

var host = "localhost";
var db = "esm";
var username = "";
var password = "";
var authSource;

// sample setting to connect to prod from a pod on prod.
// oc rsh <a pod on prod>
// .. adjust the following and run.
// host = "172.50.11.87";
// username = "";
// password = "";

var connectionString = etl.composeConnectString(host, db, username, password, authSource);

var query1 = { $or: [ {displayName: {$eq: null}}, {displayName: {$eq: ''}} ] };

console.log("Starting Ping.");

etl.pingTest(connectionString,'documents', query1);

