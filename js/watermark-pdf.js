let pdfFile = null;
let watermarkImage = null;
let currentWatermarkType = 'text';
let position = 'center';

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentWatermarkType = btn.dataset.type;
        document.querySelectorAll('.watermark-options').forEach(opt => 
            opt.classList.remove('show'));
        document.querySelector(`.${currentWatermarkType}-options`).classList.add('show');
    });
});

// Position Selection
document.querySelectorAll('.pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.pos-btn').forEach(b => 
            b.classList.remove('active'));
        btn.classList.add('active');
        position = btn.dataset.pos;
    });
});

// File Handling
document.getElementById('pdfInput').addEventListener('change', handlePdfUpload);
document.getElementById('imageInput').addEventListener('change', handleImageUpload);
initDragDrop();

async function handlePdfUpload(e) {
    const file = e.target.files[0];
    if(validatePdf(file)) {
        pdfFile = file;
        showPdfInfo(file);
    }
}

function validatePdf(file) {
    const maxSize = 50 * 1024 * 1024;
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

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if(validateImage(file)) {
        watermarkImage = file;
        showImagePreview(file);
    }
}

function validateImage(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024;
    
    if(!allowedTypes.includes(file.type)) {
        alert('Please select a JPG/PNG/WEBP image');
        return false;
    }
    if(file.size > maxSize) {
        alert('Image size exceeds 5MB limit');
        return false;
    }
    return true;
}

function showPdfInfo(file) {
    document.getElementById('pdfFileInfo').innerHTML = `
        <p><strong>File:</strong> ${file.name}</p>
        <p><strong>Size:</strong> ${formatFileSize(file.size)}</p>
    `;
}

function showImagePreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('imagePreview').innerHTML = `
            <img src="${e.target.result}" alt="Watermark Preview">
        `;
    };
    reader.readAsDataURL(file);
}

// Watermark Application
async function applyWatermark() {
    if(!pdfFile) return alert('Please select a PDF file');
    if(currentWatermarkType === 'text' && !document.getElementById('watermarkText').value) {
        return alert('Please enter watermark text');
    }
    if(currentWatermarkType === 'image' && !watermarkImage) {
        return alert('Please select a watermark image');
    }

    try {
        const pdfBytes = await pdfFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();

        if(currentWatermarkType === 'text') {
            await applyTextWatermark(pdfDoc, pages);
        } else {
            await applyImageWatermark(pdfDoc, pages);
        }

        const watermarkedBytes = await pdfDoc.save();
        saveAs(new Blob([watermarkedBytes], { type: 'application/pdf' }), 
            `watermarked-${pdfFile.name}`);
        
        alert('Watermark applied successfully!');
    } catch (err) {
        alert(`Watermark failed: ${err.message || err}`);
        console.error('Error details:', err);
    }
}

async function applyTextWatermark(pdfDoc, pages) {
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const text = document.getElementById('watermarkText').value;
    const fontSize = parseInt(document.getElementById('fontSize').value);
    const opacity = parseFloat(document.getElementById('textOpacity').value);
    const color = hexToRgb(document.getElementById('textColor').value);
    const rotation = parseInt(document.getElementById('textRotation').value);

    pages.forEach(page => {
        const { width, height } = page.getSize();
        const position = calculatePosition(width, height, fontSize, text.length);
        
        page.drawText(text, {
            x: position.x,
            y: position.y,
            size: fontSize,
            opacity,
            font,
            color: PDFLib.rgb(color.r, color.g, color.b),
            rotate: PDFLib.degrees(rotation),
            blendMode: 'Multiply'
        });
    });
}

async function applyImageWatermark(pdfDoc, pages) {
    try {
        const imageBytes = await watermarkImage.arrayBuffer();
        let image;
        
        // Handle different image types
        if (watermarkImage.type === 'image/png') {
            image = await pdfDoc.embedPng(imageBytes);
        } else if (watermarkImage.type === 'image/jpeg') {
            image = await pdfDoc.embedJpg(imageBytes);
        } else {
            throw new Error('Unsupported image format');
        }

        const opacity = parseFloat(document.getElementById('imageOpacity').value);
        const scale = parseInt(document.getElementById('imageScale').value) / 100;

        pages.forEach(page => {
            const { width, height } = page.getSize();
            const imgDims = image.scale(scale);
            const position = calculateImagePosition(width, height, imgDims.width, imgDims.height);

            page.drawImage(image, {
                ...position,
                opacity,
                blendMode: 'Multiply'
            });
        });
    } catch (err) {
        throw new Error(`Image processing failed: ${err.message}`);
    }
}

function calculatePosition(pageWidth, pageHeight, fontSize, textLength) {
    const textWidth = textLength * fontSize * 0.6;
    const centerX = (pageWidth - textWidth) / 2;
    const centerY = pageHeight / 2;
    
    // Implement position logic based on selected position
    // (Full implementation would handle all 9 positions)
    return { x: centerX, y: centerY };
}

function calculateImagePosition(pageWidth, pageHeight, imgWidth, imgHeight) {
    const padding = 20;
    let x, y;

    switch(position) {
        case 'top-left':
            x = padding;
            y = pageHeight - imgHeight - padding;
            break;
        case 'top-center':
            x = (pageWidth - imgWidth) / 2;
            y = pageHeight - imgHeight - padding;
            break;
        case 'top-right':
            x = pageWidth - imgWidth - padding;
            y = pageHeight - imgHeight - padding;
            break;
        case 'center-left':
            x = padding;
            y = (pageHeight - imgHeight) / 2;
            break;
        case 'center':
            x = (pageWidth - imgWidth) / 2;
            y = (pageHeight - imgHeight) / 2;
            break;
        case 'center-right':
            x = pageWidth - imgWidth - padding;
            y = (pageHeight - imgHeight) / 2;
            break;
        case 'bottom-left':
            x = padding;
            y = padding;
            break;
        case 'bottom-center':
            x = (pageWidth - imgWidth) / 2;
            y = padding;
            break;
        case 'bottom-right':
            x = pageWidth - imgWidth - padding;
            y = padding;
            break;
        default:
            x = (pageWidth - imgWidth) / 2;
            y = (pageHeight - imgHeight) / 2;
    }

    return { x, y, width: imgWidth, height: imgHeight };
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16)/255;
    const g = parseInt(hex.slice(3, 5), 16)/255;
    const b = parseInt(hex.slice(5, 7), 16)/255;
    return { r, g, b };
}

function resetAll() {
    pdfFile = null;
    watermarkImage = null;
    document.getElementById('pdfFileInfo').innerHTML = '';
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('watermarkText').value = '';
    document.querySelectorAll('.tab-btn')[0].click();
}

// Helper Functions
function initDragDrop() {
    initZone('pdfDropZone', handlePdfUpload);
    initZone('imageDropZone', handleImageUpload);

    function initZone(zoneId, handler) {
        const zone = document.getElementById(zoneId);
        
        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });

        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('dragover');
            handler({ target: { files: e.dataTransfer.files } });
        });
    }
}

function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if(bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}