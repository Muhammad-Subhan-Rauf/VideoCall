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

const container = document.getElementById('languages');
Object.values(languages).forEach(lang => {
    const box = document.createElement('div');
    box.id = lang;
    box.classList.add('language-box');
    box.textContent = lang;
    box.onclick = () => {
        const langCode = languageCodeMap[lang];
        filterUsersByLanguage(langCode);
    };
    container.appendChild(box);
});



const languageCodeMap = {};
Object.entries(languages).forEach(([code, name]) => {
    languageCodeMap[name] = code;
});


const usersList = document.getElementById('usersList');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const videoContainer = document.getElementById('videoContainer');
const cameraSelect = document.getElementById('cameraSelect');


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

function filterUsersByLanguage(languageCode) {
    usersList.innerHTML = '';
    usersList.style.display = 'block';

    const filteredUsers = Object.entries(allUsers).filter(([sid, user]) => {
        return user.languages.includes(languageCode) && sid !== socket.id;
    });

    if (filteredUsers.length === 0) {
        const noUsers = document.createElement('li');
        noUsers.textContent = 'No users available';
        usersList.appendChild(noUsers);
        return;
    }

    filteredUsers.forEach(([sid, user]) => {
        const listItem = document.createElement('li');
        listItem.textContent = user.id;
        if (!user.InCall) {
            const callButton = document.createElement('button');
            callButton.textContent = 'Call';
            callButton.onclick = () => initiateCall(sid);
            listItem.appendChild(callButton);
        }
        usersList.appendChild(listItem);
        listItem.style.animation = 'slideIn 0.3s ease forwards';

    });
}


// Initialize the end call button
function createEndCallButton() {
    endCallButton = document.createElement('button');
    endCallButton.id = 'endCallButton';
    endCallButton.textContent = 'End Call';
    endCallButton.style.display = 'none';
    endCallButton.style.position = 'fixed';
    endCallButton.style.bottom = '20px';
    endCallButton.style.left = '50%';
    endCallButton.style.transform = 'translateX(-50%)';
    endCallButton.style.padding = '10px 20px';
    endCallButton.style.backgroundColor = '#ff4444';
    endCallButton.style.color = 'white';
    endCallButton.style.border = 'none';
    endCallButton.style.borderRadius = '5px';
    endCallButton.style.cursor = 'pointer';

    endCallButton.style.background = 'linear-gradient(45deg, #ff4444, #cc0000)';
    endCallButton.style.boxShadow = '0 8px 25px rgba(255, 68, 68, 0.3)';


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
    usersList.innerHTML = '';
    for (let [sid, user] of Object.entries(users)) {
        if (sid !== socket.id) {
            const listItem = document.createElement('li');
            listItem.textContent = user.id;
            if (!user.InCall) {
                const callButton = document.createElement('button');
                callButton.textContent = 'Call';
                callButton.onclick = () => initiateCall(sid);
                listItem.appendChild(callButton);
            }
            usersList.appendChild(listItem);
            listItem.style.animation = 'slideIn 0.3s ease forwards';
        }
    }
});

socket.on('call_received', (data) => {
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

// Initialization
createEndCallButton();
initializeMediaDevices();

// Test backend connection
fetch(api_url + '/test')
    .then(response => response.json())
    .then(console.log)
    .catch(console.error);