let wordFile = null;
const { jsPDF } = window.jspdf;

// File Handling
document.getElementById('fileInput').addEventListener('change', handleFileUpload);
initDragDrop();

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if(validateFile(file)) {
        wordFile = file;
        showFileInfo(file);
    }
}

function validateFile(file) {
    const maxSize = 20 * 1024 * 1024;
    const allowedTypes = [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if(!allowedTypes.includes(file.type)) {
        alert('Please select a Word file (DOC/DOCX)');
        return false;
    }
    if(file.size > maxSize) {
        alert('File size exceeds 20MB limit');
        return false;
    }
    return true;
}

async function convertToPDF() {
    if(!wordFile) return alert('Please select a Word file');
    
    try {
        const arrayBuffer = await wordFile.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: document.getElementById('pageSize').value.toLowerCase(),
        });

        const margin = parseInt(document.getElementById('pageMargin').value);
        const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
        
        await pdf.html(result.value, {
            html2canvas: {
                scale: 300/96, // 300 DPI
                letterRendering: true,
            },
            margin: [margin, margin, margin, margin],
            width: pageWidth,
            windowWidth: 800
        });

        pdf.save(`converted-${wordFile.name.replace(/\.[^/.]+$/, "")}.pdf`);
    } catch(err) {
        alert(`Conversion failed: ${err.message}`);
    }
}

function clearAll() {
    wordFile = null;
    document.getElementById('fileInfo').innerHTML = '';
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