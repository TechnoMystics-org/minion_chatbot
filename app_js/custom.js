// This keeps the conversation updated on the screen. Sticky to the bottom.
function chatScrollToBottom(){
    let chatWindow = $(".chat_window");
    chatWindow.scrollTop(chatWindow[0].scrollHeight);
    let scrollingElement = (document.scrollingElement || document.body);
    scrollingElement.scrollTop = scrollingElement.scrollHeight;
}

// Handle loading spinner
function displaySpinner(){
    let spinner = document.getElementById("spinner");
    spinner.style.visibility = 'visible';
}
function hideSpinner(){
    let spinner = document.getElementById("spinner");
    spinner.style.visibility = 'hidden';
}

// process message submition response
function processResponse(data){
    let chatWindow = $(".chat_window");
    if (data.message !== ""){
        chatWindow.append('\
        <div class="card text-bg-secondary mb-3">\
            <div class="card-header">Minion</div>\
            <div class="card-body">\
                <p><small>' + data.message + '</small></p>\
            </div>\
        </div>');
        // Scroll chat window to bottom
        hideSpinner();
        chatScrollToBottom();
    }
}

// Update chatbox with new message
function appendUserMessage(){
    // get user input
    let userInput = document.getElementById("user_input").value;
    // id chat window
    let chatWindow = $(".chat_window");
    
    // If user input isn't blank, append message to chat window
    if(userInput !== ""){
        chatWindow.append('\
        <div class="card text-bg-dark mb-3">\
            <div class="card-header">User</div>\
            <div class="card-body">\
                <p><small>' + userInput + '</small></p>\
            </div>\
        </div>');
        // clear input
        document.getElementById("user_input").value = "";
        // Scroll chat window to bottom
        chatScrollToBottom();

        return userInput;
    }
}

// Send user message to AI
function postUserMessage(message) {
    var postData = {"input": message};

    // Use ajax to submit HTTP POST
    $.ajax({
        type: "POST",
        url: "/",
        data: JSON.stringify(postData),
        success: function(data){
            // Process AI Response
            processResponse(data);
        },
        contentType: "application/json",
        dataType: "json"
    });

    // This doesn't let me set ContentType:application/json
    /*
    $.post("/",JSON.stringify(postData), function(data) {
        console.log(data);
        processResponse(data);
        }, 
        "json");
    */
   return Promise.resolve(true); // Not entirely sure this is necessary
}

// Driving function for sending user message to AI
function sendMessage(){
    let userInput = appendUserMessage();
    postUserMessage(userInput);
}

// Allow user to Ctrl-Enter when focused on the TextArea
document.getElementById("user_input").addEventListener('keydown', function (e){
    // When TextArea isn't empty
    if(document.getElementById("user_input").value !== ""){
        // if ENTER
        if (e.keyCode == 13){
            // Ctrl + Enter
            // if CTRL
            if(e.ctrlKey) {
                // Show loading spinner
                displaySpinner();
                // Send Message
                sendMessage();
            }
        }
    }
});

// When SEND button is clicked
document.getElementById("send_button").addEventListener("click", ()=>{
    // When TextArea isn't empy
    if(document.getElementById("user_input").value !== ""){
        // Display loading spinner
        displaySpinner();
        // Send Message
        sendMessage();
    }
});

function processUser(data){
    // display user avatar on navbar
    $("#userinfo").append("<a href=\""+data.url+"\">"+"<img src=\""+data.avatar+"\" height=\"50px\">"+"</a>");
}

// Get user info for graphics & stuff
function getUser(){
    // Use ajax to submit HTTP POST
    $.ajax({
        type: "POST",
        url: "/getuser",
        success: function(data){
            // Process AI Response
            processUser(data);
        },
        contentType: "application/json",
        dataType: "json"
    });
}

window.addEventListener('load', function (){
    // once the window is loaded get the user information
    getUser();
});