// pdf-to-text.js
let pdfFile = null;
let extractedText = '';

// File Handling
document.getElementById('fileInput').addEventListener('change', handleFileUpload);
initDragDrop();

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if(validateFile(file)) {
        pdfFile = file;
        showFileInfo(file);
        document.getElementById('resultSection').style.display = 'none';
    }
}

function validateFile(file) {
    const maxSize = 25 * 1024 * 1024;
    const allowedType = 'application/pdf';
    
    if(file.type !== allowedType) {
        alert('Please select a PDF file');
        return false;
    }
    if(file.size > maxSize) {
        alert('File size exceeds 25MB limit');
        return false;
    }
    return true;
}

async function extractText() {
    if(!pdfFile) return alert('Please select a PDF file');
    
    try {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const pdfData = new Uint8Array(e.target.result);
            const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
            let textContent = '';
            
            for(let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const text = await page.getTextContent();
                textContent += processPDFContent(text, i);
            }
            
            extractedText = textContent;
            showResult(textContent);
        };
        reader.readAsArrayBuffer(pdfFile);
    } catch(err) {
        alert(`Text extraction failed: ${err.message}`);
    }
}

function processPDFContent(textContent, pageNumber) {
    let processedText = textContent.items.map(item => item.str).join(' ');
    
    // Apply formatting options
    const formatStyle = document.getElementById('textFormat').value;
    if(formatStyle === 'plain') {
        processedText = processedText.replace(/\s+/g, ' ').trim();
    }
    
    // Add page numbers if enabled
    if(document.getElementById('includePageNumbers').checked) {
        processedText = `--- Page ${pageNumber} ---\n${processedText}\n\n`;
    }
    
    return processedText;
}

function showResult(text) {
    const preview = document.getElementById('textPreview');
    preview.textContent = text;
    document.getElementById('resultSection').style.display = 'block';
    window.scrollTo(0, document.body.scrollHeight);
}

function copyToClipboard() {
    navigator.clipboard.writeText(extractedText)
        .then(() => alert('Text copied to clipboard!'))
        .catch(err => alert('Failed to copy text'));
}

function downloadText(format) {
    if(!extractedText) return alert('No text to download');
    
    const blob = new Blob([extractedText], { type: 'text/plain' });
    const filename = `extracted-${pdfFile.name.replace(/\.[^/.]+$/, "")}.${format}`;
    
    if(format === 'docx') {
        // For DOCX conversion you might need a library like docx
        alert('DOCX conversion requires additional libraries');
        return;
    }
    
    saveAs(blob, filename);
}

function clearAll() {
    pdfFile = null;
    extractedText = '';
    document.getElementById('fileInfo').innerHTML = '';
    document.getElementById('resultSection').style.display = 'none';
}

// Drag & Drop (similar to Word converter)
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
        if(dt.files.length) handleFileUpload({ target: { files: dt.files } });
    });
}

function showFileInfo(file) {
    document.getElementById('fileInfo').innerHTML = `
        <p><strong>File:</strong> ${file.name}</p>
        <p><strong>Size:</strong> ${formatFileSize(file.size)}</p>
    `;
}

function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if(bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}