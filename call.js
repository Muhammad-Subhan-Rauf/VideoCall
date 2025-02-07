// const socket = io('http://localhost:5000', { transports: ['websocket'] });
// let api_url = "http://localhost:5000";
const socket = io('https://voicenow.ddns.net:5000', { transports: ['websocket'] });
let api_url = "https://voicenow.ddns.net:5000";
// 150

const languages = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    zh: 'Chinese',
    ja: 'Japanese',
    ar: 'Arabic',
    hi: 'Hindi',
    asl: 'American Sign Language'
};

const languageCountryMap = {
    en: 'gb', // English - United Kingdom (UK flag)
    es: 'es', // Spanish - Spain
    fr: 'fr', // French - France
    de: 'de', // German - Germany
    zh: 'cn', // Chinese - China
    ja: 'jp', // Japanese - Japan
    ar: 'ae', // Arabic - United Arab Emirates
    hi: 'in', // Hindi - India
    asl: null // American Sign Language - No country flag, will use emoji
};


const languageCodeMap = {};
Object.entries(languages).forEach(([code, name]) => {
    languageCodeMap[name] = code;
});

const usersList = document.getElementById('usersList');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const videoContainer = document.getElementById('videoContainer');
const cameraSelect = document.getElementById('cameraSelect');
const specSelect = document.getElementById('specSelect'); // Get spec dropdown
const userSearchInput = document.getElementById('userSearchInput'); // Get search input
const languageSelect = document.getElementById('languageSelect'); // Get language dropdown (keep if you want to keep language dropdown filter)
const languagesContainer = document.getElementById('languages'); // Get languages container
const callStatusDisplay = document.getElementById('callStatus'); // Get call status display
const swapStreamsButton = document.getElementById('swapStreamsButton');
const fullScreenButton = document.getElementById('fullScreenButton');

// Remove language boxes - no longer needed

// Populate language dropdown options (if you keep the dropdown filter)
if (languageSelect) { // Check if languageSelect exists in HTML
    languageSelect.innerHTML = '<option value="">All Languages</option>'; // Default option
    Object.entries(languages).forEach(([code, name]) => {
        const option = document.createElement('option');
        option.value = code; // Use language code as value
        option.textContent = name; // Display language name
        languageSelect.appendChild(option);
    });
}


// localVideo.style.display = 'none';
// remoteVideo.style.display = 'none';


let localStream;
let peerConnection = null;
let currentCallSid = null;
let endCallButton = null;
let makingOffer = false;
let ignoreOffer = false;
let current_user = null;
let allUsers = {};
const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};


function getUserData() {
    const userDataString = localStorage.getItem("userData");
    if (userDataString) {
        try {
            return JSON.parse(userDataString);
        } catch (error) {
            console.error("Failed to parse user data:", error);
            return null;
        }
    }
    console.warn("No user data found");
    return null;
}
current_user = getUserData().username;
function isLoggedIn()
{
    let user = getUserData()
    if (user){
        return true
    }
    return false
}

if (!isLoggedIn())
{
    window.location.href = "/index.html";
}

function filterUsersByLanguage(languageCode) { // Keep this function for dropdown filter if you use it
    usersList.innerHTML = '';
    usersList.style.display = 'block';

    const filteredUsers = Object.entries(allUsers).filter(([sid, user]) => {
        return user.languages.includes(languageCode) && sid !== socket.id;
    });

    displayUsers(filteredUsers);
}

function filterUsersBySpec(spec) {
    usersList.innerHTML = '';
    usersList.style.display = 'block';

    const filteredUsers = Object.entries(allUsers).filter(([sid, user]) => {
        return user.specs === spec && sid !== socket.id;
    });

    displayUsers(filteredUsers);
}


function searchUsers(searchTerm) {
    usersList.innerHTML = '';
    usersList.style.display = 'block';
    searchTerm = searchTerm.toLowerCase().trim(); // Normalize search term

    const filteredUsers = Object.entries(allUsers).filter(([sid, user]) => {
        if (sid === socket.id) return false; // Exclude current user

        for (const langCode of user.languages) {
            const languageName = languages[langCode]?.toLowerCase(); // Get full language name, handle undefined case
            if (languageName) {
                if (languageName.includes(searchTerm) || langCode.toLowerCase().includes(searchTerm)) { // Check for match in full name OR code
                    return true; // User speaks a language that matches the search term (name or code)
                }
            } else if (langCode.toLowerCase().includes(searchTerm)) {
                // Handle case where language name is not found in `languages` but code matches (unlikely but robust)
                return true;
            }
        }

        if (user.id.toLowerCase().includes(searchTerm)) { // Search by User ID (still included)
            return true;
        }

        return false; // No language or user ID match for this user
    });

    displayUsers(filteredUsers);
}


function filterUsersByLanguageDropdown() { // Keep this function if you use language dropdown
    if (!languageSelect) return; // Exit if languageSelect is not in HTML
    const selectedLanguageCode = languageSelect.value;
    if (selectedLanguageCode) {
        filterUsersByLanguage(selectedLanguageCode);
    } else {
        usersList.innerHTML = ''; // Clear list to show all users again when "All Languages" is selected.
        displayUsers(Object.entries(allUsers).filter(([sid, user]) => sid !== socket.id)); // Redisplay all users
    }
}


function displayUsers(filteredUsers) {
    if (filteredUsers.length === 0) {
        const noUsers = document.createElement('li');
        noUsers.textContent = 'No users available';
        usersList.appendChild(noUsers);
        return;
    }

    filteredUsers.forEach(([sid, user]) => {
        const listItem = document.createElement('li');
        listItem.style.display = 'flex';
        listItem.style.justifyContent = 'space-between';
        listItem.style.alignItems = 'center';
        listItem.style.padding = '15px'; // Increased padding to match list items
        listItem.style.margin = '10px 0'; // Keep margin
        listItem.style.borderRadius = '10px'; // Keep border-radius
        listItem.style.background = 'rgba(255, 255, 255, 0.1)'; // Keep background
        listItem.style.backdropFilter = 'blur(5px)'; // Keep backdrop-filter
        listItem.style.animation = 'slideIn 0.4s ease-out forwards';
        listItem.style.opacity = '0';
        listItem.style.transform = 'translateX(-20px)';


        const userIdSpan = document.createElement('span');
        userIdSpan.textContent = user.id;

        // Add language flags/emojis
        const flagsContainer = document.createElement('div');
        flagsContainer.style.display = 'flex';
        flagsContainer.style.gap = '5px'; // Adjust gap as needed
        user.languages.forEach(langCode => {
            if (langCode === 'asl') {
                // Display hand emoji for ASL
                const emojiSpan = document.createElement('span');
                emojiSpan.textContent = '👋'; // Hand wave emoji (you can choose a different hand emoji)
                emojiSpan.style.fontSize = '20px'; // Adjust emoji size if needed
                emojiSpan.setAttribute('aria-label', languages[langCode]); // Accessibility label
                flagsContainer.appendChild(emojiSpan);

            } else {
                const countryCode = languageCountryMap[langCode];
                if (countryCode) {
                    const flagImg = document.createElement('img');
                    const flagBaseSize = '256x192'; // Base size for flag images
                    flagImg.src = `https://flagcdn.com/${flagBaseSize}/${countryCode}.png`;
                    // flagImg.srcset = `https://flagcdn.com/32x24/${countryCode}.png 2x,
                    //                    https://flagcdn.com/48x36/${countryCode}.png 3x`;
                    flagImg.width = 16; // Base width
                    flagImg.height = 12; // Base height
                    flagImg.alt = languages[langCode]; // Alt text for accessibility
                    flagImg.style.width = '25px'; // Adjust flag display size in CSS if needed (overrides width attribute for display)
                    flagImg.style.height = 'auto';
                    flagsContainer.appendChild(flagImg);
                }
            }
        });


        const userSpecs = document.createElement('span');
        userSpecs.textContent = user.specs;
        userSpecs.style.color = '#6fd4e5';

        listItem.appendChild(userIdSpan);
        listItem.appendChild(flagsContainer); // Add flags/emojis container here
        listItem.appendChild(userSpecs);


        if (!user.in_call) {
            const callButton = document.createElement('button');
            callButton.textContent = 'Call';
            callButton.onclick = () => initiateCall(sid, user.id); // Pass username to initiateCall
            listItem.appendChild(callButton);
        }
        usersList.appendChild(listItem);


    });
}


function createEndCallButton() {
    // Create button container if it doesn't exist
    let buttonContainer = document.querySelector('.button-container');
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        document.body.appendChild(buttonContainer);
    }

    endCallButton = document.createElement('button');
    endCallButton.id = 'endCallButton';
    endCallButton.style.display = "none"
    endCallButton.innerHTML = `
        <span class="button-icon">📞</span>
        <span class="button-text">End Call</span>
    `;
    endCallButton.onclick = endCall;


    // Add to button container instead of body
    buttonContainer.appendChild(endCallButton);

    // Initialize toggle camera button if not in HTML
    if (!document.getElementById('toggleCamera')) {
        const toggleCameraButton = document.createElement('button');
        toggleCameraButton.style.display="none"
        toggleCameraButton.id = 'toggleCamera';
        toggleCameraButton.innerHTML = `
            <span class="button-icon">🎥</span>
            <span class="button-text">Toggle Camera</span>
        `;
        buttonContainer.insertBefore(toggleCameraButton, endCallButton);
    }

    // Initialize toggle microphone button  <-- Add this section -->
    if (!document.getElementById('toggleMic')) {
        const toggleMicButton = document.createElement('button');
        toggleMicButton.style.display="none"
        toggleMicButton.id = 'toggleMic';
        toggleMicButton.innerHTML = `
            <span class="button-icon">🎤</span>
            <span class="button-text">Mute Mic</span>
        `;
        buttonContainer.insertBefore(toggleMicButton, toggleCameraButton); // Place it before or after toggleCamera as you like
    }
}

// Initialize camera selection and media devices
async function initializeMediaDevices() {
    try {
        // Request camera access to ensure device labels are available
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        // Enumerate devices after permission is granted
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        // Clear previous options
        cameraSelect.innerHTML = '';

        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Camera ${index + 1}`;
            cameraSelect.appendChild(option);
        });

        if (videoDevices.length > 0) {
            cameraSelect.style.display = 'block';
            cameraSelect.addEventListener('change', async () => {
                try {
                    const selectedDeviceId = cameraSelect.value;
                    const constraints = {
                        video: { deviceId: selectedDeviceId },
                        audio: true
                    };

                    // Get new stream
                    const newStream = await navigator.mediaDevices.getUserMedia(constraints);

                    // Stop old tracks
                    if (localStream) {
                        localStream.getTracks().forEach(track => track.stop());
                    }

                    // Apply previous mute state to new stream
                    if (!isCameraOn) {
                        newStream.getVideoTracks()[0].enabled = false;
                    }

                    // Update local video and stream reference
                    localStream = newStream;
                    localVideo.srcObject = newStream;

                    // Update peer connection
                    if (peerConnection) {
                        const videoTrack = localStream.getVideoTracks()[0];
                        const senders = peerConnection.getSenders();
                        const videoSender = senders.find(s => s.track?.kind === 'video');

                        if (videoSender && videoTrack) {
                            await videoSender.replaceTrack(videoTrack);
                        }
                    }
                } catch (error) {
                    console.error('Error switching camera:', error);
                }
            });

            cameraSelect.dispatchEvent(new Event('change'));
        }

        // Stop stream after enumeration if not needed
        stream.getTracks().forEach(track => track.stop());
    } catch (error) {
        console.error('Error accessing media devices:', error);
    }
}


// WebRTC Peer Connection Management
function createPeerConnection(targetSid) {
    const pc = new RTCPeerConnection(configuration);

    // Add local tracks
    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    // Handle remote tracks
    pc.ontrack = (event) => {
        if (!remoteVideo.srcObject) {
            remoteVideo.srcObject = event.streams[0];
            remoteVideo.style.display = 'block';
            remoteVideo.style.animation = 'fadeIn 0.5s ease';
            displayCallStatus(`On call with ${getTargetUsername(currentCallSid)}`); // Update status to "On call"
        }
    };

    // ICE candidate handling
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', { to: targetSid, candidate: event.candidate });
        }
    };

    // Handle negotiation state
    pc.onnegotiationneeded = async () => {
        try {
            makingOffer = true;
            await pc.setLocalDescription();
            socket.emit('offer', { to: targetSid, offer: pc.localDescription });
        } catch (err) {
            console.error('Negotiation error:', err);
        } finally {
            makingOffer = false;
        }
    };

    return pc;
}

// Call Management
function initiateCall(targetSid, targetUsername) {
    if (peerConnection) {
        console.warn('A call is already in progress.');
        return;
    }

    currentCallSid = targetSid;
    peerConnection = createPeerConnection(targetSid);
    socket.emit('call_request', { to: targetSid });
    endCallButton.style.display = 'flex';
    toggleCameraButton.style.display = 'flex'
    swapStreamsButton.style.display = 'flex'
    fullScreenButton.style.display = 'flex'
    toggleMicButton.style.display = 'flex';
    localVideo.style.display = 'block';
    localVideo.style.animation = 'fadeIn 0.5s ease';
    videoContainer.classList.add('active');
    videoContainer.style.animation = 'fadeIn 0.5s ease';

    displayCallStatus(`Calling ${targetUsername}`); // Display "Calling Username"
}

function acceptCall(targetSid) {
    if (peerConnection) {
        console.warn('A call is already in progress.');
        return;
    }

    currentCallSid = targetSid;
    peerConnection = createPeerConnection(targetSid);
    socket.emit('accept_call', { to: targetSid });
    endCallButton.style.display = 'flex';
    toggleCameraButton.style.display='flex'
    swapStreamsButton.style.display = 'flex'
    fullScreenButton.style.display = 'flex'
    toggleMicButton.style.display = 'flex';

    localVideo.style.display = 'block';
    localVideo.style.animation = 'fadeIn 0.5s ease';
    videoContainer.classList.add('active');
    videoContainer.style.animation = 'fadeIn 0.5s ease';
}

function endCall() {
    if (currentCallSid) {
        console.log("No error 1")
        socket.emit('end_call', { to: currentCallSid });
        console.log("No error 2")
        cleanupCall();
        console.log("No error 3")
        socket.emit("refresh_list", { id: current_user })
        console.log("No error 4")
    }
}

// Clean up call resources
function cleanupCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.style.display = 'none';
    }
    localVideo.style.display = 'none';
    endCallButton.style.display = 'none';
    swapStreamsButton.style.display = 'none'
    fullScreenButton.style.display = 'none'
    toggleMicButton.style.display = 'none';

    videoContainer.classList.remove('active');
    callStatusDisplay.textContent = ''; // Clear call status message
    currentCallSid = null;
}

// Helper function to get username from allUsers by SID
function getTargetUsername(sid) {
    return allUsers[sid]?.id || 'User'; // Default to 'User' if username not found
}

function displayCallStatus(message) {
    callStatusDisplay.textContent = message;
}


// Socket.IO Event Handlers
socket.on("connected", (users) => {

    data = getUserData()

    socket.emit('id_send', { user: data })
})

socket.on('update_users', (users) => {
    allUsers = users;

    // Populate spec dropdown
    const specs = [...new Set(Object.values(users).map(user => user.specs))]; // Get unique specs
    specSelect.innerHTML = '<option value="">All Specializations</option>'; // Reset options and add default
    specs.forEach(spec => {
        const option = document.createElement('option');
        option.value = spec;
        option.textContent = spec;
        specSelect.appendChild(option);
    });


    usersList.innerHTML = '';
    console.log(users);
    const usersArray = Object.entries(users); // Convert users object to array for easier filtering

    displayUsers(usersArray.filter(([sid, user]) => sid !== socket.id)); // Initial display of all users (except self)
});


socket.on('call_received', (data) => {
    console.log("call reced PEER CONN: ".peerConnection)
    currentCallSid = data.sid;
    console.log(currentCallSid)
    const callerUsername = getTargetUsername(currentCallSid); // Get caller username
    displayCallStatus(`Incoming call from ${callerUsername}`); // Display "Incoming call from username"
    const userResponse = confirm(`Accept call from ${callerUsername}?`);
    if (userResponse) {
        acceptCall(currentCallSid);
    } else {
        socket.emit('reject_call', { to: currentCallSid });
        location.reload()
        cleanupCall();
    }
});

socket.on('offer', async ({ offer, from }) => {
    console.log("OFFER PEER CONN: ".peerConnection)
    if (!peerConnection) peerConnection = createPeerConnection(from);

    try {
        const offerCollision = (offer.type === 'offer') &&
            (makingOffer || peerConnection.signalingState !== 'stable');

        ignoreOffer = !makingOffer && offerCollision;
        if (ignoreOffer) return;

        await peerConnection.setRemoteDescription(offer);
        if (offer.type === 'offer') {
            await peerConnection.setLocalDescription();
            socket.emit('answer', { to: from, answer: peerConnection.localDescription });
        }
    } catch (err) {
        console.error('Offer handling error:', err);
    }
});

socket.on('answer', async ({ answer }) => {
    console.log(peerConnection)
    if (!peerConnection) return;

    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        displayCallStatus(`On call with ${getTargetUsername(currentCallSid)}`); // Update status to "On call" after answer
    } catch (err) {
        console.error('Answer handling error:', err);
    }
});

socket.on('candidate', async ({ candidate }) => {
    if (!peerConnection) return;

    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
        if (!ignoreOffer) console.error('Candidate error:', err);
    }
});

socket.on('call_ended', () => {
    // alert('Call has ended');
    location.reload()
    cleanupCall();
});

socket.on('call_failed', (data) => {
    location.reload()
    alert(data.message);
    cleanupCall();
});

socket.on('call_rejected', () => {
    location.reload()
    alert('Call was rejected');
    cleanupCall();
});

// Event listeners for filters and search
specSelect.addEventListener('change', (event) => {
    const selectedSpec = event.target.value;
    if (selectedSpec) {
        filterUsersBySpec(selectedSpec);
    } else {
        usersList.innerHTML = ''; // Clear list to show all users again when "All Specs" is selected.
        displayUsers(Object.entries(allUsers).filter(([sid, user]) => sid !== socket.id)); // Redisplay all users
    }
});

if (userSearchInput) { // Check if userSearchInput exists in HTML
    userSearchInput.addEventListener('input', (event) => {
        const searchTerm = event.target.value;
        searchUsers(searchTerm);
    });
}


if (languageSelect) { // Check if languageSelect exists in HTML
    languageSelect.addEventListener('change', filterUsersByLanguageDropdown); // Event listener for language dropdown
}


// Initialization
createEndCallButton();
initializeMediaDevices();


const toggleCameraButton = document.getElementById('toggleCamera');
let isCameraOn = true;

// Modified camera toggle handler
toggleCameraButton.addEventListener('click', () => {
    isCameraOn = !isCameraOn;

    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = isCameraOn;
        }
    }
    console.log(toggleCameraButton.style.background)
    if (!isCameraOn)
    {
        toggleCameraButton.style.background="linear-gradient(45deg,rgb(192, 34, 34), #4553a1)"
    }
    else{
        toggleCameraButton.style.background = "linear-gradient(45deg, #4a90e2, #5b6ee1)"
    }
    // #5964a2
    //#4553a1
});




const toggleMicButton = document.getElementById('toggleMic'); // Get the mute mic button
let isMicOn = true; // Keep track of mic state

toggleMicButton.addEventListener('click', () => {
    isMicOn = !isMicOn;

    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = isMicOn; // Enable/disable the audio track
        }
    }

    if (!isMicOn) {
        toggleMicButton.style.background = "linear-gradient(45deg, #558b2f,rgb(192, 34, 34))"; // Indicate muted state
        toggleMicButton.innerHTML = `<span class="button-icon">🔇</span><span class="button-text">Unmute Mic</span>`; // Change button text
    } else {
        toggleMicButton.style.background = "linear-gradient(45deg, #7cb342, #558b2f)"; // Indicate unmuted state
        toggleMicButton.innerHTML = `<span class="button-icon">🎤</span><span class="button-text">Mute Mic</span>`; // Change button text back
    }
});



// Test backend connection
fetch(api_url + '/test')
    .then(response => response.json())
    .then(console.log)
    .catch(console.error);