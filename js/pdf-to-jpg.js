let currentPDF = null;
let extractedImages = [];
const zip = new JSZip();

// File Handling
document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.addEventListener('DOMContentLoaded', initDragDrop);

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if(validateFile(file)) {
        currentPDF = file;
        showFileInfo(file);
    }
}

function validateFile(file) {
    const maxSize = 50 * 1024 * 1024; // 50MB
    if(file.type !== 'application/pdf') {
        alert('Please select a PDF file');
        return false;
    }
    if(file.size > maxSize) {
        alert('File size exceeds 50MB limit');
        return false;
    }
    return true;
}

function showFileInfo(file) {
    document.getElementById('conversionStatus').innerHTML = `
        <p>Selected File: ${file.name}</p>
        <p>Size: ${formatFileSize(file.size)}</p>
    `;
}

// Image Extraction
async function extractImages() {
    if(!currentPDF) return alert('Please select a PDF file');
    
    try {
        const pdfData = await currentPDF.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        const numPages = pdf.numPages;
        extractedImages = [];
        zip.file(`PDF-Images-${Date.now()}/`, null);

        document.getElementById('imageResults').innerHTML = '';
        showStatus(`Processing ${numPages} pages...`);

        for(let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getOperatorList();
            const images = await extractPageImages(page);
            
            extractedImages.push(...images);
            showStatus(`Processed page ${pageNum}/${numPages} - Found ${images.length} images`);
        }

        if(extractedImages.length === 0) {
            return showStatus('No images found in PDF', true);
        }

        showResults();
    } catch(err) {
        showStatus(`Error: ${err.message}`, true);
    }
}

async function extractPageImages(page) {
    const imageCache = {};
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({ canvasContext: ctx, viewport }).promise;
    
    // Extract canvas images
    const pageImages = [];
    const imageData = canvas.toDataURL('image/jpeg', getQuality());
    pageImages.push({
        data: imageData,
        name: `page-${page.pageNumber}.jpg`
    });

    return pageImages;
}

function showResults() {
    const resultsContainer = document.getElementById('imageResults');
    resultsContainer.innerHTML = '';
    
    extractedImages.forEach((img, index) => {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.innerHTML = `
            <img src="${img.data}" class="image-preview" alt="Extracted image">
            <div class="image-info">
                <a href="${img.data}" download="${img.name}" class="download-btn">
                    Download
                </a>
            </div>
        `;
        resultsContainer.appendChild(card);
        
        // Add to ZIP
        const base64Data = img.data.split(',')[1];
        zip.file(img.name, base64Data, { base64: true });
    });

    // Add ZIP download
    const zipButton = document.createElement('div');
    zipButton.className = 'zip-download';
    zipButton.innerHTML = `
        <button class="btn-primary" onclick="downloadZip()">
            <i class="fas fa-file-archive"></i> Download All as ZIP
        </button>
    `;
    resultsContainer.appendChild(zipButton);
}

async function downloadZip() {
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `pdf-images-${Date.now()}.zip`);
}

function getQuality() {
    return parseFloat(document.getElementById('imageQuality').value);
}

function getFormat() {
    return document.getElementById('imageFormat').value;
}

function showStatus(message, isError = false) {
    const status = document.getElementById('conversionStatus');
    status.innerHTML = message;
    status.style.color = isError ? '#e74c3c' : '#2c3e50';
}

function clearFile() {
    currentPDF = null;
    extractedImages = [];
    zip.file(/.*/);
    document.getElementById('conversionStatus').innerHTML = '';
    document.getElementById('imageResults').innerHTML = '';
}

// Drag & Drop
function initDragDrop() {
    const dropZone = document.getElementById('dropZone');
    
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const dt = e.dataTransfer;
        if(dt.files.length) handleFileSelect({ target: { files: dt.files } });
    });
}

function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if(bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}