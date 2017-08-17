'use strict';

//
// Get the API host and session ID and run from the command line. For example,
//
//   node createDocsAndFolders.js hostname s%3Asls3VeZJA3yS5KdnNXHY_PuXVB1TxTND.TIB3XwtrJBjlvaWnsJEcfaMKVtMm5TFWAi8YUEcN910
//


var Promise      	= require('es6-promise').Promise;
var RequestRetry 	= require('requestretry');
var _            	= require('lodash');
var fs 						= require('fs');
var argv 					= require('minimist')(process.argv.slice(2));

var limit 				= argv.l ? argv.l : -1;
var port 					= argv.p ? argv.p : 3000;
var projectId 		= port === 3008 ? "59946144f46a44bc42e65032" : "598b7f349c88de8cd28943c6";
var host 					= argv.h ? argv.h : 'localhost';
var sessionId 		= argv.s ? argv.s : 's%3Aynx6LzrMcaAmF_Dw3P255o8H2fLx8no5.RjFsh122AW0XV9%2FGT6lartGK9AuWKR%2BXZ4sV3faO2k0';
var apiHost 			= 'http://' + host + ":" + port;
var cookie  			= 'sessionId=' + sessionId;
// var test    = process.argv[4] === 'test';
// test = true;

var template = fs.readFileSync("folder.template", 'utf8');


console.log('Creating Docs and Folders');
console.log('--------------------------');
console.log(argv);
console.time("addFolders");

var api = function(url, type, name, body) {
	return new Promise(function(resolve, reject) {
		RequestRetry({
			url           : apiHost + '/api/' + url,
			method        : 'PUT',//body ? 'POST' : 'PUT',
			body          : body || {},
			json          : true,
			maxAttempts   : 25,
			retryDelay    : 5000,
			retryStrategy : RequestRetry.RetryStrategies.HTTPOrNetworkError,
			headers       : {
				'User-Agent' : 'request',
				'Cookie'     : cookie
			}
		}, function(err, res, body) {
			var description = type + ' "' + name + '"';
			var msg;
			if (err) {
				msg = (': Error adding ' + description + err + ' ' + url);
				// On error we don't reject because that only stops this process' monitoring of the results./
				// The API calls have been made and responses will come back so resolve with the error message.
				resolve(msg);
			} else if (res.statusCode != 200) {
				msg = body && body.message ? body.message : res.statusMessage;
				msg = (': ' + res.statusCode + ' '  + msg + ' while adding ' + description + ' ' + url );
				// console.log(msg);
				resolve(msg);
			} else if (!body) {
				msg = (': Failed to add ' + description + ' ' + url);
				// console.log(msg);
				resolve(msg);
			} else {
				msg = (': Successfully added ' + description + ' ' + url);
				resolve(msg);
			}
		});
	});
}


var doFolders = function(projectId) {
	var folders = [];
	//var folders = require(test ? './test_folders.json' : './folders.json');
	var rawData = fs.readFileSync("folders.data", 'utf8');
	// data is from the folder query.
	rawData = rawData.replace(/\"_id\".*/g, "");
	rawData = rawData.replace(/}\n{/g, "},\n{");
	rawData = '[' + rawData + ']';
	var cnt = 0;
	var objs = JSON.parse(rawData);
	_.forEach(objs, function(obj) {
		var folder = {
			id : obj.directoryID,
			parentId : obj.parentID,
			name: obj.displayName.substring(0,40),
			project : projectId
		};
		folders.push(folder);
	});


	function groupByArray(xs, key) {
		return xs.reduce(function (rv, x) {
			var v = key instanceof Function ? key(x) : x[key];
			var el = rv.find(function (r) {
						return r && r.key === v
					}
			);
			if (el) {
				el.values.push(x);
			} else {
				rv.push({key: v, values: [x]});
			}
			return rv;
		}, []);
	}

	var groups = groupByArray(folders, 'parentId');
	groups.sort(function(a,b) {
		return a.key - b.key;
	});
	console.log('grouped ', groups);

	return groups.reduce (function (current, code) {
		return current.then (function () {
			// console.log ('++ add activity ', code);
			return self.addActivity (m, code);
		});
	}, Promise.resolve());



	folders.sort(function(a,b) {
		return a.id - b.id;
	});
	if (limit > 0)
		folders = folders.slice(0,limit);
	console.log("Create promises")

	var promises = _.map(folders, function (folder) {
		var body = {foldername: folder.name};
		var url = 'project/'+projectId+'/directory/add/'+ folder.parentId;
		//console.log(folder.id, folder.parentId, folder.name);
		return api(url, 'folder', folder.name, body);
	});
	//return Promise.all(promises);
};

// ---
// Run
// ---

/*
mongo localhost/esm-prod --quiet folders.query.txt > folders-raw.data
 */





doFolders(projectId)
.then(function(results) {
	console.log("Done", results);
	console.timeEnd("addFolders");
})
.catch( function(errs) {
	console.log("Fails", errs);
	console.log("Finish");
});
