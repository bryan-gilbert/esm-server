var fs = require('fs');
var _ = require('lodash');

var template = fs.readFileSync("folder.template", 'utf8');
var projectId = "someProjectId";

/*
mongo localhost/esm-prod --quiet folders.query.txt > folders-raw.data
 */


fs.readFile("folders.data", 'utf8', function (err, data) {
	// data is from the folder query.
	data = data.replace(/\"_id\".*/g, "");
	data = data.replace(/}\n{/g, "},\n{");
	console.log(data.length);
	data = '[' + data + ']';
	var objs = JSON.parse(data);
	console.log(objs[1].displayName);
	_.forEach(objs, function(obj) {
		var folder = template.replace('%displayName%', obj.displayName);
		folder = folder.replace('%DirectoryId%', obj.directoryID);
		folder = folder.replace('%ParentId%', obj.parentID);
		folder = folder.replace('%projectId%', projectId);
		console.log(folder);
	})
});
