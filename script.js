"use strict";

/* =========================================
   SAVIMBI CLINIC PATIENT MANAGEMENT SYSTEM
   ========================================= */

const STORAGE_KEY = "savimbiPatients";

let patients = [];
let editingId = null;
let pendingPhoto = "";


/* =========================================
   ELEMENTS
   ========================================= */

const patientForm = document.getElementById("patientForm");

const nameInput = document.getElementById("name");
const patientIdInput = document.getElementById("patientId");
const phoneInput = document.getElementById("phone");
const ageInput = document.getElementById("age");
const genderInput = document.getElementById("gender");
const reasonInput = document.getElementById("reason");

const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photoPreview");
const removePhotoBtn = document.getElementById("removePhoto");

const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEdit");

const patientsTableBody = document.getElementById("patientsTableBody");
const tableEmpty = document.getElementById("tableEmpty");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");

const totalPatients = document.getElementById("totalPatients");
const registeredToday = document.getElementById("registeredToday");
const currentlyInClinic = document.getElementById("currentlyInClinic");
const completedVisits = document.getElementById("completedVisits");

const recentPatients = document.getElementById("recentPatients");

const toast = document.getElementById("toast");

const pageTitle = document.getElementById("pageTitle");


/* =========================================
   LOAD DATA
   ========================================= */

function loadPatients() {

    try {

        const stored = localStorage.getItem(STORAGE_KEY);

        if (!stored) {
            return [];
        }

        const data = JSON.parse(stored);

        if (!Array.isArray(data)) {
            return [];
        }

        return data;

    } catch (error) {

        console.error("Could not load patients:", error);

        return [];

    }
}


/* =========================================
   SAVE DATA
   ========================================= */

function savePatients() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(patients)
        );

        return true;

    } catch (error) {

        console.error("Could not save patients:", error);

        showToast(
            "Unable to save data. Browser storage may be full."
        );

        return false;
    }
}


/* =========================================
   GENERATE ID
   ========================================= */

function generateId() {

    if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
    ) {
        return window.crypto.randomUUID();
    }

    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2)
    );
}


/* =========================================
   DATE / TIME
   ========================================= */

function getDateTime() {

    const now = new Date();

    return {
        date: now.toISOString().split("T")[0],
        time: now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        }),
        timestamp: now.getTime()
    };

}


/* =========================================
   FORMAT DATE
   ========================================= */

function formatDate(dateString) {

    if (!dateString) {
        return "-";
    }

    const date = new Date(dateString + "T00:00:00");

    return date.toLocaleDateString(
        undefined,
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


/* =========================================
   DURATION
   ========================================= */

function calculateDuration(patient) {

    if (!patient.inTimestamp) {
        return "-";
    }

    const end = patient.outTimestamp
        ? patient.outTimestamp
        : Date.now();

    let minutes = Math.floor(
        (end - patient.inTimestamp) / 60000
    );

    if (minutes < 0) {
        minutes = 0;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }

    return `${mins}m`;
}


/* =========================================
   ESCAPE HTML
   ========================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================
   TOAST
   ========================================= */

let toastTimer;

function showToast(message) {

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);

}


/* =========================================
   PHOTO
   ========================================= */

photoInput.addEventListener("change", function () {

    const file = this.files[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {

        showToast("Please select an image.");

        this.value = "";

        return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {

        pendingPhoto = event.target.result;

        photoPreview.innerHTML =
            `<img src="${pendingPhoto}" alt="Patient Photo">`;

    };

    reader.readAsDataURL(file);

});


removePhotoBtn.addEventListener("click", function () {

    pendingPhoto = "";

    photoInput.value = "";

    photoPreview.innerHTML = "<span>👤</span>";

});


/* =========================================
   FORM SUBMISSION
   ========================================= */

patientForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const name = nameInput.value.trim();
    const patientId = patientIdInput.value.trim();
    const phone = phoneInput.value.trim();
    const age = ageInput.value.trim();
    const gender = genderInput.value;
    const reason = reasonInput.value.trim();

    if (!name || !patientId || !age || !gender || !reason) {

        showToast("Please complete all required fields.");

        return;
    }


    /* CHECK DUPLICATE PATIENT ID */

    const duplicate = patients.find(patient =>

        patient.patientId.toLowerCase() ===
        patientId.toLowerCase() &&

        patient.id !== editingId

    );

    if (duplicate) {

        showToast("That Patient ID already exists.");

        return;
    }


    /* EDIT EXISTING PATIENT */

    if (editingId) {

        const index = patients.findIndex(
            patient => patient.id === editingId
        );

        if (index === -1) {

            showToast("Patient record not found.");

            resetForm();

            return;
        }

        patients[index].name = name;
        patients[index].patientId = patientId;
        patients[index].phone = phone;
        patients[index].age = age;
        patients[index].gender = gender;
        patients[index].reason = reason;

        if (pendingPhoto) {
            patients[index].photo = pendingPhoto;
        }

        if (!savePatients()) {
            return;
        }

        showToast("Patient updated successfully.");

        resetForm();

        renderAll();

        showSection("visits");

        return;
    }


    /* CREATE NEW PATIENT */

    const dateTime = getDateTime();

    const newPatient = {

        id: generateId(),

        name: name,

        patientId: patientId,

        phone: phone,

        age: age,

        gender: gender,

        reason: reason,

        photo: pendingPhoto,

        date: dateTime.date,

        timeIn: dateTime.time,

        inTimestamp: dateTime.timestamp,

        timeOut: "",

        outTimestamp: null,

        status: "In Clinic"

    };


    patients.unshift(newPatient);


    if (!savePatients()) {

        patients.shift();

        return;
    }


    showToast("Patient registered successfully.");

    resetForm();

    renderAll();

    showSection("visits");

});


/* =========================================
   RESET FORM
   ========================================= */

function resetForm() {

    patientForm.reset();

    editingId = null;

    pendingPhoto = "";

    photoInput.value = "";

    photoPreview.innerHTML = "<span>👤</span>";

    document.getElementById("formTitle").textContent =
        "Register New Patient";

    submitBtn.textContent =
        "Register Patient";

}


/* =========================================
   CANCEL / CLEAR
   ========================================= */

cancelEditBtn.addEventListener("click", function () {

    resetForm();

    showToast("Form cleared.");

});


/* =========================================
   RENDER TABLE
   ========================================= */

function renderTable() {

    const search =
        searchInput.value.trim().toLowerCase();

    const filter =
        statusFilter.value;


    const filtered = patients.filter(patient => {

        const matchesSearch =

            patient.name.toLowerCase().includes(search) ||

            patient.patientId.toLowerCase().includes(search) ||

            (patient.phone || "")
                .toLowerCase()
                .includes(search);


        const matchesStatus =

            filter === "all" ||
            patient.status === filter;


        return matchesSearch && matchesStatus;

    });


    patientsTableBody.innerHTML = "";


    if (filtered.length === 0) {

        tableEmpty.classList.remove("hidden");

        return;

    }


    tableEmpty.classList.add("hidden");


    filtered.forEach(patient => {

        const row = document.createElement("tr");

        const photoHTML = patient.photo

            ? `<img src="${patient.photo}" alt="Patient">`

            : `<span>👤</span>`;


        row.innerHTML = `

            <td>

                <div class="patient-cell">

                    <div class="patient-avatar">

                        ${photoHTML}

                    </div>

                    <div>

                        <strong>
                            ${escapeHTML(patient.name)}
                        </strong>

                        <small>
                            ${escapeHTML(patient.reason)}
                        </small>

                    </div>

                </div>

            </td>


            <td>
                ${escapeHTML(patient.patientId)}
            </td>


            <td>
                ${escapeHTML(patient.phone || "-")}
            </td>


            <td>
                ${escapeHTML(patient.age)}
                /
                ${escapeHTML(patient.gender)}
            </td>


            <td>
                ${formatDate(patient.date)}
            </td>


            <td>
                ${escapeHTML(patient.timeIn)}
            </td>


            <td>
                ${escapeHTML(patient.timeOut || "-")}
            </td>


            <td>
                ${calculateDuration(patient)}
            </td>


            <td>

                <span class="status ${
                    patient.status === "Completed"
                        ? "completed"
                        : "in"
                }">

                    ${escapeHTML(patient.status)}

                </span>

            </td>


            <td>

                <div class="actions">

                    ${
                        patient.status === "In Clinic"

                        ? `
                            <button
                                class="action-btn checkout"
                                data-action="checkout"
                                data-id="${patient.id}">
                                Checkout
                            </button>
                          `

                        : ""
                    }


                    <button
                        class="action-btn edit"
                        data-action="edit"
                        data-id="${patient.id}">
                        Edit
                    </button>


                    <button
                        class="action-btn delete"
                        data-action="delete"
                        data-id="${patient.id}">
                        Delete
                    </button>

                </div>

            </td>

        `;


        patientsTableBody.appendChild(row);

    });

}


/* =========================================
   TABLE ACTIONS
   ========================================= */

patientsTableBody.addEventListener("click", function (event) {

    const button =
        event.target.closest("button");

    if (!button) {
        return;
    }

    const action =
        button.dataset.action;

    const id =
        button.dataset.id;


    if (!id) {
        return;
    }


    if (action === "delete") {

        deletePatient(id);

    }


    if (action === "edit") {

        editPatient(id);

    }


    if (action === "checkout") {

        checkoutPatient(id);

    }

});


/* =========================================
   DELETE PATIENT
   ========================================= */

function deletePatient(id) {

    const patient =
        patients.find(p => p.id === id);

    if (!patient) {

        showToast("Patient record not found.");

        return;
    }


    const confirmed = confirm(
        `Delete patient "${patient.name}" permanently?`
    );


    if (!confirmed) {
        return;
    }


    const oldPatients = [...patients];


    patients = patients.filter(
        patient => patient.id !== id
    );


    if (!savePatients()) {

        patients = oldPatients;

        renderAll();

        return;
    }


    showToast("Patient deleted successfully.");

    renderAll();

}


/* =========================================
   DELETE ALL
   ========================================= */

document.getElementById("deleteAllBtn")
    .addEventListener("click", function () {

        if (patients.length === 0) {

            showToast("There are no patient records.");

            return;
        }


        const confirmed = confirm(
            "WARNING: This will permanently delete ALL patient records. Continue?"
        );


        if (!confirmed) {
            return;
        }


        const oldPatients = [...patients];

        patients = [];


        if (!savePatients()) {

            patients = oldPatients;

            renderAll();

            return;
        }


        showToast("All patient records deleted.");

        renderAll();

    });


/* =========================================
   CHECKOUT
   ========================================= */

function checkoutPatient(id) {

    const patient =
        patients.find(p => p.id === id);

    if (!patient) {

        showToast("Patient record not found.");

        return;
    }


    if (patient.status === "Completed") {

        showToast("This patient has already checked out.");

        return;
    }


    const now = getDateTime();


    patient.status = "Completed";

    patient.timeOut = now.time;

    patient.outTimestamp = now.timestamp;


    if (!savePatients()) {
        return;
    }


    showToast("Patient checkout completed.");

    renderAll();

}


/* =========================================
   EDIT PATIENT
   ========================================= */

function editPatient(id) {

    const patient =
        patients.find(p => p.id === id);

    if (!patient) {

        showToast("Patient record not found.");

        return;
    }


    editingId = patient.id;


    nameInput.value = patient.name || "";

    patientIdInput.value = patient.patientId || "";

    phoneInput.value = patient.phone || "";

    ageInput.value = patient.age || "";

    genderInput.value = patient.gender || "";

    reasonInput.value = patient.reason || "";


    pendingPhoto = patient.photo || "";


    if (pendingPhoto) {

        photoPreview.innerHTML =
            `<img src="${pendingPhoto}" alt="Patient Photo">`;

    } else {

        photoPreview.innerHTML =
            "<span>👤</span>";

    }


    document.getElementById("formTitle").textContent =
        "Edit Patient";

    submitBtn.textContent =
        "Update Patient";


    showSection("register");

}


/* =========================================
   SEARCH
   ========================================= */

searchInput.addEventListener(
    "input",
    renderTable
);


statusFilter.addEventListener(
    "change",
    renderTable
);


/* =========================================
   EXPORT CSV
   ========================================= */

document.getElementById("exportBtn")
    .addEventListener("click", function () {

        if (patients.length === 0) {

            showToast("No patient records to export.");

            return;
        }


        const headers = [

            "Name",
            "Patient ID",
            "Phone",
            "Age",
            "Gender",
            "Reason",
            "Date",
            "Time In",
            "Time Out",
            "Duration",
            "Status"

        ];


        const rows = patients.map(patient => [

            patient.name,

            patient.patientId,

            patient.phone || "",

            patient.age,

            patient.gender,

            patient.reason,

            patient.date,

            patient.timeIn,

            patient.timeOut || "",

            calculateDuration(patient),

            patient.status

        ]);


        const csv = [

            headers,

            ...rows

        ]

        .map(row =>

            row.map(value =>

                `"${String(value ?? "")
                    .replace(/"/g, '""')}"`
            ).join(",")

        ).join("\n");


        const blob =
            new Blob([csv], {
                type: "text/csv;charset=utf-8;"
            });


        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        link.href = url;

        link.download =
            "savimbi_clinic_patients.csv";


        document.body.appendChild(link);

        link.click();

        document.body.removeChild(link);

        URL.revokeObjectURL(url);


        showToast("Patient data exported successfully.");

    });


/* =========================================
   STATISTICS
   ========================================= */

function renderStats() {

    totalPatients.textContent =
        patients.length;


    const today =
        new Date()
            .toISOString()
            .split("T")[0];


    const todayCount =
        patients.filter(
            patient => patient.date === today
        ).length;


    const activeCount =
        patients.filter(
            patient => patient.status === "In Clinic"
        ).length;


    const completedCount =
        patients.filter(
            patient => patient.status === "Completed"
        ).length;


    registeredToday.textContent =
        todayCount;


    currentlyInClinic.textContent =
        activeCount;


    completedVisits.textContent =
        completedCount;

}


/* =========================================
   RECENT PATIENTS
   ========================================= */

function renderRecentPatients() {

    recentPatients.innerHTML = "";


    if (patients.length === 0) {

        recentPatients.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    👥
                </div>

                <h3>No patients yet</h3>

                <p>
                    Register your first patient
                    to see them here.
                </p>

            </div>

        `;

        return;
    }


    const recent =
        patients.slice(0, 5);


    recent.forEach(patient => {

        const item =
            document.createElement("div");

        item.className =
            "recent-item";


        const photoHTML =
            patient.photo

            ? `<img src="${patient.photo}" alt="Patient">`

            : `<span>👤</span>`;


        item.innerHTML = `

            <div class="patient-avatar">

                ${photoHTML}

            </div>


            <div class="recent-info">

                <strong>
                    ${escapeHTML(patient.name)}
                </strong>

                <small>
                    ${escapeHTML(patient.patientId)}
                    ·
                    ${formatDate(patient.date)}
                </small>

            </div>

        `;


        recentPatients.appendChild(item);

    });

}


/* =========================================
   RENDER EVERYTHING
   ========================================= */

function renderAll() {

    renderTable();

    renderStats();

    renderRecentPatients();

}


/* =========================================
   NAVIGATION
   ========================================= */

function showSection(sectionId) {

    document.querySelectorAll(".section")
        .forEach(section => {

            section.classList.remove("active");

        });


    const target =
        document.getElementById(sectionId);


    if (target) {

        target.classList.add("active");

    }


    document.querySelectorAll(".nav-btn")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.section === sectionId
            );

        });


    const titles = {

        dashboard: "Dashboard",

        register: editingId
            ? "Edit Patient"
            : "Register Patient",

        visits: "Patient Visits"

    };


    pageTitle.textContent =
        titles[sectionId] || "Dashboard";


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =========================================
   NAV BUTTONS
   ========================================= */

document.querySelectorAll(".nav-btn")
    .forEach(button => {

        button.addEventListener("click", function () {

            showSection(
                this.dataset.section
            );

        });

    });


/* =========================================
   REGISTER BUTTON
   ========================================= */

document.getElementById("goRegister")
    .addEventListener("click", function () {

        resetForm();

        showSection("register");

    });


/* =========================================
   AUTO UPDATE DURATIONS
   ========================================= */

setInterval(function () {

    renderTable();

    renderStats();

}, 30000);


/* =========================================
   INITIALIZE
   ========================================= */

patients = loadPatients();

renderAll();

showSection("dashboard");