document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    
    // File input change handler
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop handlers
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleFileDrop);
});

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        // Update file info
        document.getElementById('fileInfo').textContent = file.name;

        // Render first page preview
        const pdfData = await readFileAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        await renderFirstPagePreview(pdf);
    } catch (error) {
        showError('Error loading PDF: ' + error.message);
    }
}

async function renderFirstPagePreview(pdf) {
    try {
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ 
            canvasContext: context, 
            viewport 
        }).promise;
        
        const previewDiv = document.getElementById('pagePreview');
        previewDiv.innerHTML = '';
        canvas.style.maxWidth = '100%';
        previewDiv.appendChild(canvas);
    } catch (error) {
        showError('Error rendering preview: ' + error.message);
    }
}

async function convertToPPT() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a PDF file first.');
        return;
    }

    try {
        // 1. Initialize PowerPoint
        const pres = new pptxgen();
        
        // 2. Configure presentation
        const orientation = document.getElementById('slideOrientation').value;
        pres.layout = orientation === 'landscape' ? 'LAYOUT_WIDE' : 'LAYOUT_STANDARD';
        
        // 3. Process PDF
        const pdfData = await readFileAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        
        // 4. Add slides
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const canvas = await renderPageToCanvas(page, 'medium');
            const slide = pres.addSlide();
            
            slide.addImage({
                data: canvas.toDataURL('image/jpeg', 0.7),
                x: 0.5,
                y: 0.5,
                w: pres.layout === 'LAYOUT_WIDE' ? 9 : 6.5,
                h: pres.layout === 'LAYOUT_WIDE' ? 5.25 : 9,
                sizing: { type: 'contain' }
            });
        }
        
        // 5. Save output
        pres.writeFile({ fileName: `converted-${Date.now()}.pptx` });
        
    } catch (error) {
        console.error('Full conversion error:', error);
        alert('Conversion failed: ' + error.message);
    }
}

async function renderPageToCanvas(page, imageQuality) {
    const dpi = getDPI(imageQuality);
    const viewport = page.getViewport({ 
        scale: dpi / 72 // Convert 72dpi to target DPI
    });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({ 
        canvasContext: context, 
        viewport 
    }).promise;
    
    return canvas;
}

function getDPI(quality) {
    switch (quality) {
        case 'high': return 300;
        case 'medium': return 150;
        case 'low': return 72;
        default: return 150;
    }
}

function getCompressionQuality(quality) {
    switch (quality) {
        case 'high': return 0.9;
        case 'medium': return 0.7;
        case 'low': return 0.5;
        default: return 0.7;
    }
}

// Helper functions
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        document.getElementById('fileInput').files = files;
        handleFileSelect({ target: document.getElementById('fileInput') });
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function clearAll() {
    document.getElementById('fileInput').value = '';
    document.getElementById('fileInfo').textContent = '';
    document.getElementById('pagePreview').innerHTML = '';
}

function showError(message) {
    alert(message);
    console.error(message);
}