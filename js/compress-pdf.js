let currentPDF = null;
let compressedPDF = null;
let originalSize = 0;

document.addEventListener("DOMContentLoaded", function () {

    const fileInput = document.getElementById("fileInput");
    const dropZone = document.getElementById("dropZone");

    // File Select
    fileInput.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (!validateFile(file)) return;

        currentPDF = file;
        originalSize = file.size;
        showFileInfo(file);
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
        if (!validateFile(file)) return;

        currentPDF = file;
        originalSize = file.size;
        showFileInfo(file);
    });

});

function validateFile(file) {
    if (!file) return false;

    if (file.type !== "application/pdf") {
        alert("Please select a valid PDF file.");
        return false;
    }

    if (file.size > 100 * 1024 * 1024) {
        alert("File exceeds 100MB limit.");
        return false;
    }

    return true;
}

function showFileInfo(file) {
    document.getElementById("fileInfo").innerHTML = `
        <p><strong>${file.name}</strong></p>
        <p>Size: ${formatFileSize(file.size)}</p>
    `;
}

function formatFileSize(bytes) {
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

async function compressPDF() {

    if (!currentPDF) {
        alert("Please select a PDF file first.");
        return;
    }

    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");

    progressContainer.style.display = "block";
    progressBar.style.width = "0%";
    progressText.textContent = "Starting compression...";

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
        else {
            imageQuality = 0.5;
            scale = 0.6;
        }

        const arrayBuffer = await currentPDF.arrayBuffer();

        const pdf = await pdfjsLib.getDocument({
            data: arrayBuffer
        }).promise;

        const newPdf = await PDFLib.PDFDocument.create();

        for (let i = 1; i <= pdf.numPages; i++) {

            progressText.textContent =
                `Processing page ${i} of ${pdf.numPages}`;

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

            const imgData =
                canvas.toDataURL("image/jpeg", imageQuality);

            const imgBytes =
                await fetch(imgData).then(res => res.arrayBuffer());

            const jpgImage =
                await newPdf.embedJpg(imgBytes);

            const newPage =
                newPdf.addPage([canvas.width, canvas.height]);

            newPage.drawImage(jpgImage, {
                x: 0,
                y: 0,
                width: canvas.width,
                height: canvas.height
            });

            const percent =
                Math.round((i / pdf.numPages) * 100);

            progressBar.style.width = percent + "%";
        }

        const compressedBytes = await newPdf.save();

        compressedPDF = new Blob(
            [compressedBytes],
            { type: "application/pdf" }
        );

        document.getElementById("originalSize")
            .textContent = formatFileSize(originalSize);

        document.getElementById("compressedSize")
            .textContent = formatFileSize(compressedPDF.size);

        document.getElementById("results")
            .style.display = "block";

        progressText.textContent = "Compression complete!";

    }
    catch (err) {
        console.error(err);
        alert("Compression failed: " + err.message);
        progressContainer.style.display = "none";
    }
}

function downloadCompressed() {

    if (!compressedPDF) {
        alert("No compressed file available.");
        return;
    }

    saveAs(
        compressedPDF,
        "compressed-" + currentPDF.name
    );
}

function clearFile() {

    currentPDF = null;
    compressedPDF = null;
    originalSize = 0;

    document.getElementById("fileInput").value = "";
    document.getElementById("fileInfo").innerHTML = "";
    document.getElementById("results").style.display = "none";
    document.getElementById("progressContainer").style.display = "none";
}