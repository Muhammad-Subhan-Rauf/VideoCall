document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton');

    logoutButton.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });

});


const messengerId = "BotPenguin-messenger";
const launcherId = "botpenguin-launcher-12";


const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
            let temp_element = document.getElementById("botpenguin-launcher-text-12");
            const messenger = document.getElementById(messengerId);
            const launcher = document.getElementById(launcherId);
            console.log(temp_element);
            
            // Check screen size and hide temp_element only if it's less than 768px
            if (window.innerWidth < 768) {
                temp_element.style.display = "none";
            }

            if (messenger && launcher && messenger.style.display === "block") {
                console.log("BotPenguin messenger detected. Hiding it...");
                messenger.style.display = "none"; // Hide the messenger
                launcher.style.display = "block"; // Show the launcher
                observer.disconnect();
            }
        }
    });
});


// Function to start observing once the elements are available
function observeElement() {
    const messenger = document.getElementById(messengerId);
    if (messenger) {
        observer.observe(messenger, { attributes: true, attributeFilter: ["style"] });
        console.log("Observing BotPenguin messenger for visibility changes...");
    } else {
        setTimeout(observeElement, 500); // Retry if the element is not found yet
    }
}

// Start checking for the element
observeElement();

