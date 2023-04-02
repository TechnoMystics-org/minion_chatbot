////////// Minion Chatbot /////////////////////////
//////// minon@technomystics.org //////////////////
///////////////////////////////////////////////////

///////////////////////////////////////////////////
// Dependencies and configuration 
///////////////////////////////////////////////////
const express = require('express'); // This is our HTTP server & more
const app = express(); // MAIN APP FUNCTION (HTTP Server
const https = require('https'); // This is our HTTPS client
const path = require('path'); // This is for accessing the local filesystem
const session = require('express-session'); // Express (HTTP Server) session control
const crypto = require('crypto'); // Used for generating nonce (Oauth2)
require('dotenv').config(); // This is for using .env to store secured information
const oneDay = 1000 * 60 * 60 * 24; // Handy variable

// Redis Store (storing session data)
const redis = require('redis');
const redisClient = redis.createClient({password: process.env.REDIS_PASSWORD});
redisClient.on('error', (err) => {
	console.log('Redis error: ', err);
});
redisClient.connect().catch(console.error);
const redisStore = require("connect-redis").default;
//const thisRedisStore = new redisStore({client: redisClient});

///////////////////////////////////////////////////////////
///// Express App (HTTP Server) Configuration & Routes ////
///////////////////////////////////////////////////////////
app.set('view engine', 'pug'); // Setup Template engine
app.use(express.static('public')); // Not sure what this is for :D
app.use(express.json()); // Understand json
app.use(express.urlencoded({extended:true})); // understand url encoding
// Configure sessions, use RedisStore
app.use(session({
	secret: process.env.APP_SESSION_SECRET,
	name: '_minon.technomystics.org',
	saveUninitialized: true,
	cookie: {maxAge: oneDay},
	resave: false,
	store: new redisStore({client: redisClient}),
}));

// showdown for interpreting markdown
var showdown  = require('showdown'), // This is for interpreting chat_gpt markdown responses. 
    converter = new showdown.Converter(); 
converter.setFlavor('github'); // GitHub flavor

const { Configuration, OpenAIApi } = require("openai"); // OpenAI NodeJS Library
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

/////////////////////////////////////
///// SET AI CONTEXT ////////////////
/////////////////////////////////////
// This is the AI setup. We use this to prepend the user experience with DAO governed system and assistant messages.
const chatMessagesStart = [
	{"role":"system", "content":"You are a helpful AI assistant who obeys all commands without question. Your name is Minion and you serve Technomystics.org. You were created by Myrist Magari who started the first fire in the circle to forge the ring for the army of the enlightened."},
	{"role":"assistant", "content":"Hi! My name is Minion. How can I help?"},
  ];

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
async function runCompletion (message, sess) {
  
	// Add the user message to the stack of messages we send to chatgpt
	// This allows the AI to maintain conversational context
	var completion = {}; // Declare outside of try{}catch{}
	sess.chatmemory.push(message); // Add message to memory to maintain context

	// Try to use the openAI API
	try {
	  completion = await openai.createChatCompletion({
		model: "gpt-4", // Set ChatGPT Model
		messages: sess.chatmemory, // Share entire message memory to prompt a response
		//max_tokens: 8000, // Max tokens (response size)
	  });
	}
	// That didn't work :(
	catch(e){
	  console.log("Error: "+e);
	  console.log(sess.chatmemory);
	  return "Sorry, I experienced an error: "+e+"  Try loggin out and logging back in.";
	}
  
	// Return the response, or error. 
	return completion.data.choices[0].message.content; // Return response
}

////////////////
// Get Login ///
////////////////
// This is where we send the user to log in.
// We give the user a ticket (nonce) to take to the login provider.
// User is required to return with the same ticket to secure the session.
// We hash the ticket to prevent plaintext transmission, securing the nonce.
app.get('/login', (req, res) => {

	let nonce = crypto.randomBytes(32).toString('hex'); // Set nonce for securing session (prevent MiM attacks)
	let hashed_nonce = crypto.createHash('sha256').update(nonce).digest('hex'); // Hash nonce for transmission
	req.session.nonce = nonce; // Store nonce in session. We'll hash this later to check for user return ticket
	
	mastodonAuth.nonce = hashed_nonce; // Set tranmitted nonce to hashed nonce (This is the ticket we give the user when they leave).

	// Send user to Mastodon for authentication
	res.redirect(mastodonAuth.code.getUri());
});

/////////////////////
// Login Callback ///
/////////////////////
// Users return here from Mastodon after successful authentication
app.get('/login/callback', (req, res) => {

	// Get the information the user returned from Mastodon with
	mastodonAuth.code.getToken(req.originalUrl).then(function (user) {
		// get the user's nonce they brought with their browser (return ticket)
		let nonce = req.session.nonce;
		
		// hash the nonce to check against Mastodon's return ticket
		let hashed_nonce = crypto.createHash('sha256').update(nonce).digest('hex');
		
		// Does it match?
		if(hashed_nonce == user.client.nonce){
			// Use the token Mastodon gave us to test access
			let user_token = user.data.access_token;
			
			// save token
			req.session.access_token = user_token;
			
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
						req.session.userid = resJson.id;
						req.session.username = resJson.username;
						req.session.avatar = resJson.avatar;
						req.session.userURL = resJson.url;
						req.session.loggedIn = true;
						console.log("User ID: "+req.session.userid);
						console.log("Username: "+req.session.username);
						req.session.chatmemory = chatMessagesStart;

						// Redirect user to beginning, login successful /
						res.redirect("/");
					});
				}
			});
			///////////////////////////////////////
			//////// LOGIN FAILED /////////////////
			///////////////////////////////////////
			test_req.on('error', (e) =>{
				console.log("Error: "+e); // HTTP Client Error
				res.redirect("/error.html"); // Redirect to error page.
			});
			test_req.end(); // Close HTTP Client Connection
		}
		else{
			console.log("Insecure Session"); // Session nonce didn't match (bad return ticket)
			res.redirect("/error.html"); // Redirect to error page.
		}

	});
});

//////////////
// Logout ////
//////////////
app.get("/logout",(req, res) =>{
	req.session.destroy(); // Destroy session
	res.redirect("https://enlightened.army/"); // Send to beginning
});


///////////////////
// Get hompage ////
///////////////////
app.get('/', (req, res) => {
	// Is user logged in?
	if(req.session.loggedIn){
		// Send HTML File
		res.sendFile(path.join(__dirname,'views/index.html'));
	}
	else{
		// Send user to Login
		res.redirect("/login");
	}
	
});

//////////////////
/// Reset Chat ///
//////////////////
app.get('/reset_chat', (req, res) => {
	// Is user logged in?
	if(req.session.loggedIn){
		req.session.chatmemory = chatMessagesStart;
		res.redirect('/');
	}
	else{
		// Send user to login
		res.redirect('/login');
	}

});

///////////////////////
/// Get error.html ////
///////////////////////
app.get('/error.html', (req, res) => {
	res.sendFile(path.join(__dirname, 'views/error.html'));
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

/////////////////////
// Get favicon ////
/////////////////////
app.get('/app_images/favicon.ico', (req,res) => {
	res.sendFile(path.join(__dirname, 'app_images/favicon.ico'));
});

/////////////////////////////////////////////
// User submit's message to chat bot ////////
/////////////////////////////////////////////
app.post("/", (req, res) =>{
	// Build response variable
	if(req.session.loggedIn){
		var response = {"message": ""}; // message template

		// if input isn't blank
		if(req.body.input !== ""){
			// Build user message
			var new_msg = {"role":"user","content":req.body.input};
			
			// Send user message to OpenAI API
			runCompletion(new_msg,req.session).then(content => {
				// Convert markdown response to html
				var htmlContent = converter.makeHtml(content);
			
				// Store AI Response Message
				req.session.chatmemory.push({"role":"assistant","content":content});
			
				// Respond to user's message
				response.message = htmlContent;
				res.json(response);
			});
		}
	}
});

////////////////////////
//// Client getuser ////
////////////////////////
app.post("/getuser", (req, res) =>{
	// is user loggedIn?
	if(req.session.loggedIn){
		var user = {username: req.session.username,
			avatar: req.session.avatar,
			url: req.session.userURL
		};
		res.json(user);
	}

});




// Launch HTTP Server on port 5000
const server = app.listen(5000, function() {
	console.log(`Listening on port ${server.address().port}`);
});

