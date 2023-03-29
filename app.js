
// Dependencies and configuration 
const express = require('express');
const https = require('https');
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

// OAuth2.0 //
const ClientOauth2 = require('client-oauth2');
var mastodonAuth = new ClientOauth2({
	clientId: process.env.MASTODON_CLIENT_ID,
	clientSecret: process.env.MASTODON_CLIENT_SECRET,
	accessTokenUri: 'https://enlightened.army/oauth/token',
	authorizationUri: 'https://enlightened.army/oauth/authorize',
	redirectUri: 'https://minion.technomystics.org/login/callback',
	scopes: ['read']
});
const crypto = require('crypto');

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
	  return "Sorry, I experienced an error: "+e;
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
var session;

// Start login
app.get('/login', (req, res) => {
	session = req.session;

	let nonce = crypto.randomBytes(32).toString('hex');
	let hashed_nonce = crypto.createHash('sha256').update(nonce).digest('hex');
	session.nonce = nonce;
	
	mastodonAuth.nonce = hashed_nonce;
	console.log("Session nonce: "+session.nonce);
	console.log("Send hashed_nonce: "+mastodonAuth.nonce);
	let uri = mastodonAuth.code.getUri();

	// Send to Mastodon for Auth
	res.redirect(uri);
});

// login callback
app.get('/login/callback', (req, res) => {
	session = req.session;

	mastodonAuth.code.getToken(req.originalUrl).then(function (user) {
		console.log("Returned nonce: "+user.client.nonce);

		let nonce = session.nonce;
		let hashed_nonce = crypto.createHash('sha256').update(nonce).digest('hex');
		if(hashed_nonce == user.client.nonce){
			console.log("Session Secured");
			
			// Test the token returned for validity
			let user_token = user.data.access_token;
			//console.log(user);
			console.log("Access Token: "+ user_token);
			session.access_token = user_token;
			
			let auth_str = "Bearer "+user_token;
			var https_options = {
				hostname: 'enlightened.army',
				port: 443,
				path: '/api/v1/accounts/verify_credentials',
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': auth_str,
				}
			};
			var test_req = https.request(https_options, (response) => {
				console.log('statusCode: ', res.statusCode);
				//console.log('headers: ', res.headers);
				if(response.statusCode == 200){
					let res_data = '';
					response.on('data', (d) => {
						console.log("Verified:");
						res_data += d;
					});
					response.on('end', () => {
						let resJson = JSON.parse(res_data);
						//console.log(JSON.parse(res_data));
						session.userid = resJson.id;
						session.username = resJson.username;
						session.avatar = resJson.avatar;
						session.loggedIn = true;
						console.log("User ID: "+session.userid);
						console.log("Username: "+session.username);
						res.redirect("/");

					});
				}
			});
			test_req.on('error', (e) =>{
				console.log("Error: "+e);
			});
			test_req.end();

			// Once everything looks good
			/*
			if(session.loggedIn){
				console.log("Redirecting to /");
				res.redirect("/");
			}
			*/
		}
		else{
			console.log("Insecure Session");
		}

	});
});

// Logout
app.get("/logout",(req, res) =>{
	req.session.destroy();
	res.redirect("/");
});


// Get hompage
app.get('/', (req, res) => {
	
	//res.sendFile(path.join(__dirname,'views/index.html'));
	session = req.session;

	if(session.loggedIn){
		console.log("User is logged in, sending html");
		res.sendFile(path.join(__dirname,'views/index.html'));
	}
	else{
		console.log("User is not logged in, sending to /login");
		res.redirect("/login");
	}
	
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

