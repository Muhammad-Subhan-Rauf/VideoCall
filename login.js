const base_url = "https://voicenow.ddns.net:5000/";
// const base_url = "http://localhost:5000/";

// Login function
function authenticate() {
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;

    const data = {
        username: username,
        password: password
    };
    console.log(data);

    fetch(`${base_url}login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
        .then(response => response.json().then(data => ({ status: response.status, body: data })))
        .then(result => {
            if (result.status === 200) {
                document.getElementById("login-message").textContent = "Login successful!";
                document.getElementById("login-message").style.color = "green";

                // Store the response data in local storage
                localStorage.setItem("userData", JSON.stringify(result.body));
                console.log("User data stored in local storage:", result.body);
                // Navigate to a different page within the same website
                window.location.href = "/index.html";

            } else {
                console.log(result.body)
                document.getElementById("login-message").textContent = result.body;
            }
        })
        .catch(error => {
            console.error("Login failed:", error);
            document.getElementById("login-message").textContent = "An error occurred.";
        });
}

// Create account function
function createAccount() {
    const username = document.getElementById("create-username").value;
    const password = document.getElementById("create-password").value;
    const name = document.getElementById("create-name").value;
    const email = document.getElementById("create-email").value;

    const data = {
        username: username,
        password: password,
        name: name,
        email: email
    };

    fetch(`${base_url}create_account`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
        .then(response => response.json().then(data => ({ status: response.status, body: data })))
        .then(result => {
            if (result.status === 201) {
                document.getElementById("create-message").textContent = "Account created successfully!";
                document.getElementById("create-message").style.color = "green";

                // Store the response data in local storage
                localStorage.setItem("userData", JSON.stringify(data));
                console.log("Account data stored in local storage:", result.body);
            } else {
                document.getElementById("create-message").textContent = result.body;
            }
        })
        .catch(error => {
            console.error("Account creation failed:", error);
            document.getElementById("create-message").textContent = "An error occurred.";
        });
}
