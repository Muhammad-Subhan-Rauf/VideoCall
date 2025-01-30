// const base_url = "http://localhost:5000/";
const base_url = "https://voicenow.ddns.net:5000/";
// Initialize language selection
document.addEventListener('DOMContentLoaded', () => {
    createLanguageDropdown();
    animateElements();
});



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
                window.location.href = "/call.html";

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
    
    // Get selected languages
    const langSelects = document.querySelectorAll('.lang-select');
    const selectedLangs = Array.from(langSelects)
        .map(select => select.value)
        .filter(Boolean);

    const data = {
        username: username,
        password: password,
        name: name,
        email: email,
        langs: selectedLangs
    };

    // Rest of the fetch call remains the same
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
            localStorage.setItem("userData", JSON.stringify(data));
        } else {
            document.getElementById("create-message").textContent = result.body;
        }
    })
    .catch(error => {
        console.error("Account creation failed:", error);
        document.getElementById("create-message").textContent = "An error occurred.";
    });
}

function createLanguageDropdown(selected = []) {
    const container = document.getElementById('langs-container');
    const available = Object.keys(languages).filter(lang => !selected.includes(lang));
    
    if (available.length === 0) return;

    const select = document.createElement('select');
    select.className = 'lang-select';
    select.innerHTML = '<option value="">Select a language...</option>' + 
        available.map(lang => `<option value="${lang}">${languages[lang]}</option>`).join('');
    
    select.onchange = function() {
        // Remove subsequent selects if user changes their choice
        while(this.nextElementSibling) {
            this.nextElementSibling.remove();
        }
        
        if (this.value) {
            // Create new dropdown with updated selections
            const newSelections = [...selected, this.value];
            createLanguageDropdown(newSelections);
        }
    };
    
    container.appendChild(select);
}
function animateElements() {
    const container = document.querySelector('.container');
    const formWrappers = document.querySelectorAll('.form-wrapper');
    const loginTitle = document.querySelector('.login-title');
    const createTitle = document.querySelector('.create-title');

    container.style.opacity = 0;
    container.style.transform = 'translateY(20px)';
    
    // Fade in container
    setTimeout(() => {
        container.style.transition = 'all 0.5s ease';
        container.style.opacity = 1;
        container.style.transform = 'translateY(0)';
    }, 100);

    // Animate titles
    loginTitle.style.opacity = 0;
    loginTitle.style.transform = 'translateY(-10px)';
    
    createTitle.style.opacity = 0;
    createTitle.style.transform = 'translateY(-10px)';
    setTimeout(() => {
        loginTitle.style.transition = 'all 0.6s ease';
        loginTitle.style.opacity = 1;
        loginTitle.style.transform = 'translateY(0)';

        createTitle.style.transition = 'all 0.6s ease';
        createTitle.style.opacity = 1;
        createTitle.style.transform = 'translateY(0)';

      }, 300);


    // Animate form groups
    formWrappers.forEach((wrapper, index) => {
        wrapper.querySelectorAll('.input-group').forEach((input, i) => {
        input.style.opacity = 0;
        input.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            input.style.transition = 'all 0.4s ease';
            input.style.opacity = 1;
            input.style.transform = 'translateY(0)';
        }, 300 + 100 * (index + i));
    });
    // Animate buttons
    const buttons = wrapper.querySelectorAll('button');
    buttons.forEach((button, index) => {
      button.style.opacity = 0;
      button.style.transform = 'translateY(10px)';
       setTimeout(() => {
        button.style.transition = 'all 0.4s ease';
        button.style.opacity = 1;
        button.style.transform = 'translateY(0)';
      }, 300 + 100 * (formWrappers.length + index));
  });
});
  const hr = document.querySelector('hr');
    hr.style.opacity = 0;
    hr.style.transform = 'translateX(-20px)';

    setTimeout(() => {
    hr.style.transition = 'all 0.5s ease';
    hr.style.opacity = 1;
    hr.style.transform = 'translateX(0)';
    }, 500);

}