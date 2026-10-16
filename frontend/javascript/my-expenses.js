const expenseModal = document.getElementById("expenseModal");
const incomeModal = document.getElementById("incomeModal");

const addExpenseButton =
    document.querySelector(".add-expense-button");

const addIncomeButton =
    document.querySelector(".add-income-button");

const closeButtons =
    document.querySelectorAll("[data-close]");


addExpenseButton.addEventListener("click", function () {

    expenseModal.classList.add("active");

});


addIncomeButton.addEventListener("click", function () {

    incomeModal.classList.add("active");

});


closeButtons.forEach(function (button) {

    button.addEventListener("click", function () {

        const modalId = button.dataset.close;

        document
            .getElementById(modalId)
            .classList.remove("active");

    });

});

const actionButtons =
    document.querySelectorAll(".action-menu-button");


actionButtons.forEach(function (button) {

    button.addEventListener("click", function (event) {

        event.stopPropagation();

        const menu =
            button.nextElementSibling;

        menu.classList.toggle("active");

    });

});