const API = "/api/employees";

const tbody = document.getElementById("employeeTable");
const search = document.getElementById("searchInput");
const sortBy = document.getElementById("sortBy");
const sortButton = document.getElementById("sortOrder");
const dialog = document.getElementById("employeeDialog");
const form = document.getElementById("employeeForm");
const errorBox = document.getElementById("formError");
const saveButton = document.getElementById("saveEmployeeBtn");
const notice = document.getElementById("notice");

let employees = [];
let order = "DESC";
let timer;

document.getElementById("year").textContent =
    new Date().getFullYear();

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function formatMoney(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(value || 0));
}

function getInitials(name) {
    return String(name || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0] || "")
        .join("")
        .toUpperCase();
}

function showMessage(text, type = "info") {
    notice.textContent = text;
    notice.className = `notice ${type}`;
    notice.hidden = false;

    clearTimeout(showMessage.timer);

    showMessage.timer = setTimeout(() => {
        notice.hidden = true;
    }, 4500);
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let result = {};

    try {
        result = await response.json();
    } catch (_) {
        // The response did not contain JSON.
    }

    if (!response.ok) {
        const errorMessage = Array.isArray(result.errors)
            ? result.errors.join(" ")
            : result.message;

        throw new Error(
            errorMessage || `Request failed: ${response.status}`
        );
    }

    return result;
}

async function loadEmployees() {
    tbody.innerHTML = `
        <tr>
            <td colspan="6">Loading employees...</td>
        </tr>
    `;

    try {
        const params = new URLSearchParams({
            search: search.value.trim(),
            sortBy: sortBy.value,
            order: order
        });

        const result = await apiRequest(`${API}?${params}`);

        employees = result.data || [];

        renderEmployees();
        updateStatistics();

    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    Unable to load employees.
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        document.getElementById("tableSummary").textContent =
            "Unable to load records";

        showMessage(error.message, "error");
    }
}

function renderEmployees() {
    if (employees.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    ${
                        search.value.trim()
                            ? "No employees match your search."
                            : "No employee records yet. Click Add Employee to create one."
                    }
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = employees.map(employee => `
            <tr>
                <td>
                    <div class="person">
                        <span class="avatar">
                            ${escapeHTML(getInitials(employee.name))}
                        </span>

                        <div>
                            <b>${escapeHTML(employee.name)}</b>
                            <div>
                                EMP-${String(employee.id).padStart(4, "0")}
                            </div>
                        </div>
                    </div>
                </td>

                <td>
                    <span class="dept">
                        ${escapeHTML(employee.department)}
                    </span>
                </td>

                <td>${escapeHTML(employee.role)}</td>

                <td>
                    <b>${formatMoney(employee.salary)}</b>
                </td>

                <td>
                    ${escapeHTML(String(employee.join_date).slice(0, 10))}
                </td>

                <td>
                    <div class="actions">
                        <button
                            class="action"
                            data-action="edit"
                            data-id="${employee.id}"
                        >
                            Edit
                        </button>

                        <button
                            class="action delete"
                            data-action="delete"
                            data-id="${employee.id}"
                        >
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join("");
    }

    document.getElementById("tableSummary").textContent =
        `${employees.length} employee(s) shown`;

    document.getElementById("showingEmployees").textContent =
        employees.length;
}

function updateStatistics() {
    document.getElementById("totalEmployees").textContent =
        employees.length;

    const departments = new Set(
        employees.map(employee =>
            String(employee.department).toLowerCase()
        )
    );

    document.getElementById("totalDepartments").textContent =
        departments.size;
}

function openAddForm() {
    form.reset();

    document.getElementById("employeeId").value = "";

    document.getElementById("dialogTitle").textContent =
        "Add Employee";

    saveButton.textContent = "Save Employee";
    errorBox.hidden = true;

    dialog.showModal();
}

function openEditForm(employee) {
    form.reset();

    document.getElementById("employeeId").value = employee.id;

    document.getElementById("name").value = employee.name;
    document.getElementById("department").value =
        employee.department;
    document.getElementById("role").value = employee.role;
    document.getElementById("salary").value = employee.salary;
    document.getElementById("join_date").value =
        String(employee.join_date).slice(0, 10);

    document.getElementById("dialogTitle").textContent =
        "Edit Employee";

    saveButton.textContent = "Update Employee";
    errorBox.hidden = true;

    dialog.showModal();
}

document.getElementById("addEmployeeBtn")
    .addEventListener("click", openAddForm);

document.getElementById("closeDialog")
    .addEventListener("click", () => dialog.close());

document.getElementById("cancelDialog")
    .addEventListener("click", () => dialog.close());

search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(loadEmployees, 250);
});

sortBy.addEventListener("change", loadEmployees);

sortButton.addEventListener("click", () => {
    order = order === "DESC" ? "ASC" : "DESC";

    sortButton.textContent =
        order === "DESC" ? "Newest" : "Oldest";

    loadEmployees();
});

tbody.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = Number(button.dataset.id);

    const employee = employees.find(
        item => Number(item.id) === id
    );

    if (button.dataset.action === "edit" && employee) {
        openEditForm(employee);
        return;
    }

    if (
        button.dataset.action === "delete" &&
        employee &&
        confirm(`Delete ${employee.name}? This cannot be undone.`)
    ) {
        button.disabled = true;

        try {
            const result = await apiRequest(`${API}/${id}`, {
                method: "DELETE"
            });

            showMessage(result.message, "success");

            await loadEmployees();

        } catch (error) {
            showMessage(error.message, "error");
            button.disabled = false;
        }
    }
});

form.addEventListener("submit", async event => {
    event.preventDefault();

    errorBox.hidden = true;

    if (!form.reportValidity()) return;

    const employee = {
        name: document.getElementById("name").value.trim(),
        department:
            document.getElementById("department").value.trim(),
        role: document.getElementById("role").value.trim(),
        salary: document.getElementById("salary").value,
        join_date: document.getElementById("join_date").value
    };

    if (
        !employee.name ||
        !employee.department ||
        !employee.role ||
        employee.salary === "" ||
        Number(employee.salary) < 0 ||
        !employee.join_date
    ) {
        errorBox.textContent =
            "Complete all fields and enter a non-negative salary.";

        errorBox.hidden = false;
        return;
    }

    const id = document.getElementById("employeeId").value;

    saveButton.disabled = true;
    saveButton.textContent = id ? "Updating..." : "Saving...";

    try {
        const result = await apiRequest(
            id ? `${API}/${id}` : API,
            {
                method: id ? "PUT" : "POST",
                body: JSON.stringify(employee)
            }
        );

        dialog.close();

        showMessage(result.message, "success");

        await loadEmployees();

    } catch (error) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;

    } finally {
        saveButton.disabled = false;

        saveButton.textContent =
            document.getElementById("employeeId").value
                ? "Update Employee"
                : "Save Employee";
    }
});

loadEmployees();