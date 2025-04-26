// PDF.js worker configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Main table extraction controller
async function extractTablesFromPDF(file) {
    const ocrMode = document.getElementById('ocrMode').value;
    
    if (ocrMode === 'force') {
        return await extractWithOCR(file);
    } else {
        try {
            return await extractWithPDFJS(file);
        } catch {
            return await extractWithOCR(file);
        }
    }
}

// PDF text-based extraction
async function extractWithPDFJS(file) {
    const pdfData = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfData) }).promise;
    const tables = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });
        
        const textItems = textContent.items.map(item => ({
            text: item.str,
            x: item.transform[4],
            y: viewport.height - item.transform[5],
            width: item.width,
            height: item.height
        }));

        tables.push(...detectTables(textItems));
    }
    return tables;
}

// OCR-based extraction
async function extractWithOCR(file) {
    const worker = Tesseract.createWorker();
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();
    
    return simpleTextToTable(text);
}

// OCR text to table conversion
function simpleTextToTable(text) {
    const rows = text.split('\n');
    return [rows.map(row => row.split(/\s{2,}/))];
}

// Table detection functions
function detectTables(textItems) {
    const sortedItems = textItems.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = clusterRows(sortedItems);
    return [processRows(rows)];
}

function clusterRows(items, rowThreshold = 5) {
    const rows = [];
    let currentRow = [];
    let currentY = null;

    for (const item of items) {
        if (currentY === null || Math.abs(item.y - currentY) < rowThreshold) {
            currentRow.push(item);
        } else {
            rows.push(currentRow);
            currentRow = [item];
        }
        currentY = item.y;
    }
    if (currentRow.length) rows.push(currentRow);
    return rows;
}

function processRows(rows, colThreshold = 10) {
    const table = [];
    const allX = rows.flat().map(item => item.x);
    const uniqueX = [...new Set(allX)].sort((a, b) => a - b);
    const columns = clusterColumns(uniqueX, colThreshold);

    for (const row of rows) {
        const tableRow = new Array(columns.length).fill('');
        
        for (const item of row) {
            const colIndex = findColumnIndex(item.x, columns);
            if (colIndex !== -1) {
                tableRow[colIndex] = item.text;
            }
        }
        table.push(tableRow);
    }

    return table;
}

function clusterColumns(xValues, threshold) {
    const columns = [];
    let currentCol = [];
    
    for (const x of xValues.sort((a, b) => a - b)) {
        if (currentCol.length === 0 || x - currentCol[currentCol.length - 1] < threshold) {
            currentCol.push(x);
        } else {
            columns.push(median(currentCol));
            currentCol = [x];
        }
    }
    if (currentCol.length) columns.push(median(currentCol));
    return columns;
}

function findColumnIndex(x, columns) {
    return columns.findIndex(col => Math.abs(x - col) < 10);
}

function median(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// File handling and UI functions
let pdfFile = null;
const { utils, writeFile } = XLSX;

document.getElementById('fileInput').addEventListener('change', handleFileUpload);
initDragDrop();

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (validateFile(file)) {
        pdfFile = file;
        showFileInfo(file);
        await showPreview();
    }
}

function validateFile(file) {
    const maxSize = 25 * 1024 * 1024;
    const allowedTypes = ['application/pdf'];
    
    if (!allowedTypes.includes(file.type)) {
        alert('Please select a PDF file');
        return false;
    }
    if (file.size > maxSize) {
        alert('File size exceeds 25MB limit');
        return false;
    }
    return true;
}

async function showPreview() {
    try {
        const tables = await extractTablesFromPDF(pdfFile);
        displayTablesPreview(tables);
    } catch (error) {
        alert('Preview generation failed: ' + error.message);
    }
}

async function convertToExcel() {
    if (!pdfFile) return alert('Please select a PDF file');
    
    try {
        const tables = await extractTablesFromPDF(pdfFile);
        const workbook = utils.book_new();
        
        tables.forEach((table, index) => {
            const worksheet = utils.aoa_to_sheet(table);
            utils.book_append_sheet(workbook, worksheet, `Sheet${index + 1}`);
        });

        writeFile(workbook, `converted-${pdfFile.name.replace(/\.[^/.]+$/, "")}.xlsx`);
    } catch (err) {
        alert(`Conversion failed: ${err.message}`);
    }
}

// UI helper functions
function displayTablesPreview(tables) {
    const previewDiv = document.getElementById('tablePreview');
    previewDiv.innerHTML = tables.map((table, i) => `
        <div class="table-container">
            <h5>Table ${i + 1}</h5>
            <table>
                ${table.map(row => `
                    <tr>
                        ${row.map(cell => `<td>${cell}</td>`).join('')}
                    </tr>
                `).join('')}
            </table>
        </div>
    `).join('');
}

function clearAll() {
    pdfFile = null;
    document.getElementById('fileInfo').innerHTML = '';
    document.getElementById('tablePreview').innerHTML = '';
}

// Drag and drop handlers
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
        if (dt.files.length) handleFileUpload({ target: { files: dt.files } });
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
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}