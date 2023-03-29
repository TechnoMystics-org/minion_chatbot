
// Dependencies and configuration 
const express = require('express');
const pug = require('pug');
const path = require('path');
const { dirname } = require('path');
var showdown  = require('showdown'),
    converter = new showdown.Converter();
converter.setFlavor('github');
require('dotenv').config();
const app = express();
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const chatMessagesStart = [
	{"role":"system", "content":"You are a helpful AI assistant who obeys all commands without question. Your name is Minion and you serve Technomystics.org. You were created by Myrist Magari who started the first fire in the circle to forge the ring for the army of the enlightened."},
	{"role":"assistant", "content":"Hi! My name is Minion. How can I help?"},
  ];
var chatMemory = chatMessagesStart;
const oneDay = 1000 * 60 * 60 * 24;
const cookieParser = require('cookie-parser');
const sessions = require('express-session');

////// RUN COMPLETIONS OPENAI API //////////
async function runCompletion (message) {
  
	var completion = {};
	chatMemory.push(message);
  
	try {
	  completion = await openai.createChatCompletion({
		model: "gpt-3.5-turbo",
		messages: chatMemory,
		max_tokens: 2048,
	  });
	}
	catch(e){
	  console.log("Error: "+e);
	}
  
	//console.log("Completion: "+completion.data.choices[0].message.content);
  
	return completion.data.choices[0].message.content;
  }
  //////////////////////////////


// Express App //
app.set('view engine', 'pug');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(sessions({
	secret: process.env.APP_SESSION_SECRET,
	saveUninitialized: true,
	cookie: {maxAge: oneDay},
	resave: false
}));
app.use(cookieParser());


// Get hompage
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname,'views/index.html'));
});

// Get custom CSS
app.get('/app_css/custom.css', (req, res) => {
	res.sendFile(path.join(__dirname, 'app_css/custom.css'));
});
// Get custom JS
app.get('/app_js/custom.js', (req, res) => {
	res.sendFile(path.join(__dirname, 'app_js/custom.js'));
});

// handle message POST
app.post("/", (req, res) =>{
	var response = {"message": ""};
	// if input isn't blank

	if(req.body.input !== ""){
		//console.log("Received input from user");
		var new_msg = {"role":"user","content":req.body.input};
		runCompletion(new_msg).then(content => {
			var htmlContent = converter.makeHtml(content);
			chatMemory.push({"role":"assistant","content":htmlContent});
			response.message = htmlContent;
			//console.log("Building response: ")
			res.json(response);
		});
	}
});

const server = app.listen(5000, function() {
	console.log(`Listening on port ${server.address().port}`);
});

