'use strict';

var express = require('express');

var app = express();

// serve static content from folder
app.use(express.static('public'));

// Start the app by listening on <port>
app.listen(3001, function () {
	console.log('Server started on port 3001 serving content from public folder.');
});



