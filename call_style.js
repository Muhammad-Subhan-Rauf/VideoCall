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


