document.querySelectorAll(".category-menu-button").forEach((button) => {
    button.addEventListener("click", (event) => {
        event.stopPropagation();

        const currentMenu = button
            .closest(".category-menu-wrapper")
            .querySelector(".category-action-menu");

        const shouldOpen = currentMenu.hidden;

        // Close all category menus first
        document.querySelectorAll(".category-action-menu").forEach((menu) => {
            menu.hidden = true;
        });

        // Toggle the clicked menu
        currentMenu.hidden = !shouldOpen;
    });
});

// Close menus when clicking elsewhere
document.addEventListener("click", () => {
    document.querySelectorAll(".category-action-menu").forEach((menu) => {
        menu.hidden = true;
    });
});