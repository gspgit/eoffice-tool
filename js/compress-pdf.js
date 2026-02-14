let currentPDF = null;
let compressedPDF = null;
let originalSize = 0;

document.getElementById("fileInput").addEventListener("change", handleFile);
initDragDrop();

function handleFile(e) {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") {
        alert("Select a valid PDF");
        return;
    }
    currentPDF = file;
    originalSize = file.size;
    document.getElementById("fileInfo").innerHTML =
        `<p><strong>${file.name}</strong><br>${formatSize(file.size)}</p>`;
}

function formatSize(bytes) {
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(2) + " MB";
}

async function compressPDF() {
    if (!currentPDF) return alert("Select PDF first");

    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");

    progressContainer.style.display = "block";
    progressBar.style.width = "0%";

    try {
        const qualityOption = document.querySelector('input[name="quality"]:checked').value;

        let imageQuality = 0.8;
        let scale = 1;

        if (qualityOption === "high") {
            imageQuality = 0.9;
            scale = 1;
        } else if (qualityOption === "medium") {
            imageQuality = 0.7;
            scale = 0.8;
        } else {
            imageQuality = 0.5;
            scale = 0.6;
        }

        const arrayBuffer = await currentPDF.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const newPdf = await PDFLib.PDFDocument.create();

        for (let i = 1; i <= pdf.numPages; i++) {

            progressText.textContent = `Processing page ${i}/${pdf.numPages}`;

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
            const pageNew = newPdf.addPage([canvas.width, canvas.height]);

            pageNew.drawImage(jpgImage, {
                x: 0,
                y: 0,
                width: canvas.width,
                height: canvas.height
            });

            progressBar.style.width = Math.round((i / pdf.numPages) * 100) + "%";
        }

        const compressedBytes = await newPdf.save();
        compressedPDF = new Blob([compressedBytes], { type: "application/pdf" });

        document.getElementById("originalSize").textContent = formatSize(originalSize);
        document.getElementById("compressedSize").textContent = formatSize(compressedPDF.size);
        document.getElementById("results").style.display = "block";

        progressText.textContent = "Compression Complete!";

    } catch (err) {
        alert("Compression failed: " + err.message);
        console.error(err);
    }
}

function downloadCompressed() {
    if (!compressedPDF) return;
    saveAs(compressedPDF, "compressed.pdf");
}

function clearFile() {
    currentPDF = null;
    compressedPDF = null;
    document.getElementById("fileInfo").innerHTML = "";
    document.getElementById("results").style.display = "none";
    document.getElementById("progressContainer").style.display = "none";
}

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
        const file = e.dataTransfer.files[0];
        handleFile({ target: { files: [file] } });
    });
}