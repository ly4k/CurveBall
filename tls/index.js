const app = require('express')();
const https = require('https');
const fs = require('fs');

//GET home route
app.get('/', (req, res) => {
     res.send('<center>Hello World</center>');
});

https.createServer({
    key: fs.readFileSync('./cert.key'),
    cert: fs.readFileSync('./cert.crt'),
    ca: [
        fs.readFileSync('./spoofed_ca.crt')
    ]
}, app)
.listen(8080);