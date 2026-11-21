/*
 * ExpenseWise Reports v1.0
 * IMPORTANT: Update the storage key and field names below to match your My Expenses JS.
 * Expected expense date format: YYYY-MM-DD (or a date string JavaScript can parse).
 */

const REPORT_CONFIG = {
    // Change these values to match your actual Local Storage structure.
    expensesStorageKey: "expenses",
    budgetsStorageKey: "budgets",

    // Expense object property names:
    fields: {
        id: "id",
        title: "title",
        amount: "amount",
        category: "category",
        date: "date"
    },

    // If your budgets are stored as an array, each item should look like:
    // { category: "Groceries", limit: 16000 }
    // Or as an object: { "Groceries": 16000, "Transport": 5000 }
    budgetFields: {
        category: "category",
        limit: "limit"
    },

    currency: "INR",
    locale: "en-IN"
};

const CATEGORY_COLORS = [
    "#2e7d32", "#f59e0b", "#8b5cf6", "#0284c7",
    "#db2777", "#0d9488", "#64748b", "#ca8a04"
];

const state = {
    expenses: [],
    budgets: [],
    filteredExpenses: [],
    period: "this-month",
    category: "all",
    startDate: null,
    endDate: null
};

const $ = (selector) => document.querySelector(selector);

document.addEventListener("DOMContentLoaded", initializeReports);

function initializeReports() {
    loadStoredData();
    populateCategoryFilter();
    setDefaultCustomDates();
    attachEventListeners();
    renderReports();
}

function loadStoredData() {
    state.expenses = readLocalStorageArray(REPORT_CONFIG.expensesStorageKey);
    state.budgets = normalizeBudgets(readLocalStorageValue(REPORT_CONFIG.budgetsStorageKey));

    if (!state.expenses.length) {
        setMessage("No expense records were found. Add expenses from My Expenses to populate your reports.");
    }
}

function readLocalStorageValue(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error(`Could not read Local Storage key "${key}".`, error);
        setMessage(`Could not read "${key}" from Local Storage. Check the storage key and stored JSON format.`);
        return null;
    }
}

function readLocalStorageArray(key) {
    const value = readLocalStorageValue(key);
    if (Array.isArray(value)) return value;

    // Also support common wrappers such as { expenses: [...] } or { data: [...] }.
    if (value && Array.isArray(value.expenses)) return value.expenses;
    if (value && Array.isArray(value.data)) return value.data;
    return [];
}

function normalizeBudgets(rawBudgets) {
    if (Array.isArray(rawBudgets)) {
        return rawBudgets.map((item) => ({
            category: String(item?.[REPORT_CONFIG.budgetFields.category] ?? ""),
            limit: toNumber(item?.[REPORT_CONFIG.budgetFields.limit])
        })).filter((item) => item.category && item.limit > 0);
    }

    if (rawBudgets && typeof rawBudgets === "object") {
        return Object.entries(rawBudgets)
            .map(([category, limit]) => ({ category, limit: toNumber(limit) }))
            .filter((item) => item.category && item.limit > 0);
    }

    return [];
}

function attachEventListeners() {
    $("#period-filter").addEventListener("change", (event) => {
        state.period = event.target.value;
        $("#custom-date-controls").hidden = state.period !== "custom";
        renderReports();
    });

    $("#category-filter").addEventListener("change", (event) => {
        state.category = event.target.value;
        renderReports();
    });

    $("#start-date").addEventListener("change", renderReports);
    $("#end-date").addEventListener("change", renderReports);

    $("#export-csv-btn").addEventListener("click", exportFilteredExpensesToCSV);

    // Repaint canvas charts when the browser window changes size.
    window.addEventListener("resize", debounce(() => {
        renderTrendChart(state.filteredExpenses);
        renderCategoryChart(state.filteredExpenses);
    }, 120));

    // Keep reports in sync if another page/tab updates Local Storage.
    window.addEventListener("storage", (event) => {
        if (event.key === REPORT_CONFIG.expensesStorageKey ||
            event.key === REPORT_CONFIG.budgetsStorageKey) {
            loadStoredData();
            populateCategoryFilter();
            renderReports();
        }
    });
}

function setDefaultCustomDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    $("#start-date").value = toDateInputValue(firstDay);
    $("#end-date").value = toDateInputValue(today);
}

function populateCategoryFilter() {
    const select = $("#category-filter");
    const previousValue = state.category;
    const categories = [...new Set(state.expenses.map(getExpenseCategory).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));

    select.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });

    if (categories.includes(previousValue)) {
        select.value = previousValue;
    } else {
        state.category = "all";
        select.value = "all";
    }
}

function renderReports() {
    const period = getSelectedPeriod();
    if (!period) {
        state.filteredExpenses = [];
        $("#date-error").textContent = "Please choose a valid date range. The start date must not be after the end date.";
        renderSummary([]);
        renderTrendChart([]);
        renderCategoryChart([]);
        renderBudgetTable([]);
        return;
    }

    $("#date-error").textContent = "";
    state.filteredExpenses = state.expenses.filter((expense) => {
        const date = getExpenseDate(expense);
        const matchesDate = date && date >= period.start && date <= period.end;
        const matchesCategory = state.category === "all" || getExpenseCategory(expense) === state.category;
        return matchesDate && matchesCategory;
    });

    renderSummary(state.filteredExpenses);
    renderTrendChart(state.filteredExpenses);
    renderCategoryChart(state.filteredExpenses);
    renderBudgetTable(state.filteredExpenses);
}

function getSelectedPeriod() {
    const now = new Date();
    const today = startOfDay(now);
    let start;
    let end = endOfDay(now);

    switch (state.period) {
        case "this-month":
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case "last-month":
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
            break;
        case "last-3-months":
            start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            break;
        case "this-year":
            start = new Date(now.getFullYear(), 0, 1);
            break;
        case "all-time": {
            const dates = state.expenses.map(getExpenseDate).filter(Boolean).sort((a, b) => a - b);
            start = dates.length ? startOfDay(dates[0]) : today;
            break;
        }
        case "custom":
            start = parseDateInput($("#start-date").value);
            end = parseDateInput($("#end-date").value);
            if (!start || !end || start > end) return null;
            end = endOfDay(end);
            break;
        default:
            start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { start: startOfDay(start), end };
}

function renderSummary(expenses) {
    const total = expenses.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
    const categoryTotals = getCategoryTotals(expenses);
    const topCategory = categoryTotals.length ? categoryTotals[0] : null;
    const activeBudgetTotal = getTotalBudgetForPeriod();
    const budgetSpent = getBudgetPeriodExpenses().reduce((sum, expense) => sum + getExpenseAmount(expense), 0);

    $("#total-expenses").textContent = formatCurrency(total);

    if (activeBudgetTotal > 0) {
        $("#budget-remaining").textContent = formatCurrency(activeBudgetTotal - budgetSpent);
        $("#budget-summary-note").textContent = `of ${formatCurrency(activeBudgetTotal)} allocated budget`;
    } else {
        $("#budget-remaining").textContent = "—";
        $("#budget-summary-note").textContent = "No budget data available";
    }

    const selectedPeriod = getSelectedPeriod();
    const days = selectedPeriod
        ? Math.max(1, Math.floor((startOfDay(selectedPeriod.end) - startOfDay(selectedPeriod.start)) / 86400000) + 1)
        : 1;
    $("#daily-average").textContent = formatCurrency(total / days);
    $("#daily-average-note").textContent = `Across ${days} day${days === 1 ? "" : "s"}`;

    $("#top-category").textContent = topCategory ? topCategory.category : "—";
    $("#top-category-note").textContent = topCategory
        ? `${formatCurrency(topCategory.amount)} (${((topCategory.amount / (total || 1)) * 100).toFixed(1)}% of total)`
        : "No expenses recorded";
}

function renderTrendChart(expenses) {
    const canvas = $("#spending-trend-chart");
    const empty = $("#trend-empty");
    const ctx = prepareCanvas(canvas);
    const period = getSelectedPeriod();

    if (!expenses.length || !period) {
        empty.hidden = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }
    empty.hidden = true;

    const dailyTotals = new Map();
    expenses.forEach((expense) => {
        const date = getExpenseDate(expense);
        if (!date) return;
        const key = toDateInputValue(date);
        dailyTotals.set(key, (dailyTotals.get(key) || 0) + getExpenseAmount(expense));
    });

    const days = enumerateDays(period.start, period.end);
    // For very long ranges, group by month to keep the chart readable.
    const useMonthly = days.length > 100;
    const pointsMap = new Map();

    if (useMonthly) {
        expenses.forEach((expense) => {
            const date = getExpenseDate(expense);
            if (!date) return;
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            pointsMap.set(key, (pointsMap.get(key) || 0) + getExpenseAmount(expense));
        });
    } else {
        dailyTotals.forEach((amount, key) => pointsMap.set(key, amount));
    }

    const labels = useMonthly
        ? enumerateMonths(period.start, period.end)
        : days.map(toDateInputValue);
    const values = labels.map((key) => pointsMap.get(key) || 0);
    drawLineChart(ctx, canvas, labels, values, useMonthly);
}

function drawLineChart(ctx, canvas, labels, values, monthly) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const pad = { top: 18, right: 16, bottom: 42, left: 58 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const maxValue = Math.max(1, ...values);
    const niceMax = niceAxisMaximum(maxValue);
    const tickCount = 5;

    ctx.clearRect(0, 0, width, height);
    ctx.font = `${Math.max(11, width * 0.012)}px Arial`;
    ctx.textBaseline = "middle";

    for (let i = 0; i <= tickCount; i++) {
        const value = niceMax - (niceMax / tickCount) * i;
        const y = pad.top + (plotHeight / tickCount) * i;
        ctx.strokeStyle = "#e8eef5";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();

        ctx.fillStyle = "#71829c";
        ctx.textAlign = "right";
        ctx.fillText(formatAxisCurrency(value), pad.left - 10, y);
    }

    const xFor = (index) => labels.length <= 1
        ? pad.left + plotWidth / 2
        : pad.left + (plotWidth * index) / (labels.length - 1);
    const yFor = (value) => pad.top + plotHeight - (value / niceMax) * plotHeight;

    ctx.strokeStyle = "#2e7d32";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    values.forEach((value, index) => {
        const x = xFor(index);
        const y = yFor(value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    values.forEach((value, index) => {
        const x = xFor(index);
        const y = yFor(value);
        ctx.fillStyle = "#2e7d32";
        ctx.beginPath();
        ctx.arc(x, y, labels.length > 45 ? 2 : 3, 0, Math.PI * 2);
        ctx.fill();
    });

    const labelCount = Math.min(10, labels.length);
    for (let i = 0; i < labelCount; i++) {
        const index = labelCount === 1 ? 0 : Math.round(i * (labels.length - 1) / (labelCount - 1));
        const x = xFor(index);
        ctx.fillStyle = "#71829c";
        ctx.textAlign = "center";
        ctx.fillText(formatChartLabel(labels[index], monthly), x, height - 18);
    }
}

function renderCategoryChart(expenses) {
    const canvas = $("#category-donut-chart");
    const ctx = prepareCanvas(canvas);
    const totals = getCategoryTotals(expenses);
    const legend = $("#category-legend");
    const empty = $("#category-empty");

    $("#category-count").textContent = `${totals.length} Categor${totals.length === 1 ? "y" : "ies"}`;
    legend.innerHTML = "";

    if (!totals.length) {
        empty.hidden = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }
    empty.hidden = true;

    const total = totals.reduce((sum, item) => sum + item.amount, 0);
    const centerX = canvas.clientWidth / 2;
    const centerY = canvas.clientHeight / 2;
    const radius = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.43;
    const innerRadius = radius * 0.64;
    let angle = -Math.PI / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    totals.forEach((item, index) => {
        const slice = (item.amount / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, angle, angle + slice);
        ctx.arc(centerX, centerY, innerRadius, angle + slice, angle, true);
        ctx.closePath();
        ctx.fillStyle = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
        ctx.fill();
        angle += slice;
    });

    totals.forEach((item, index) => {
        const percent = (item.amount / total) * 100;
        const row = document.createElement("div");
        row.className = "legend-row";

        const name = document.createElement("div");
        name.className = "legend-name";
        const dot = document.createElement("i");
        dot.className = "legend-dot";
        dot.style.backgroundColor = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
        const label = document.createElement("span");
        label.textContent = item.category;
        name.append(dot, label);

        const amount = document.createElement("span");
        amount.className = "legend-amount";
        amount.textContent = formatCurrency(item.amount);

        const percentage = document.createElement("span");
        percentage.className = "legend-percent";
        percentage.textContent = `${percent.toFixed(1)}%`;

        row.append(name, amount, percentage);
        legend.appendChild(row);
    });
}

function renderBudgetTable(filteredExpenses) {
    const tbody = $("#budget-table-body");
    tbody.innerHTML = "";

    if (!state.budgets.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No budget data available. Add category budgets to see performance.</td></tr>';
        return;
    }

    // Budget performance in the reference is for the active month.
    const monthExpenses = getBudgetPeriodExpenses();
    const spentByCategory = new Map();
    monthExpenses.forEach((expense) => {
        const category = getExpenseCategory(expense);
        if (category) spentByCategory.set(category, (spentByCategory.get(category) || 0) + getExpenseAmount(expense));
    });

    state.budgets.forEach((budget, index) => {
        const spent = spentByCategory.get(budget.category) || 0;
        const remaining = budget.limit - spent;
        const usage = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;
        const status = usage > 100
            ? { label: "Exceeded", className: "status-exceeded", color: "#e11d48" }
            : usage > 80
                ? { label: "Warning", className: "status-warning", color: "#f59e0b" }
                : { label: "Safe", className: "status-safe", color: "#059669" };

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><div class="budget-category">
                <i class="legend-dot" style="background:${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}"></i>
                <span></span>
            </div></td>
            <td></td>
            <td class="amount-strong"></td>
            <td></td>
            <td class="progress-cell">
                <span class="progress-line"><span class="progress-fill" style="width:${Math.min(100, Math.max(0, usage))}%;background:${status.color}"></span></span>
                <span class="progress-label">${Math.round(usage)}%</span>
            </td>
            <td><span class="status-pill ${status.className}">${status.label}</span></td>
        `;

        tr.querySelector(".budget-category span").textContent = budget.category;
        const cells = tr.querySelectorAll("td");
        cells[1].textContent = formatCurrency(budget.limit);
        cells[2].textContent = formatCurrency(spent);
        cells[3].textContent = formatCurrency(remaining);
        tbody.appendChild(tr);
    });
}

function getBudgetPeriodExpenses() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endOfDay(now);
    return state.expenses.filter((expense) => {
        const date = getExpenseDate(expense);
        return date && date >= start && date <= end;
    });
}

function getTotalBudgetForPeriod() {
    return state.budgets.reduce((sum, budget) => sum + budget.limit, 0);
}

function getCategoryTotals(expenses) {
    const totals = new Map();
    expenses.forEach((expense) => {
        const category = getExpenseCategory(expense) || "Uncategorized";
        totals.set(category, (totals.get(category) || 0) + getExpenseAmount(expense));
    });
    return [...totals.entries()]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);
}

function getExpenseAmount(expense) {
    return Math.max(0, toNumber(expense?.[REPORT_CONFIG.fields.amount]));
}

function getExpenseCategory(expense) {
    return String(expense?.[REPORT_CONFIG.fields.category] ?? "").trim();
}

function getExpenseDate(expense) {
    const value = expense?.[REPORT_CONFIG.fields.date];
    if (!value) return null;

    // Parse YYYY-MM-DD as a local date to avoid timezone shifting it to the previous day.
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function exportFilteredExpensesToCSV() {
    const expenses = state.filteredExpenses;
    if (!expenses.length) {
        setMessage("There are no expense records in the selected report to export.");
        return;
    }

    const field = REPORT_CONFIG.fields;
    const headers = ["Expense ID", "Title", "Amount", "Category", "Date"];
    const rows = expenses.map((expense) => [
        expense?.[field.id] ?? "",
        expense?.[field.title] ?? "",
        getExpenseAmount(expense),
        getExpenseCategory(expense),
        expense?.[field.date] ?? ""
    ]);

    const csv = [headers, ...rows]
        .map((row) => row.map(csvSafeCell).join(","))
        .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `expense-report-${toDateInputValue(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`CSV report exported with ${expenses.length} expense record(s).`);
}

function csvSafeCell(value) {
    let text = String(value ?? "");
    // Prevent spreadsheet formula execution for untrusted text fields.
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
}

function prepareCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Drawing dimensions below use CSS pixels after setting the transform.
    return ctx;
}

function toNumber(value) {
    const number = Number(String(value ?? 0).replace(/,/g, ""));
    return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value) {
    return new Intl.NumberFormat(REPORT_CONFIG.locale, {
        style: "currency",
        currency: REPORT_CONFIG.currency,
        maximumFractionDigits: 0
    }).format(Number.isFinite(value) ? value : 0);
}

function formatAxisCurrency(value) {
    if (value >= 1000) {
        const short = value / 1000;
        return `₹${Number.isInteger(short) ? short : short.toFixed(1)}k`;
    }
    return `₹${Math.round(value)}`;
}

function niceAxisMaximum(value) {
    if (value <= 0) return 1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / magnitude;
    const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return nice * magnitude;
}

function formatChartLabel(key, monthly) {
    if (monthly) {
        const [year, month] = key.split("-").map(Number);
        return new Date(year, month - 1, 1).toLocaleDateString(REPORT_CONFIG.locale, { month: "short", year: "2-digit" });
    }
    const date = parseDateInput(key);
    return date ? date.toLocaleDateString(REPORT_CONFIG.locale, { day: "2-digit", month: "2-digit" }) : key;
}

function enumerateDays(start, end) {
    const result = [];
    const cursor = startOfDay(start);
    const last = startOfDay(end);
    while (cursor <= last) {
        result.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return result;
}

function enumerateMonths(start, end) {
    const result = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
        result.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return result;
}

function parseDateInput(value) {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInputValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function debounce(callback, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => callback(...args), delay);
    };
}

function setMessage(message) {
    $("#reports-message").textContent = message || "";
}
