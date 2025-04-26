let currentPDF = null;
let compressedPDF = null;
let originalSize = 0;

// File Handling
document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.addEventListener('DOMContentLoaded', initDragDrop);

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if(validateFile(file)) {
        currentPDF = file;
        originalSize = file.size;
        showFileInfo(file);
    }
}

function validateFile(file) {
    const maxSize = 100 * 1024 * 1024; // 100MB
    if(file.type !== 'application/pdf') {
        alert('Please select a PDF file');
        return false;
    }
    if(file.size > maxSize) {
        alert('File size exceeds 100MB limit');
        return false;
    }
    return true;
}

function showFileInfo(file) {
    document.getElementById('fileInfo').innerHTML = `
        <p><strong>File Name:</strong> ${file.name}</p>
        <p><strong>Size:</strong> ${formatFileSize(file.size)}</p>
    `;
}

function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if(bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// Compression Logic
async function compressPDF() {
    if(!currentPDF) return alert('Please select a PDF file');
    
    try {
        const pdfBytes = await currentPDF.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
        
        // Set compression options based on selected quality
        const quality = document.querySelector('input[name="quality"]:checked').value;
        const saveOptions = getCompressionOptions(quality);
        
        const compressedBytes = await pdfDoc.save(saveOptions);
        compressedPDF = new Blob([compressedBytes], { type: 'application/pdf' });
        
        showCompressionResults(compressedPDF.size);
    } catch(err) {
        alert(`Error compressing PDF: ${err.message}`);
    }
}

function getCompressionOptions(quality) {
    const options = {
        useObjectStreams: true,
        compress: true,
    };
    
    switch(quality) {
        case 'medium':
            options.keepScaling = true;
            options.keepContents = true;
            break;
        case 'low':
            options.keepScaling = false;
            options.keepContents = false;
            break;
        default:
            options.keepScaling = true;
            options.keepContents = true;
    }
    
    return options;
}

function showCompressionResults(compressedSize) {
    document.getElementById('results').style.display = 'block';
    document.getElementById('originalSize').textContent = formatFileSize(originalSize);
    document.getElementById('compressedSize').textContent = formatFileSize(compressedSize);
}

function downloadCompressed() {
    if(!compressedPDF) return alert('No compressed file available');
    saveAs(compressedPDF, `compressed-${currentPDF.name}`);
}

function clearFile() {
    currentPDF = null;
    compressedPDF = null;
    document.getElementById('fileInfo').innerHTML = '';
    document.getElementById('results').style.display = 'none';
}

// Drag & Drop (Same as Previous Tools)
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