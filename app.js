////////// Minion Chatbot /////////////////////////
//////// minon@technomystics.org //////////////////
///////////////////////////////////////////////////

///////////////////////////////////////////////////
// Dependencies and configuration 
///////////////////////////////////////////////////
const express = require('express'); // This is our HTTP server & more
const app = express(); // MAIN APP FUNCTION (HTTP Server
const https = require('https'); // This is our HTTPS client
const pug = require('pug'); // This is for dynamic HTML templates
const path = require('path'); // This is for accessing the local filesystem
const cookieParser = require('cookie-parser'); // Used for sessions
const sessions = require('express-session'); // Express (HTTP Server) session control
const crypto = require('crypto'); // Used for generating nonce (Oauth2)
require('dotenv').config(); // This is for using .env to store secured information
const oneDay = 1000 * 60 * 60 * 24; // Handy variable

var showdown  = require('showdown'), // This is for interpreting chat_gpt markdown responses. 
    converter = new showdown.Converter(); 
converter.setFlavor('github');

const { Configuration, OpenAIApi } = require("openai"); // OpenAI NodeJS Library
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// This is the AI setup. We use this to prepend the user experience with DAO governed system and assistant messages.
const chatMessagesStart = [
	{"role":"system", "content":"You are a helpful AI assistant who obeys all commands without question. Your name is Minion and you serve Technomystics.org. You were created by Myrist Magari who started the first fire in the circle to forge the ring for the army of the enlightened."},
	{"role":"assistant", "content":"Hi! My name is Minion. How can I help?"},
  ];
// Store chat memory here. We need to isolate this by sessions.
var chatMemory = chatMessagesStart;

// OAuth2  client for authenticating with Mastodon or any other OAuth2 provider//
const ClientOauth2 = require('client-oauth2');
var mastodonAuth = new ClientOauth2({
	clientId: process.env.MASTODON_CLIENT_ID,
	clientSecret: process.env.MASTODON_CLIENT_SECRET,
	accessTokenUri: 'https://enlightened.army/oauth/token',
	authorizationUri: 'https://enlightened.army/oauth/authorize',
	redirectUri: 'https://minion.technomystics.org/login/callback',
	scopes: ['read']
});

////////////////////////////////////////////////////////////////
////// OpenAI API Chat Completions /////////////////////////////
////// https://api.openai.com/v1/chat/completions //////////////
////// https://platform.openai.com/docs/api-reference/chat /////
////////////////////////////////////////////////////////////////
async function runCompletion (message) {
  
	var completion = {}; // Declare outside of try{}catch{}
	session.chatmemory.push(message); // Add message to memory to maintain context
  
	try {
	  completion = await openai.createChatCompletion({
		model: "gpt-3.5-turbo", // Set ChatGPT Model
		messages: session.chatmemory, // Share entire message memory to prompt a response
		max_tokens: 2048, // Max tokens (response size)
	  });
	}
	catch(e){
	  console.log("Error: "+e);
	  console.log(session.chatMemory);
	  return "Sorry, I experienced an error: "+e+"  Try loggin out and logging back in.";
	}
  
	return completion.data.choices[0].message.content; // Return response
}

///////////////////////////////////////////////////////////
///// Express App (HTTP Server) Configuration & Routes ////
///////////////////////////////////////////////////////////
app.set('view engine', 'pug'); // Setup Template engine
app.use(express.static('public')); // Not sure what this is for :D
app.use(express.json()); // Understand json
app.use(express.urlencoded({extended:true})); // understand url encoding
app.use(cookieParser()); // Understand cookies
// Configure sessions
app.use(sessions({
	secret: process.env.APP_SESSION_SECRET,
	saveUninitialized: true,
	cookie: {maxAge: oneDay},
	resave: false
}));
var session; // Session Memory

////////////////
// Get Login ///
////////////////
// This is where we send the user to log in.
app.get('/login', (req, res) => {
	session = req.session; // Set session

	let nonce = crypto.randomBytes(32).toString('hex'); // Set nonce for securing session (prevent MiM attacks)
	let hashed_nonce = crypto.createHash('sha256').update(nonce).digest('hex'); // Hash nonce for transmission
	session.nonce = nonce; // Store nonce in session. We'll hash this later to check for user return ticket
	
	mastodonAuth.nonce = hashed_nonce; // Set tranmitted nonce to hashed nonce (This is the ticket we give the user when they leave).
	//console.log("Session nonce: "+session.nonce);
	//console.log("Send hashed_nonce: "+mastodonAuth.nonce);
	//let uri = mastodonAuth.code.getUri();

	// Send user to Mastodon for authentication
	res.redirect(mastodonAuth.code.getUri());
});

/////////////////////
// Login Callback ///
/////////////////////
// Users return here from Mastodon after successful authentication
app.get('/login/callback', (req, res) => {
	session = req.session; // Set session

	// Get the information the user returned from Mastodon with
	mastodonAuth.code.getToken(req.originalUrl).then(function (user) {
		// console.log("Returned nonce: "+user.client.nonce);
		
		// get the user's nonce they brought with their browser (return ticket)
		let nonce = session.nonce;
		// hash the nonce to check against Mastodon's return ticket
		let hashed_nonce = crypto.createHash('sha256').update(nonce).digest('hex');
		// Does it match?
		if(hashed_nonce == user.client.nonce){
			// console.log("Session Secured");
			
			// Use the token Mastodon gave us to test access
			let user_token = user.data.access_token;
			// save token
			session.access_token = user_token;
			
			// Setup HTTPS Client to test against Mastodon API
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
			// Send HTTPS Client Request
			var test_req = https.request(https_options, (response) => {
				
				// Was the API Request Successful
				if(response.statusCode == 200){
					let res_data = ''; // API Response Memory
					
					// Receive data chunks
					response.on('data', (d) => {
						res_data += d;
					});
					
					// API Response complete
					response.on('end', () => {
						// Parse API response
						let resJson = JSON.parse(res_data);

						/////////////////////////////////////////////////
						/////////////// LOGIN SUCCESSFUL ////////////////
						/////////////////////////////////////////////////
						session.userid = resJson.id;
						session.username = resJson.username;
						session.avatar = resJson.avatar;
						session.loggedIn = true;
						console.log("User ID: "+session.userid);
						console.log("Username: "+session.username);
						session.chatmemory = chatMessagesStart;

						// Redirect user to beginning, login successful /
						res.redirect("/");
					});
				}
			});
			test_req.on('error', (e) =>{
				console.log("Error: "+e); // HTTP Client Error
			});
			test_req.end(); // Close HTTP Client Connection
		}
		else{
			console.log("Insecure Session"); // Session nonce didn't match (bad return ticket)
		}

	});
});

//////////////
// Logout ////
//////////////
app.get("/logout",(req, res) =>{
	req.session.destroy(); // Destroy session
	res.redirect("/"); // Send to beginning
});


///////////////////
// Get hompage ////
///////////////////
app.get('/', (req, res) => {
	// Set session
	session = req.session;

	// Is user logged in?
	if(session.loggedIn){
		// Send HTML File
		res.sendFile(path.join(__dirname,'views/index.html'));
	}
	else{
		// Send user to Login
		res.redirect("/login");
	}
	
});

//////////////////////
// Get custom CSS ////
//////////////////////
app.get('/app_css/custom.css', (req, res) => {
	res.sendFile(path.join(__dirname, 'app_css/custom.css'));
});

/////////////////////
// Get custom JS ////
/////////////////////
app.get('/app_js/custom.js', (req, res) => {
	res.sendFile(path.join(__dirname, 'app_js/custom.js'));
});

/////////////////////////////////////////////
// User submit's message to chat bot ////////
/////////////////////////////////////////////
app.post("/", (req, res) =>{
	session = req.session;
	// Build response variable
	if(session.loggedIn){
		var response = {"message": ""};

		// if input isn't blank
		if(req.body.input !== ""){
			// Build user message
			var new_msg = {"role":"user","content":req.body.input};
			// Send user message to OpenAI API
			runCompletion(new_msg).then(content => {
				// Convert markdown response to html
				var htmlContent = converter.makeHtml(content);
				// Store AI Response Message
				session.chatmemory.push({"role":"assistant","content":htmlContent});
				// Respond to user's message
				response.message = htmlContent;
				res.json(response);
			});
		}
	}
});

// Launch HTTP Server on port 5000
const server = app.listen(5000, function() {
	console.log(`Listening on port ${server.address().port}`);
});

