let lockedPDF = null;

// Toggle Password Visibility
document.querySelector('.toggle-password').addEventListener('click', function(e) {
    const input = e.target.previousElementSibling;
    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
    input.setAttribute('type', type);
    e.target.classList.toggle('fa-eye-slash');
});

// File Handling
document.getElementById('fileInput').addEventListener('change', handleFileUpload);
initDragDrop();

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if(validateFile(file)) {
        lockedPDF = file;
        showFileInfo(file);
    }
}

function validateFile(file) {
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

function showFileInfo(file) {
    document.getElementById('fileInfo').innerHTML = `
        <p><strong>File:</strong> ${file.name}</p>
        <p><strong>Size:</strong> ${formatFileSize(file.size)}</p>
    `;
}

// PDF Unlocking
async function unlockPDF() {
    if(!lockedPDF) return alert('Please select a PDF file');
    const password = document.getElementById('pdfPassword').value;
    
    if(!password) return alert('Please enter the PDF password');

    try {
        const pdfBytes = await lockedPDF.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes, {
            password: password,
            ignoreEncryption: false
        });

        // Remove password protection
        pdfDoc.setTitle(lockedPDF.name.replace(/_encrypted|_protected/gi, ''));
        pdfDoc.removeEncryption();

        const unlockedBytes = await pdfDoc.save();
        saveAs(new Blob([unlockedBytes], { type: 'application/pdf' }), 
            `unlocked_${lockedPDF.name}`);
        
        alert('PDF unlocked successfully!');
    } catch(err) {
        handleUnlockError(err);
    }
}

function handleUnlockError(err) {
    const status = document.getElementById('passwordStatus');
    if(err.message.includes('Incorrect password')) {
        status.style.backgroundColor = '#e74c3c';
        status.style.width = '100%';
        alert('Incorrect password. Please try again.');
    } else if(err.message.includes('Encrypted')) {
        alert('This PDF requires a password for opening');
    } else {
        alert(`Unlock failed: ${err.message}`);
    }
    setTimeout(() => {
        status.style.width = '0%';
    }, 2000);
}

function clearAll() {
    lockedPDF = null;
    document.getElementById('fileInfo').innerHTML = '';
    document.getElementById('pdfPassword').value = '';
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

function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if(bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}