const { jsPDF } = window.jspdf;
let imageFiles = [];

// File Handling
document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.addEventListener('DOMContentLoaded', initDragDrop);

async function handleFileSelect(e) {
    const newFiles = Array.from(e.target.files);
    if(validateFiles(newFiles)) {
        imageFiles = [...imageFiles, ...newFiles];
        await updateImagePreview();
    }
}

function validateFiles(files) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/bmp'];
    const maxSize = 10 * 1024 * 1024; // 10MB per image
    
    const invalidFiles = files.filter(file => 
        !allowedTypes.includes(file.type) || file.size > maxSize
    );

    if(invalidFiles.length > 0) {
        alert('Please select valid image files (JPG/PNG/BMP, max 10MB each)');
        return false;
    }
    return true;
}

async function updateImagePreview() {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    
    for(const [index, file] of imageFiles.entries()) {
        const img = await createImageBitmap(file);
        const url = URL.createObjectURL(file);
        
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.innerHTML = `
            <img src="${url}" alt="Preview ${index + 1}">
            <button class="remove-btn" onclick="removeImage(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        preview.appendChild(item);
    }
}

function removeImage(index) {
    imageFiles.splice(index, 1);
    updateImagePreview();
}

function clearFiles() {
    imageFiles = [];
    document.getElementById('imagePreview').innerHTML = '';
}

// Conversion Logic
async function convertToPDF() {
    if(imageFiles.length === 0) return alert('Please select at least one image');
    
    try {
        const doc = new jsPDF();
        const orientation = document.getElementById('pageOrientation').value;
        const margin = parseInt(document.getElementById('pageMargin').value);

        for(const [index, file] of imageFiles.entries()) {
            if(index > 0) doc.addPage();
            
            const img = await loadImage(file);
            const imgProps = await getImageOrientation(file, img);
            
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            
            const dimensions = calculateDimensions(imgProps, pageWidth, pageHeight, margin, orientation);
            
            doc.addImage(
                img,
                'JPEG',
                dimensions.x,
                dimensions.y,
                dimensions.width,
                dimensions.height
            );
        }

        doc.save(`converted-${Date.now()}.pdf`);
    } catch(err) {
        alert(`Conversion failed: ${err.message}`);
    }
}

async function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

async function getImageOrientation(file, img) {
    return new Promise(resolve => {
        EXIF.getData(file, function() {
            const orientation = EXIF.getTag(this, 'Orientation') || 1;
            const isPortrait = img.height > img.width;
            
            resolve({
                width: img.width,
                height: img.height,
                orientation,
                isPortrait
            });
        });
    });
}

function calculateDimensions(imgProps, pageWidth, pageHeight, margin, orientation) {
    const contentWidth = pageWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2);
    
    let imgWidth = imgProps.width;
    let imgHeight = imgProps.height;
    
    // Apply EXIF orientation correction
    if([5,6,7,8].includes(imgProps.orientation)) {
        [imgWidth, imgHeight] = [imgHeight, imgWidth];
    }

    // Determine orientation
    const targetOrientation = orientation === 'auto' 
        ? (imgHeight > imgWidth ? 'portrait' : 'landscape') 
        : orientation;

    const aspectRatio = imgWidth / imgHeight;
    let width, height;

    if(targetOrientation === 'portrait') {
        height = contentHeight;
        width = height * aspectRatio;
        if(width > contentWidth) {
            width = contentWidth;
            height = width / aspectRatio;
        }
    } else {
        width = contentWidth;
        height = width / aspectRatio;
        if(height > contentHeight) {
            height = contentHeight;
            width = height * aspectRatio;
        }
    }

    return {
        x: margin + (contentWidth - width)/2,
        y: margin + (contentHeight - height)/2,
        width,
        height
    };
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