let currentPDF = null;

// Password Strength Checker
function checkPasswordStrength(password) {
    const strength = {
        score: 0,
        width: '0%',
        color: '#e74c3c'
    };

    if(password.length >= 8) strength.score++;
    if(password.match(/[A-Z]/)) strength.score++;
    if(password.match(/[0-9]/)) strength.score++;
    if(password.match(/[^A-Za-z0-9]/)) strength.score++;

    switch(strength.score) {
        case 1:
            strength.width = '25%';
            strength.color = '#e74c3c';
            break;
        case 2:
            strength.width = '50%';
            strength.color = '#f1c40f';
            break;
        case 3:
            strength.width = '75%';
            strength.color = '#2ecc71';
            break;
        case 4:
            strength.width = '100%';
            strength.color = '#27ae60';
            break;
    }

    return strength;
}

// Toggle Password Visibility
document.querySelectorAll('.toggle-password').forEach(icon => {
    icon.addEventListener('click', (e) => {
        const input = e.target.previousElementSibling;
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        e.target.classList.toggle('fa-eye-slash');
    });
});

// Password Strength Updater
document.getElementById('userPassword').addEventListener('input', function() {
    const strength = checkPasswordStrength(this.value);
    const indicator = document.getElementById('passwordStrength');
    indicator.style.width = strength.width;
    indicator.style.backgroundColor = strength.color;
});

// File Handling
document.getElementById('fileInput').addEventListener('change', handleFileUpload);
initDragDrop();

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if(validateFile(file)) {
        currentPDF = file;
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

// PDF Protection
async function protectPDF() {
    if (!currentPDF) return alert("Select a PDF file");
    const userPassword = document.getElementById('userPassword').value;

    if (userPassword.length < 6) {
        return alert("Password must be at least 6 characters");
    }

    try {
        const pdfBytes = await currentPDF.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);

        const permissions = {
            print: document.querySelector('[value="print"]').checked,
            modify: document.querySelector('[value="modify"]').checked,
            copy: document.querySelector('[value="copy"]').checked
        };

        const ownerPassword = document.getElementById('ownerPassword').value || userPassword;

        // Corrected encryption algorithm
        const protectedBytes = await pdfDoc.save({
            encrypt: {
                userPassword: userPassword,
                ownerPassword: ownerPassword,
                permissions: {
                    allowPrinting: permissions.print,
                    allowModifyContents: permissions.modify,
                    allowCopy: permissions.copy,
                    allowAnnotations: false,
                    allowFillForms: false,
                    allowAccessibility: false,
                    allowAssembleDocument: false,
                },
                algorithm: 'AES-256', // Fixed algorithm name
            }
        });

        const blob = new Blob([protectedBytes], { type: "application/pdf" });
        saveAs(blob, `protected-${currentPDF.name}`);
        
        alert("PDF protected successfully!");
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}
function clearAll() {
    currentPDF = null;
    document.getElementById('fileInfo').innerHTML = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('ownerPassword').value = '';
    document.getElementById('passwordStrength').style.width = '0%';
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