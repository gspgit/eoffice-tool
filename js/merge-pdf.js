// merge-pdf.js
let files = [];
let pageThumbnails = [];
let currentPageOrder = [];
let dragStartIndex = null;
let draggedPageIndex = null;
// Add after existing variables at the top
let uploadProgress = 0;
const progressBarHTML = `
<div class="progress-container">
    <div class="progress-fill" style="width: 0%"></div>
    <div class="progress-text">0%</div>
</div>`;

// Initialize drag and drop
document.addEventListener('DOMContentLoaded', () => {
    initDragDrop();
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
});

// File Handling
async function handleFileSelect(e) {
    const newFiles = Array.from(e.target.files || e.dataTransfer.files);
    if (!validateFiles(newFiles)) return;

    // Initialize progress
    const progressBar = document.getElementById('progressBar');
    const progressFill = progressBar.querySelector('.progress-fill');
    const progressText = progressBar.querySelector('.progress-text');
    progressBar.style.display = 'flex';
    let processedCount = 0;

    for (const file of newFiles) {
        try {
            const pdfInfo = await getPDFInfo(file);
            file.pageCount = pdfInfo.numPages;
            file.pageRanges = `1-${pdfInfo.numPages}`;
            file.thumbnail = await generateThumbnail(file);
        } catch (err) {
            console.error('Error processing file:', err);
        } finally {
            // Update progress after each file
            processedCount++;
            const progress = (processedCount / newFiles.length) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;
        }
    }

    // Complete processing
    progressBar.style.display = 'none';
    files = [...files, ...newFiles];
    updateFileList();
    await generatePageOrderPreview();
}
function validateFiles(fileList) {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const validTypes = ['application/pdf'];
    
    return fileList.every(file => {
        if (!validTypes.includes(file.type)) {
            showNotification('Only PDF files are allowed', 'error');
            return false;
        }
        if (file.size > maxSize) {
            showNotification('File size exceeds 50MB limit', 'error');
            return false;
        }
        return true;
    });
}

// Thumbnail Generation
async function getPDFInfo(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    return pdf;
}

async function generateThumbnail(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        return canvas.toDataURL();
    } catch {
        return 'assets/pdf-icon.png';
    }
}

// Page Range Handling
function validatePageRange(input) {
    const maxPages = parseInt(input.dataset.initialPages);
    const value = input.value.trim();
    input.classList.remove('error');

    if (!/^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/.test(value)) {
        input.classList.add('error');
        return false;
    }

    const ranges = value.split(',');
    for (const range of ranges) {
        const [start=1, end=start] = range.split('-').map(Number);
        if (start < 1 || end > maxPages || start > end) {
            input.classList.add('error');
            return false;
        }
    }
    
    files[input.closest('.file-item').dataset.index].pageRanges = value;
    generatePageOrderPreview();
    return true;
}

function parsePageRanges(rangeString, maxPages) {
    const pages = new Set();
    const ranges = rangeString.split(',').map(r => r.trim());

    ranges.forEach(range => {
        let [start, end] = range.split('-').map(Number);
        start = Math.max(1, start || 1);
        end = end ? Math.min(end, maxPages) : start;
        
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            pages.add(i);
        }
    });

    return Array.from(pages).sort((a, b) => a - b);
}

// Page Order Management
async function generatePageOrderPreview() {
    pageThumbnails = [];
    let pageIndex = 1;

    for (const [fileIndex, file] of files.entries()) {
        const pages = parsePageRanges(file.pageRanges, file.pageCount);
        for (const pageNum of pages) {
            const thumb = await generatePageThumbnail(file, pageNum);
            pageThumbnails.push({
                fileIndex,
                pageNum,
                thumb,
                displayOrder: pageIndex++,
                rotation: 0
            });
        }
    }

    currentPageOrder = [...pageThumbnails];
    renderPageOrder();
    updatePageCount();
}

async function generatePageThumbnail(file, pageNum) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(pageNum);
        
        const viewport = page.getViewport({ scale: 0.2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        return canvas.toDataURL();
    } catch {
        return 'assets/page-icon.png';
    }
}

function renderPageOrder() {
    const grid = document.getElementById('pagesGrid');
    grid.innerHTML = currentPageOrder.map((page, index) => `
        <div class="page-thumb" draggable="true" data-index="${index}">
            <img src="${page.thumb}" alt="Page ${index + 1}" 
                 style="transform: rotate(${page.rotation}deg)">
            <div class="page-number">${index + 1}</div>
            <div class="page-controls">
                <button class="btn-rotate" onclick="rotatePage(this, -90)">
                    <i class="fas fa-undo"></i>
                </button>
                <button class="btn-rotate" onclick="rotatePage(this, 90)">
                    <i class="fas fa-redo"></i>
                </button>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.page-thumb').forEach(thumb => {
        thumb.addEventListener('dragstart', handlePageDragStart);
        thumb.addEventListener('dragover', handlePageDragOver);
        thumb.addEventListener('drop', handlePageDrop);
        thumb.querySelector('img').addEventListener('click', () => 
            showZoomedPage(thumb.querySelector('img').src)
        );
    });
}

// Drag and Drop Handlers
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
        handleFileSelect(e);
    });
}

function handlePageDragStart(e) {
    draggedPageIndex = +e.currentTarget.dataset.index;
    e.currentTarget.classList.add('dragging');
}

function handlePageDragOver(e) {
    e.preventDefault();
}

function handlePageDrop(e) {
    e.preventDefault();
    const dropIndex = +e.currentTarget.dataset.index;
    swapPages(draggedPageIndex, dropIndex);
    e.currentTarget.classList.remove('dragging');
}

function swapPages(oldIndex, newIndex) {
    const temp = currentPageOrder[oldIndex];
    currentPageOrder.splice(oldIndex, 1);
    currentPageOrder.splice(newIndex, 0, temp);
    renderPageOrder();
}

// UI Updates
function updateFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = files.map((file, index) => `
        <div class="file-item" draggable="true" data-index="${index}">
            <i class="fas fa-grip-vertical drag-handle"></i>
            <div class="file-preview">
                <img class="pdf-thumbnail" src="${file.thumbnail}" alt="Preview">
                <div class="page-range">
                    <input type="text" 
                           value="${file.pageRanges}" 
                           data-initial-pages="${file.pageCount}"
                           onchange="validatePageRange(this)">
                    <span>/${file.pageCount}</span>
                </div>
            </div>
            <div class="file-info">
                <span>${file.name}</span>
                <span class="file-size">${formatFileSize(file.size)}</span>
            </div>
            <button onclick="removeFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

    document.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('dragstart', handleFileDragStart);
        item.addEventListener('dragover', handleFileDragOver);
        item.addEventListener('drop', handleFileDrop);
    });
}

function handleFileDragStart(e) {
    dragStartIndex = +e.currentTarget.dataset.index;
    e.currentTarget.classList.add('dragging');
}

function handleFileDragOver(e) {
    e.preventDefault();
}

function handleFileDrop(e) {
    e.preventDefault();
    const dragEndIndex = +e.currentTarget.dataset.index;
    swapFiles(dragStartIndex, dragEndIndex);
    e.currentTarget.classList.remove('dragging');
}

function swapFiles(oldIndex, newIndex) {
    [files[oldIndex], files[newIndex]] = [files[newIndex], files[oldIndex]];
    updateFileList();
    generatePageOrderPreview();
}

// Merging Functionality
async function mergeFiles() {
    if (files.length < 1) {
        showNotification('Please select files to merge', 'error');
        return;
    }

    const mergeBtn = document.querySelector('.btn-primary');
    const progressBar = document.getElementById('progressBar');
    const progressFill = progressBar.querySelector('.progress-fill');
    
    try {
        // UI Setup
        mergeBtn.innerHTML = `<i class="fas fa-spinner loading-spinner"></i> Merging...`;
        mergeBtn.disabled = true;
        progressBar.style.display = 'block';
        progressFill.style.width = '0%';

        // Merge Process
        const mergedPdf = await PDFLib.PDFDocument.create();
        const totalPages = currentPageOrder.length;

        for (let i = 0; i < totalPages; i++) {
            const { fileIndex, pageNum, rotation = 0 } = currentPageOrder[i];
            const file = files[fileIndex];
            
            const pdfBytes = await file.arrayBuffer();
            const srcPdf = await PDFLib.PDFDocument.load(pdfBytes);
            const [copiedPage] = await mergedPdf.copyPages(srcPdf, [pageNum - 1]);

            if (rotation !== 0) {
                copiedPage.setRotation(PDFLib.degrees(rotation));
            }

            mergedPdf.addPage(copiedPage);
            progressFill.style.width = `${((i + 1) / totalPages * 100)}%`;
        }

        // Finalize
        const mergedBytes = await mergedPdf.save();
        const blob = new Blob([mergedBytes], { type: 'application/pdf' });
        
        // Generate filename based on first file
        const firstName = files[0].name.replace(/.pdf$/i, '');
        const mergedFileName = `${firstName}-merged.pdf`;
        
        saveAs(blob, mergedFileName);
        showNotification('PDFs merged successfully!');
    } catch (err) {
        console.error('Merge error:', err);
        showNotification(`Error merging files: ${err.message}`, 'error');
    } finally {
        mergeBtn.innerHTML = `<i class="fas fa-merge"></i> Merge PDFs`;
        mergeBtn.disabled = false;
        progressBar.style.display = 'none';
    }
}
// Utility Functions
function formatFileSize(bytes) {
    const units = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

function showNotification(message, type = 'success') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    
    notification.className = `notification ${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function updatePageCount() {
    document.getElementById('pageCount').textContent = 
        `${currentPageOrder.length} pages`;
}

function removeFile(index) {
    files.splice(index, 1);
    updateFileList();
    generatePageOrderPreview();
}

function clearFiles() {
    files = [];
    pageThumbnails = [];
    currentPageOrder = [];
    updateFileList();
    renderPageOrder();
    updatePageCount();
}

function resetPageOrder() {
    currentPageOrder = [...pageThumbnails];
    renderPageOrder();
    updatePageCount();
}

// Rotation Handling
function rotatePage(btn, degrees) {
    const thumb = btn.closest('.page-thumb');
    const index = parseInt(thumb.dataset.index);
    const currentRotation = currentPageOrder[index].rotation;
    const newRotation = (currentRotation + degrees) % 360;
    
    currentPageOrder[index].rotation = newRotation;
    thumb.querySelector('img').style.transform = `rotate(${newRotation}deg)`;
}

// Zoom Functionality
function showZoomedPage(imgSrc) {
    const overlay = document.querySelector('.zoom-overlay');
    overlay.style.display = 'block';
    overlay.querySelector('img').src = imgSrc;
}

function closeZoom() {
    document.querySelector('.zoom-overlay').style.display = 'none';
}