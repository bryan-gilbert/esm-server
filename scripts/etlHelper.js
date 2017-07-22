/**
 * ETL helper.
 * Usage
 * var etl = require('./etlHelper');
 * var connectionString = etl.composeConnectString(host, db, username, password, authSource);
 * etl.runUpdate(connectionString, collectionName, query, updateDocCallback);
 */
'use strict';
var MongoClient = require('mongodb').MongoClient;
var LIMIT = 2000;

// Is this needed for invalid certs?
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
process.on('unhandledRejection', function (error, promise) {
	console.error("UNHANDLED REJECTION", error, error.stack);
	process.exit(1);
});
process.on('uncaughtException', function (error) {
	console.error("UNCAUGHT EXCEPTION", error, error.stack);
	process.exit(1);
});


module.exports = {
	composeConnectString: composeConnectString,
	runUpdate: runUpdate,
	runExtract: runExtract,
	runETL: runETL,
	pingTest: pingTest
};

/*
 Run batches of size LIMIT until there are no more records that match the query.
 */
function runETL(connectionString, collectionName, query, callback) {
	return batchETL(connectionString, collectionName, query, callback)
	.then(function (cnt) {
		if (cnt > 0) {
			runETL.bind(null)(connectionString, collectionName, query, callback);
		} else {
			console.log("Done ETL for query ", JSON.stringify(query));
		}
	})
}

function batchETL(connectionString, collectionName, query, callback) {
	var qStr = JSON.stringify(query);
	return new Promise(function (resolve, reject) {
		MongoClient.connect(connectionString, function (err, db) {
			if (err) {
				return reject(err);
			}
			var collection = db.collection(collectionName);
			// first check there are records because cursor.forEach() hangs on empty result sets.
			collection.find(query).count()
			.then(function (cnt) {
				if (cnt === 0) {
					console.log("No results for query ", qStr);
					db.close();
					return resolve(0);
				} else {
					//console.log("ETL batch ", qStr);
					var pending = 0;
					var cursor = collection.find(query).limit(LIMIT).forEach(function (document) {
						pending++;
						callback(db, collection, document)
						.then(function (result) {
							pending--;
							if (pending === 0) {
								// exit for each .. we're done .. return count of remaining records
								collection.find(query).count()
								.then(function (cnt) {
									console.log("Done ETL batch   ", qStr, " remaining cnt: ", cnt);
									db.close();
									return resolve(cnt);
								})
							}
						});
					});
				}
			});
		});
	});
}

/*
 Run the update on a set of documents. Returns (promise) the count of remaining records needing update.
 */
function runExtract(connectionString, collectionName, query, fields) {
	var qStr = JSON.stringify(query);
	return new Promise(function (resolve, reject) {
		MongoClient.connect(connectionString, function (err, db) {
			if (err) {
				return reject(err);
			}
			var collection = db.collection(collectionName);
			collection.find(query, fields).toArray( function(err,results) {
				db.close();
				return resolve(results);
			})
		});
	});
}

function composeConnectString(host, db, username, password, authSource) {
	var connectionString = "mongodb://";
	if (username.length>0) {
		connectionString += username + ":" + password + "@";
	}
	connectionString += host + ":27017/" + db;
	if (authSource) {
		connectionString += "?authSource=" + authSource;
	}
	return connectionString;
}

function pingTest(connectionString, collectionName, query) {
	var qStr = JSON.stringify(query);
	console.log("Try connection with ", connectionString);
	return new Promise(function (resolve, reject) {
		MongoClient.connect(connectionString, function (err, db) {
			if (err) {
				return reject(err);
			}
			console.log("connected ... next try query");
			var collection = db.collection(collectionName);
			// first check there are records because cursor.forEach() hangs on empty result sets.
			collection.find(query).count()
			.then(function (cnt) {
					console.log("Query resulted found " + cnt + " records");
					db.close();
					return resolve(0);
			});
		});
	});
}

/*
 Run batches of size LIMIT until there are no more records that match the query.
 */
function runUpdate(connectionString, collectionName, query, updateDocCallback) {
	return batchUpdate(connectionString, collectionName, query, updateDocCallback)
	.then(function (cnt) {
		if (cnt > 0) {
			runUpdate.bind(null)(connectionString, collectionName, query, updateDocCallback);
		} else {
			console.log("Done ETL for query ", JSON.stringify(query));
		}
	})
}

/*
 Run the update on a set of documents. Returns (promise) the count of remaining records needing update.
 */
function batchUpdate(connectionString, collectionName, query, updateCallback) {
	var qStr = JSON.stringify(query);
	return new Promise(function (resolve, reject) {
		MongoClient.connect(connectionString, function (err, db) {
			if (err) {
				return reject(err);
			}
			var collection = db.collection(collectionName);
			// first check there are records because cursor.forEach() hangs on empty result sets.
			collection.find(query).count()
			.then(function (cnt) {
				if (cnt === 0) {
					console.log("No results for query ", qStr);
					db.close();
					return resolve(0);
				} else {
					console.log("Update batch ", qStr);
					var pending = 0;
					var cursor = collection.find(query).limit(LIMIT).forEach(function (document) {
						pending++;
						updateCallback(document)
						.then(function (d) {
							collection.update({_id: d._id}, {$set: d}, function (err, result) {
								if (err) {
									db.close();
									return reject(err);
								}
								pending--;
								if (pending === 0) {
									// exit for each .. we're done .. return count of remaining records
									collection.find(query).count()
									.then(function (cnt) {
										console.log("Done batch   ", qStr, " remaining cnt: ", cnt);
										db.close();
										return resolve(cnt);
									})
								}
							});
						})
					});
				}
			});
		});
	});
}
