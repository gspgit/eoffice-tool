// delete-pages.js

let pdfDoc = null;
let pageNumbersToDelete = [];

// File Input Handler
document.getElementById('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        const arrayBuffer = await file.arrayBuffer();
        pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        updatePreview();
        document.getElementById('fileInfo').textContent = file.name;
    }
});

// Update Preview
async function updatePreview() {
    const preview = document.getElementById('pagePreview');
    const pageCount = document.getElementById('pageCount');
    
    preview.innerHTML = '';
    pageCount.textContent = `Total Pages: ${pdfDoc.getPages().length}`;
    
    // Create thumbnail previews (simplified example)
    const pages = pdfDoc.getPages();
    pages.forEach((page, index) => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'page-thumbnail';
        pageDiv.innerHTML = `
            <div class="page-number">Page ${index + 1}</div>
            <canvas class="page-canvas"></canvas>
        `;
        preview.appendChild(pageDiv);
    });
}

// Delete Pages Function
async function deletePages() {
    if (!pdfDoc) {
        alert('Please upload a PDF file first');
        return;
    }

    try {
        // Parse page numbers
        const input = document.getElementById('pagesToDelete').value;
        const pagesToDelete = parsePageNumbers(input, pdfDoc.getPages().length);
        
        // Create new PDF
        const newPdf = await PDFLib.PDFDocument.create();
        const pages = pdfDoc.getPages();
        
        // Copy pages except those to delete
        for (let i = 0; i < pages.length; i++) {
            if (!pagesToDelete.includes(i + 1)) {
                const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
                newPdf.addPage(copiedPage);
            }
        }

        // Save and download
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        // Create download link
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'modified-document.pdf';
        link.click();
        
    } catch (error) {
        alert('Error processing PDF: ' + error.message);
        console.error(error);
    }
}

// Parse page numbers input
function parsePageNumbers(input, totalPages) {
    const pages = new Set();
    const parts = input.split(',').map(part => part.trim());
    
    parts.forEach(part => {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            for (let i = start; i <= end; i++) {
                if (i > 0 && i <= totalPages) pages.add(i);
            }
        } else {
            const num = Number(part);
            if (num > 0 && num <= totalPages) pages.add(num);
        }
    });
    
    return Array.from(pages);
}

// Clear All Function
function clearAll() {
    pdfDoc = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('pagesToDelete').value = '';
    document.getElementById('pagePreview').innerHTML = '';
    document.getElementById('pageCount').textContent = '';
    document.getElementById('fileInfo').textContent = '';
}