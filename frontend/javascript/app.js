
//    EXPENSE TRACKER - APPLICATION CONTROLLER


document.addEventListener("DOMContentLoaded", () => {

    // Get the current page filename
    const currentPage = window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();

    // Pages that require login
    const protectedPages = [
        "dashboard.html"
    ];

    // Pages that should only be accessed when logged out
    const authPages = [
        "login.html",
        "signup.html"
    ];

    // Retrieve the current login session
    const session = ExpenseStorage.getSession();

    const isProtectedPage = protectedPages.includes(currentPage);
    const isAuthPage = authPages.includes(currentPage);

    // =====================================
    // 1. PROTECT PAGES FROM UNAUTHENTICATED USERS
    // =====================================

    if (isProtectedPage && !session) {
        window.location.replace("login.html");
        return;
    }

    // =====================================
    // 2. REDIRECT LOGGED-IN USERS
    // =====================================

    if (isAuthPage && session) {
        window.location.replace("dashboard.html");
        return;
    }

    // =====================================
    // 3. HANDLE LOGOUT
    // =====================================

    const logoutLink = document.querySelector(".logout-section a");

    if (logoutLink) {

        logoutLink.addEventListener("click", (event) => {

            event.preventDefault();

            // Clear only the current session
            ExpenseStorage.clearSession();

            // Redirect to login
            window.location.replace("login.html");

        });

    }

});
