const socket = io('http://localhost:5000', { transports: ['websocket'] });
let api_url = "http://localhost:5000";
// const socket = io('https://voicenow.ddns.net:5000', { transports: ['websocket'] });
// let api_url = "https://voicenow.ddns.net:5000";
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

        const userSpecs = document.createElement('span');
        userSpecs.textContent = user.specs;
        userSpecs.style.color = '#6fd4e5';

        listItem.appendChild(userIdSpan);
        listItem.appendChild(userSpecs);


        if (!user.in_call) {
            const callButton = document.createElement('button');
            callButton.textContent = 'Call';
            callButton.onclick = () => initiateCall(sid);
            listItem.appendChild(callButton);
        }
        usersList.appendChild(listItem);


    });
}


// Initialize the end call button
function createEndCallButton() {
    endCallButton = document.createElement('button');
    endCallButton.id = 'endCallButton';
    endCallButton.textContent = 'End Call';
    endCallButton.style.display = 'none';
    endCallButton.style.position = 'fixed';
    endCallButton.style.bottom = '30px'; // Adjusted to match CSS
    endCallButton.style.left = '50%';
    endCallButton.style.transform = 'translateX(-50%)';
    endCallButton.style.padding = '12px 35px'; // Adjusted to match CSS
    endCallButton.style.background = 'linear-gradient(45deg, #ff4444, #cc0000)';
    endCallButton.style.border = 'none';
    endCallButton.style.borderRadius = '30px'; // Adjusted to match CSS
    endCallButton.style.color = 'white';
    endCallButton.style.fontWeight = 'bold';
    endCallButton.style.cursor = 'pointer';
    endCallButton.style.boxShadow = '0 8px 25px rgba(255, 68, 68, 0.3)';
    endCallButton.style.transition = 'all 0.3s ease';
    endCallButton.style.animation = 'pulse 1.5s infinite';


    endCallButton.onclick = endCall;
    document.body.appendChild(endCallButton);
}

// Initialize camera selection and media devices
function initializeMediaDevices() {
    navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
            const videoDevices = devices.filter(device => device.kind === 'videoinput');

            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Camera ${index + 1}`;
                cameraSelect.appendChild(option);
            });
            if (videoDevices.length > 0) {
                cameraSelect.style.display = 'block'
                cameraSelect.addEventListener('change', () => {
                    const selectedDeviceId = cameraSelect.value;
                    navigator.mediaDevices.getUserMedia({
                        video: { deviceId: selectedDeviceId },
                        audio: true
                    }).then((stream) => {
                        if (localStream) {
                            localStream.getTracks().forEach(track => track.stop());
                        }
                        localStream = stream;
                        localVideo.srcObject = stream;
                    }).catch(console.error);
                });

                cameraSelect.dispatchEvent(new Event('change'));
            }

        })
        .catch(console.error);
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
function initiateCall(targetSid) {
    if (peerConnection) {
        console.warn('A call is already in progress.');
        return;
    }

    currentCallSid = targetSid;
    peerConnection = createPeerConnection(targetSid);
    socket.emit('call_request', { to: targetSid });
    endCallButton.style.display = 'block';
    localVideo.style.display = 'block';
    localVideo.style.animation = 'fadeIn 0.5s ease';
    videoContainer.classList.add('active');

    videoContainer.style.animation = 'fadeIn 0.5s ease';
}

function acceptCall(targetSid) {
    if (peerConnection) {
        console.warn('A call is already in progress.');
        return;
    }

    currentCallSid = targetSid;
    peerConnection = createPeerConnection(targetSid);
    socket.emit('accept_call', { to: targetSid });
    endCallButton.style.display = 'block';
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
    videoContainer.classList.remove('active');

    currentCallSid = null;
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
    const userResponse = confirm(`Accept call from ${data.from}?`);
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

// Test backend connection
fetch(api_url + '/test')
    .then(response => response.json())
    .then(console.log)
    .catch(console.error);