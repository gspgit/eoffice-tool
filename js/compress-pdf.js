let currentPDF = null;
let compressedPDF = null;
let originalSize = 0;

document.addEventListener("DOMContentLoaded", function () {

    const fileInput = document.getElementById("fileInput");
    const dropZone = document.getElementById("dropZone");

    // File Select
    fileInput.addEventListener("change", function (e) {
        const file = e.target.files[0];

        if (!file) return;

        if (file.type !== "application/pdf") {
            alert("Please select a valid PDF file");
            fileInput.value = "";
            return;
        }

        currentPDF = file;
        originalSize = file.size;

        document.getElementById("fileInfo").innerHTML = `
            <p><strong>File Name:</strong> ${file.name}</p>
            <p><strong>Size:</strong> ${formatFileSize(file.size)}</p>
        `;
    });

    // Drag Over
    dropZone.addEventListener("dragover", function (e) {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", function () {
        dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", function (e) {
        e.preventDefault();
        dropZone.classList.remove("dragover");

        const file = e.dataTransfer.files[0];

        if (!file) return;

        if (file.type !== "application/pdf") {
            alert("Please select a valid PDF file");
            return;
        }

        currentPDF = file;
        originalSize = file.size;

        document.getElementById("fileInfo").innerHTML = `
            <p><strong>File Name:</strong> ${file.name}</p>
            <p><strong>Size:</strong> ${formatFileSize(file.size)}</p>
        `;
    });

});

function formatFileSize(bytes) {
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}