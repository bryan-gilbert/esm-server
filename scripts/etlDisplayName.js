/**
 * Script to fill empty document display and file name fields with the original file name.
 * This script was run on MEM-ADMIN Test and Prod July 7, 2017
 */
'use strict';
var etl = require('./etlHelper');

var host = "localhost";
var db = "esm";
var username = "";
var password = "";
var authSource = "";

// sample setting to connect to prod from a pod on prod.
// do a db backup first
// oc rsh mongo-pod
//mongodump --authenticationDatabase=admin -db=esm  --username=admin --password=xxxx
// then oc rsh another pod .. adjust the following and run.
// host = "172.50.11.87";
// username = "admin";
// password = "xxxx";
// authSource = "admin";

var connectionString = etl.composeConnectString(host, db, username, password, authSource);

var query1 = {};
var callback1 = function (document) {
	return new Promise(function (resolve, reject) {
		document.displayName = document.internalOriginalName;
		return resolve(document);
	});
};

var query2 = { $or: [ {documentFileName: {$eq: null}}, {documentFileName: {$eq: ''}} ] };
var callback2 = function (document) {
	return new Promise(function (resolve, reject) {
		document.documentFileName = document.internalOriginalName;
		return resolve(document);
	});
};

console.log("Starting ETL.");

etl.runUpdate(connectionString,'documents', query1, callback1);

etl.runUpdate(connectionString,'documents', query2, callback2);

