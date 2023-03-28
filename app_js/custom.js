


function chatScrollToBottom(){
    let chatWindow = $(".chat_window");
    chatWindow.scrollTop(chatWindow[0].scrollHeight);
}

function displaySpinner(){
    let spinner = document.getElementById("spinner");
    spinner.style.visibility = 'visible';
}
function hideSpinner(){
    let spinner = document.getElementById("spinner");
    spinner.style.visibility = 'hidden';
}

function processResponse(data){
    //console.log("Response: ");
    //console.log(data);
    let chatWindow = $(".chat_window");
    if (data.message !== ""){
        chatWindow.append('\
        <div class="card text-bg-secondary mb-3">\
            <div class="card-header">Minion</div>\
            <div class="card-body">\
                <p class="">' + data.message + '</p>\
            </div>\
        </div>');
        // Scroll chat window to bottom
        hideSpinner();
        chatScrollToBottom();
    }
}

function appendUserMessage(){
    // get user input
    let userInput = document.getElementById("user_input").value;
    // id chat window
    let chatWindow = $(".chat_window");
    // log user input to console
    //console.log("text input: "+userInput);
    // If user input isn't blank, append message to chat window
    if(userInput !== ""){
        chatWindow.append('\
        <div class="card text-bg-dark mb-3">\
            <div class="card-header">User</div>\
            <div class="card-body">\
                <p class="">' + userInput + '</p>\
            </div>\
        </div>');
        // clear input
        document.getElementById("user_input").value = "";
        // Scroll chat window to bottom
        chatScrollToBottom();
        return userInput;
    }
}

function postUserMessage(message) {
    //console.log("Attempting to POST: "+message);
    var postData = {"input": message};
    //console.log("JSON Stringify: "+JSON.stringify(postData));

    $.ajax({
        type: "POST",
        url: "/",
        data: JSON.stringify(postData),
        success: function(data){
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
   return Promise.resolve(true);
}

function sendMessage(){
    let userInput = appendUserMessage();
    postUserMessage(userInput);
    
    //console.log("User Input: "+userInput);
}

document.getElementById("user_input").addEventListener('keydown', function (e){
    if(document.getElementById("user_input").value !== ""){
        if (e.keyCode == 13){
            // Ctrl + Enter
            if(e.ctrlKey) {
                console.log('ctrl+enter');
                displaySpinner();
                sendMessage();
            }
            else{
                //just Enter
            }
        }
    }
});

document.getElementById("send_button").addEventListener("click", ()=>{
    if(document.getElementById("user_input").value !== ""){
        displaySpinner();
        sendMessage();
    }
});
