let ocrFile = null;
let worker = null;

// Initialize OCR Worker
async function initializeOCR() {
    worker = await Tesseract.createWorker({
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@v4.0.2/dist/worker.min.js',
        langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js-data@4.0.0',
        logger: updateProgress
    });
}

// File Handling
document.getElementById('fileInput').addEventListener('change', handleFileUpload);
initDragDrop();

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if(validateFile(file)) {
        ocrFile = file;
        showFileInfo(file);
        await initializeOCR();
    }
}

function validateFile(file) {
    const maxSize = 50 * 1024 * 1024;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    
    if(!allowedTypes.includes(file.type)) {
        alert('Please select a PDF or image file');
        return false;
    }
    if(file.size > maxSize) {
        alert('File size exceeds 50MB limit');
        return false;
    }
    return true;
}

async function processOCR() {
    if (!ocrFile) return alert('Please select a file');
    
    try {
      if (worker) await worker.terminate(); // Terminate existing worker
      await initializeOCR(); // 
        const lang = document.getElementById('ocrLanguage').value;
        await worker.loadLanguage(lang);
        await worker.initialize(lang);
        
        let result;
        if(ocrFile.type === 'application/pdf') {
            result = await processPDF();
        } else {
            result = await processImage();
        }
        
        handleOutput(result);
    } catch(err) {
          alert(`OCR failed: ${err.toString()}`);
    } finally {
        await worker.terminate();
    }
}

async function processPDF() {
    const pdfData = new Uint8Array(await ocrFile.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const textContent = [];
    
    for(let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        const image = await canvasToBlob(canvas);
        const { data: { text } } = await worker.recognize(image);
        textContent.push(text);
        updateProgress({ progress: (i) / pdf.numPages });
    }
    
    return textContent.join('\n\n');
}

function canvasToBlob(canvas) {
    return new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), 'image/png');
    });
}

async function processImage() {
    const { data: { text } } = await worker.recognize(ocrFile);
    return text;
}

function handleOutput(text) {
    const outputFormat = document.getElementById('outputFormat').value;
    
    switch(outputFormat) {
        case 'searchable-pdf':
            createSearchablePDF(text);
            break;
        case 'text':
            saveAs(new Blob([text], { type: 'text/plain' }), 'ocr-result.txt');
            break;
        case 'docx':
            const doc = new Docx.Document();
            doc.addSection().addParagraph(text);
            Docx.Packer.toBlob(doc).then(blob => {
                saveAs(blob, 'ocr-result.docx');
            });
            break;
    }
    
    document.getElementById('previewPane').textContent = text;
}

async function createSearchablePDF(text) {
    const pdfDoc = await PDFLib.PDFDocument.create();
    const page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    
    page.drawText(text, {
        x: 50,
        y: page.getHeight() - 50,
        size: 12,
        font,
        color: PDFLib.rgb(0, 0, 0),
        maxWidth: page.getWidth() - 100
    });
    
    const pdfBytes = await pdfDoc.save();
    saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), 'searchable.pdf');
}

function updateProgress(message) {
    if(message.status === 'recognizing text') {
        const progress = message.progress * 100;
        document.querySelector('.progress-fill').style.width = `${progress}%`;
    }
}

function clearAll() {
    ocrFile = null;
    document.getElementById('fileInfo').innerHTML = '';
    document.getElementById('previewPane').textContent = '';
    document.querySelector('.progress-fill').style.width = '0%';
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