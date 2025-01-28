// const socket = io('http://localhost:5000', { transports: ['websocket'] });
// let api_url = "http://localhost:5000";
const socket = io('https://voicenow.ddns.net:5000', { transports: ['websocket'] });
let api_url = "https://voicenow.ddns.net:5000";




const usersList = document.getElementById('usersList');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let peerConnection = null;
let currentCallSid = null;
let endCallButton = null;
let makingOffer = false;
let ignoreOffer = false;

const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};


function getUserData() {
    const userDataString = localStorage.getItem("userData");
    
    if (userDataString) {
        try {
            const userData = JSON.parse(userDataString); // Convert string to dictionary
            return userData;
        } catch (error) {
            console.error("Failed to parse user data from local storage:", error);
            return null;
        }
    } else {
        console.warn("No user data found in local storage.");
        return null;
    }
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
    endCallButton.onclick = endCall;
    document.body.appendChild(endCallButton);
}

// Initialize camera selection and media devices
function initializeMediaDevices() {
    navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            const cameraSelect = document.createElement('select');
            cameraSelect.id = 'cameraSelect';

            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Camera ${index + 1}`;
                cameraSelect.appendChild(option);
            });

            document.body.appendChild(cameraSelect);

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
    console.log("PEER PRESSURE",peerConnection)
    if (peerConnection) {
        console.warn('A call is already in progress.');
        return;
    }

    currentCallSid = targetSid;
    peerConnection = createPeerConnection(targetSid);
    socket.emit('call_request', { to: targetSid });
    endCallButton.style.display = 'block'; // Show end call button for the caller
}

function acceptCall(targetSid) {
    if (peerConnection) {
        console.warn('A call is already in progress.');
        return;
    }

    currentCallSid = targetSid;
    peerConnection = createPeerConnection(targetSid);
    socket.emit('accept_call', { to: targetSid });
    endCallButton.style.display = 'block'; // Show end call button for the recipient
}

function endCall() {
    if (currentCallSid) {
        socket.emit('end_call', { to: currentCallSid });
        cleanupCall();
        socket.emit("refresh_list", {id:user.id})
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
    }
    endCallButton.style.display = 'none';
    currentCallSid = null;
}


// Socket.IO Event Handlers
socket.on("connected", (users) => {
    console.log("WE ARE CONNECTED BABY")
    data = getUserData()
    console.log(data)
    socket.emit('id_send', {username:data.username})
})

socket.on('update_users', (users) => {
    usersList.innerHTML = '';
    for (let [sid, user] of Object.entries(users)) {
        if (sid !== socket.id) {
            const listItem = document.createElement('li');
            listItem.textContent = user.id;
            const callButton = document.createElement('button');
            callButton.textContent = 'Call';
            callButton.onclick = () => initiateCall(sid);
            listItem.appendChild(callButton);
            usersList.appendChild(listItem);
        }
    }
});

socket.on('call_received', (data) => {
    currentCallSid = data.sid;
    const userResponse = confirm(`Accept call from ${data.from}?`);
    if (userResponse) {
        acceptCall(currentCallSid);
    } else {
        socket.emit('reject_call', { to: currentCallSid });
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
    alert(data.message);
    cleanupCall();
});

socket.on('call_rejected', () => {
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