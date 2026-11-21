


// ========================================
// EXPENSE TRACKER - LOCAL STORAGE MODULE
// ========================================

// Centralized names for Local Storage keys
const STORAGE_KEYS = {
    USERS: "expense_tracker_users",
    SESSION: "expense_tracker_session"
};


// ========================================
// HELPER FUNCTION
// ========================================

// Retrieve and convert stored JSON data
function getStoredData(key, defaultValue) {
    const storedData = localStorage.getItem(key);

    if (storedData === null) {
        return defaultValue;
    }

    try {
        return JSON.parse(storedData);
    } catch (error) {
        console.error(`Invalid data stored for key: ${key}`, error);
        return defaultValue;
    }
}


// ========================================
// USER STORAGE FUNCTIONS
// ========================================

// Retrieve all registered users
function getUsers() {
    const users = getStoredData(STORAGE_KEYS.USERS, []);

    return Array.isArray(users) ? users : [];
}


// Save the complete users array
function saveUsers(users) {
    if (!Array.isArray(users)) {
        throw new TypeError("Users must be an array.");
    }

    localStorage.setItem(
        STORAGE_KEYS.USERS,
        JSON.stringify(users)
    );
}


// ========================================
// SESSION STORAGE FUNCTIONS
// ========================================

// Retrieve the currently logged-in user session
function getSession() {
    const session = getStoredData(STORAGE_KEYS.SESSION, null);

    if (
        session === null ||
        typeof session !== "object" ||
        typeof session.userId !== "string"
    ) {
        return null;
    }

    return session;
}


// Save the current user's session
function saveSession(session) {
    if (
        !session ||
        typeof session !== "object" ||
        typeof session.userId !== "string"
    ) {
        throw new TypeError("A valid user session is required.");
    }

    localStorage.setItem(
        STORAGE_KEYS.SESSION,
        JSON.stringify(session)
    );
}


// Clear only the current login session
function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
}


// ========================================
// PUBLIC STORAGE API
// ========================================

window.ExpenseStorage = {
    getUsers,
    saveUsers,
    getSession,
    saveSession,
    clearSession
};
