require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("./db");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const fields = [
    "name",
    "department",
    "role",
    "salary",
    "join_date"
];

const employeeSelect = `
    SELECT
        id,
        name,
        department,
        role,
        salary,
        DATE_FORMAT(join_date, '%Y-%m-%d') AS join_date,
        created_at,
        updated_at
    FROM employees
`;

function validateEmployee(body) {
    const errors = [];

    for (const field of fields) {
        if (
            body[field] === undefined ||
            body[field] === null ||
            String(body[field]).trim() === ""
        ) {
            errors.push(`${field} is required.`);
        }
    }

    for (const field of ["name", "department", "role"]) {
        if (
            body[field] &&
            String(body[field]).trim().length > 100
        ) {
            errors.push(`${field} cannot exceed 100 characters.`);
        }
    }

    if (
        body.salary !== undefined &&
        (
            !Number.isFinite(Number(body.salary)) ||
            Number(body.salary) < 0
        )
    ) {
        errors.push("Salary must be a valid non-negative number.");
    }

    if (
        body.join_date &&
        !/^\d{4}-\d{2}-\d{2}$/.test(String(body.join_date))
    ) {
        errors.push("Join date must use YYYY-MM-DD format.");
    }

    return errors;
}

function cleanEmployee(body) {
    return {
        name: String(body.name).trim(),
        department: String(body.department).trim(),
        role: String(body.role).trim(),
        salary: Number(body.salary),
        join_date: String(body.join_date)
    };
}

// Check API status
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Employee API is running."
    });
});

// Get all employees, with search and sorting
app.get("/api/employees", async (req, res, next) => {
    try {
        const search = String(req.query.search || "").trim();

        const allowedSort = new Set([
            "id",
            "name",
            "department",
            "role",
            "salary",
            "join_date"
        ]);

        const sortBy = allowedSort.has(req.query.sortBy)
            ? req.query.sortBy
            : "id";

        const order =
            String(req.query.order || "DESC").toUpperCase() === "ASC"
                ? "ASC"
                : "DESC";

        const pattern = `%${search}%`;

        const [rows] = await pool.execute(
            `${employeeSelect}
             WHERE name LIKE ?
                OR department LIKE ?
                OR role LIKE ?
             ORDER BY ${sortBy} ${order}`,
            [pattern, pattern, pattern]
        );

        res.json({
            data: rows,
            count: rows.length
        });
    } catch (error) {
        next(error);
    }
});

// Get one employee
app.get("/api/employees/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                message: "Invalid employee ID."
            });
        }

        const [rows] = await pool.execute(
            `${employeeSelect} WHERE id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Employee not found."
            });
        }

        res.json({
            data: rows[0]
        });
    } catch (error) {
        next(error);
    }
});

// Add employee
app.post("/api/employees", async (req, res, next) => {
    try {
        const errors = validateEmployee(req.body);

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Please correct the form fields.",
                errors
            });
        }

        const employee = cleanEmployee(req.body);

        const [result] = await pool.execute(
            `INSERT INTO employees
             (name, department, role, salary, join_date)
             VALUES (?, ?, ?, ?, ?)`,
            [
                employee.name,
                employee.department,
                employee.role,
                employee.salary,
                employee.join_date
            ]
        );

        const [rows] = await pool.execute(
            `${employeeSelect} WHERE id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            message: "Employee added successfully.",
            data: rows[0]
        });
    } catch (error) {
        next(error);
    }
});

// Update employee
app.put("/api/employees/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                message: "Invalid employee ID."
            });
        }

        const errors = validateEmployee(req.body);

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Please correct the form fields.",
                errors
            });
        }

        const employee = cleanEmployee(req.body);

        const [result] = await pool.execute(
            `UPDATE employees
             SET name = ?,
                 department = ?,
                 role = ?,
                 salary = ?,
                 join_date = ?
             WHERE id = ?`,
            [
                employee.name,
                employee.department,
                employee.role,
                employee.salary,
                employee.join_date,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Employee not found."
            });
        }

        const [rows] = await pool.execute(
            `${employeeSelect} WHERE id = ?`,
            [id]
        );

        res.json({
            message: "Employee updated successfully.",
            data: rows[0]
        });
    } catch (error) {
        next(error);
    }
});

// Delete employee
app.delete("/api/employees/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                message: "Invalid employee ID."
            });
        }

        const [result] = await pool.execute(
            "DELETE FROM employees WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Employee not found."
            });
        }

        res.json({
            message: "Employee deleted successfully."
        });
    } catch (error) {
        next(error);
    }
});

// Error handler
app.use((error, req, res, next) => {
    console.error(error);

    res.status(500).json({
        message:
            "Internal server error. Check MySQL and your .env settings."
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});