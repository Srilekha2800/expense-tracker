
// EXPENSE TRACKER - AUTHENTICATION MODULE


//  1. DISPLAY FORM MESSAGES


function showMessage(form, message, type) {
    let messageElement = form.querySelector(".form-message");

    // Create the message element if it doesn't exist
    if (!messageElement) {
        messageElement = document.createElement("p");
        messageElement.className = "form-message";
        messageElement.setAttribute("aria-live", "polite");

        const submitButton = form.querySelector(
            'button[type="submit"]'
        );

        form.insertBefore(messageElement, submitButton);
    }

    messageElement.textContent = message;
    messageElement.dataset.type = type;
}


//    2. PASSWORD HASHING FOR DEMO STORAGE


// Convert a byte array into a hexadecimal string
function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}


// Generate a password hash using PBKDF2
async function hashPassword(password, salt) {
    const encoder = new TextEncoder();

    const passwordData = encoder.encode(password);

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        passwordData,
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 310000,
            hash: "SHA-256"
        },
        keyMaterial,
        256
    );

    return bytesToHex(new Uint8Array(derivedBits));
}


// Create a random salt and its corresponding password hash
async function createPasswordCredential(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const passwordHash = await hashPassword(password, salt);

    return {
        salt: bytesToHex(salt),
        passwordHash: passwordHash
    };
}


// Verify the entered password against the stored credential
async function verifyPassword(password, user) {
    const salt = new Uint8Array(
        user.salt.match(/.{2}/g).map(byte => parseInt(byte, 16))
    );

    const enteredPasswordHash = await hashPassword(password, salt);

    return enteredPasswordHash === user.passwordHash;
}



// 3. SIGNUP FUNCTIONALITY


async function handleSignup(event) {
    event.preventDefault();

    const form = event.currentTarget;

    const username = form.querySelector("#username").value.trim();
    const email = form.querySelector("#email").value.trim().toLowerCase();
    const password = form.querySelector("#password").value;
    const confirmPassword = form.querySelector("#confirm-password").value;

    // Validate empty fields
    if (!username || !email || !password || !confirmPassword) {
        showMessage(form, "Please fill in all fields.", "error");
        return;
    }

    // Validate password length
    if (password.length < 8) {
        showMessage(
            form,
            "Password must contain at least 8 characters.",
            "error"
        );
        return;
    }

    // Check password confirmation
    if (password !== confirmPassword) {
        showMessage(form, "Passwords do not match.", "error");
        return;
    }

    try {
        // Retrieve existing users
        const users = ExpenseStorage.getUsers();

        // Check whether email already exists
        const existingUser = users.find(
            user => user.email.toLowerCase() === email
        );

        if (existingUser) {
            showMessage(
                form,
                "An account with this email already exists.",
                "error"
            );
            return;
        }

        // Create a password credential
        if (!crypto.subtle) {
            throw new Error(
                "Secure browser context required. Use localhost or HTTPS."
            );
        }

        const credential = await createPasswordCredential(password);

        // Create the new user record
        const newUser = {
            id: crypto.randomUUID(),
            username: username,
            email: email,
            salt: credential.salt,
            passwordHash: credential.passwordHash,
            createdAt: new Date().toISOString()
        };

        // Save the updated users array
        users.push(newUser);

        ExpenseStorage.saveUsers(users);

        showMessage(
            form,
            "Account created successfully! Redirecting to login...",
            "success"
        );

        form.reset();

        // Redirect to login page
        setTimeout(() => {
            window.location.href = "login.html";
        }, 1200);

    } catch (error) {
        console.error("Signup error:", error);

        showMessage(
            form,
            error.message || "Something went wrong during signup.",
            "error"
        );
    }
}


// 4. LOGIN FUNCTIONALITY

async function handleLogin(event) {
    event.preventDefault();

    const form = event.currentTarget;

    const email = form.querySelector("#email").value.trim().toLowerCase();
    const password = form.querySelector("#password").value;

    if (!email || !password) {
        showMessage(form, "Please enter your email and password.", "error");
        return;
    }

    try {
        // Retrieve registered users
        const users = ExpenseStorage.getUsers();

        // Find the account matching the email
        const user = users.find(
            registeredUser => registeredUser.email.toLowerCase() === email
        );

        if (!user) {
            showMessage(form, "Invalid email or password.", "error");
            return;
        }

        // Check whether the browser supports secure password hashing
        if (!crypto.subtle) {
            throw new Error(
                "Secure browser context required. Use localhost or HTTPS."
            );
        }

        // Verify the entered password
        const isPasswordValid = await verifyPassword(password, user);

        if (!isPasswordValid) {
            showMessage(form, "Invalid email or password.", "error");
            return;
        }

        // Create a session without storing credential information
        const session = {
            userId: user.id,
            username: user.username,
            email: user.email,
            loggedInAt: new Date().toISOString()
        };

        // Save the session
        ExpenseStorage.saveSession(session);

        showMessage(
            form,
            "Login successful! Redirecting to dashboard...",
            "success"
        );

        form.reset();

        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1000);

    } catch (error) {
        console.error("Login error:", error);

        showMessage(
            form,
            error.message || "Something went wrong during login.",
            "error"
        );
    }
}


//  5. CONNECT FORMS TO EVENT HANDLERS

document.addEventListener("DOMContentLoaded", () => {

    const signupForm = document.querySelector(".signup-form");
    const loginForm = document.querySelector(".login-form");

    // Attach signup event
    if (signupForm) {
        signupForm.addEventListener("submit", handleSignup);
    }

    // Attach login event
    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

});
