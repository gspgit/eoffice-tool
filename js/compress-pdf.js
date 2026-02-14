let currentPDF = null;
let compressedPDF = null;
let originalSize = 0;

// File Handling
document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.addEventListener('DOMContentLoaded', initDragDrop);

function handleFileSelect(e) {
    const file = e.target.files[0];

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
}

function formatFileSize(bytes) {
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(2) + " MB";
}

async function compressPDF() {

    if (!currentPDF) {
        alert("Please select a PDF file");
        return;
    }

    try {

        const qualityOption =
            document.querySelector('input[name="quality"]:checked').value;

        let imageQuality = 0.8;
        let scale = 1;

        if (qualityOption === "high") {
            imageQuality = 0.9;
            scale = 1;
        }
        else if (qualityOption === "medium") {
            imageQuality = 0.7;
            scale = 0.8;
        }
        else if (qualityOption === "low") {
            imageQuality = 0.5;
            scale = 0.6;
        }

        const arrayBuffer = await currentPDF.arrayBuffer();

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const newPdf = await PDFLib.PDFDocument.create();

        for (let i = 1; i <= pdf.numPages; i++) {

            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: scale });

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const imgData = canvas.toDataURL("image/jpeg", imageQuality);
            const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());

            const jpgImage = await newPdf.embedJpg(imgBytes);
            const newPage = newPdf.addPage([canvas.width, canvas.height]);

            newPage.drawImage(jpgImage, {
                x: 0,
                y: 0,
                width: canvas.width,
                height: canvas.height
            });
        }

        const compressedBytes = await newPdf.save();
        compressedPDF = new Blob([compressedBytes], { type: "application/pdf" });

        showCompressionResults(compressedPDF.size);

    } catch (err) {
        console.error(err);
        alert("Compression failed: " + err.message);
    }
}

function showCompressionResults(compressedSize) {

    document.getElementById("results").style.display = "block";

    document.getElementById("originalSize").textContent =
        formatFileSize(originalSize);

    document.getElementById("compressedSize").textContent =
        formatFileSize(compressedSize);
}

function downloadCompressed() {

    if (!compressedPDF) {
        alert("No compressed file available");
        return;
    }

    saveAs(compressedPDF, `compressed-${currentPDF.name}`);
}

function clearFile() {

    currentPDF = null;
    compressedPDF = null;

    document.getElementById("fileInfo").innerHTML = "";
    document.getElementById("results").style.display = "none";
}

// Drag & Drop
function initDragDrop() {

    const dropZone = document.getElementById("dropZone");

    dropZone.addEventListener("dragover", e => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", e => {
        e.preventDefault();
        dropZone.classList.remove("dragover");

        if (e.dataTransfer.files.length) {
            handleFileSelect({
                target: { files: e.dataTransfer.files }
            });
        }
    });
}