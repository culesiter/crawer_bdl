const express = require('express');
const app = express(); 
const myController = require('./controller/index');
const port = 8080;
const request = require('request-promise');


app.get('/craw', function(req, res){ 
	myController.crawers_2(req, res);
})
app.get('/merge', function(req, res){ 
	myController.mergeJsonFiles(res);
})

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});