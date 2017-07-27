'use strict';
var etl = require('./etlHelper');

var host = "localhost";
var db = "esm";
var username = "";
var password = "";
var authSource = "";
var connectionString = etl.composeConnectString(host, db, username, password, authSource);

var callback = function (db, collection, document) {
	return new Promise(function (resolve, reject) {
		var permissions = db.collection('_permissions');
		var id = document._id.toString();

		permissions.find({resource: id}).count()
		.then( function (cnt){
			if(cnt === 0) {
				console.log('Search perms for doc id ' + document._id + ' found cnt ' + cnt);
			}
			document.processed = true;
			document.permissions = cnt;
			collection.update({_id: document._id}, {$set: document}, function (err, result) {
				//console.log(document);
				if (err)
					return reject(err);
				return resolve(document);
			});

		})
	});
};

console.log("Starting ETL.");

var query1 = {processed: false };
etl.runETL(connectionString,'docs', query1, callback)
.then(function (results) {
	//console.log(results);
});

