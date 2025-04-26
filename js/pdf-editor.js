// PDF Editor Core Functionality
const { PDFDocument, rgb } = PDFLib;
let currentPDF = null;
let currentPage = 1;
let scale = 1.2;
let activeTool = null;
let annotations = [];
let undoStack = [];
let redoStack = [];
let selectedAnnotation = null;
let isDrawing = false;
let startPos = { x: 0, y: 0 };
let signaturePad = null;

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    initSignaturePad();
});

function initEventListeners() {
    // Tool Selection
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeTool = btn.dataset.tool;
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateToolVisibility();
        });
    });

    // File Handling
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    initDragDrop();

    // Canvas Events
    const canvas = document.getElementById('pdfCanvas');
    canvas.addEventListener('mousedown', handleCanvasDown);
    canvas.addEventListener('mousemove', handleCanvasMove);
    canvas.addEventListener('mouseup', handleCanvasUp);
}

// PDF Handling
async function loadPDF(file) {
    const pdfData = await file.arrayBuffer();
    currentPDF = await PDFDocument.load(pdfData);
    renderPDF();
}

async function renderPDF() {
    const pdfBytes = await currentPDF.save();
    const url = URL.createObjectURL(new Blob([pdfBytes]));
    const pdf = await pdfjsLib.getDocument(url).promise;
    const page = await pdf.getPage(currentPage);
    const viewport = page.getViewport({ scale });
    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: ctx, viewport }).promise;
    drawAnnotations(ctx);
}

// Annotation System
function drawAnnotations(ctx) {
    annotations.forEach(annotation => {
        ctx.save();
        ctx.strokeStyle = annotation.color || '#000000';
        ctx.fillStyle = annotation.color || '#000000';
        ctx.lineWidth = 2;

        switch(annotation.type) {
            case 'text':
                ctx.font = `${annotation.fontSize}px ${annotation.fontFamily}`;
                ctx.fillText(annotation.text, annotation.x, annotation.y);
                break;
            case 'rectangle':
                ctx.strokeRect(annotation.x, annotation.y, annotation.width, annotation.height);
                break;
            case 'circle':
                ctx.beginPath();
                ctx.arc(annotation.x, annotation.y, annotation.radius, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'line':
                ctx.beginPath();
                ctx.moveTo(annotation.x1, annotation.y1);
                ctx.lineTo(annotation.x2, annotation.y2);
                ctx.stroke();
                break;
            case 'signature':
                const img = new Image();
                img.src = annotation.image;
                ctx.drawImage(img, annotation.x, annotation.y, 150, 50);
                break;
        }
        ctx.restore();
    });
}

// Tool Handlers
function handleCanvasDown(e) {
    const rect = e.target.getBoundingClientRect();
    startPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };

    if(activeTool === 'select') {
        selectedAnnotation = annotations.find(a => 
            startPos.x >= a.x && startPos.x <= a.x + (a.width || 0) &&
            startPos.y >= a.y && startPos.y <= a.y + (a.height || 0)
        );
    } else {
        isDrawing = true;
    }
}

function handleCanvasMove(e) {
    if(!isDrawing) return;

    const rect = e.target.getBoundingClientRect();
    const currentPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    const ctx = document.getElementById('pdfCanvas').getContext('2d');

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    renderPDF();

    switch(activeTool) {
        case 'text':
            // Text preview during drawing
            break;
        case 'rectangle':
            ctx.strokeRect(startPos.x, startPos.y, 
                          currentPos.x - startPos.x, 
                          currentPos.y - startPos.y);
            break;
        case 'circle':
            const radius = Math.sqrt(
                Math.pow(currentPos.x - startPos.x, 2) +
                Math.pow(currentPos.y - startPos.y, 2)
            );
            ctx.beginPath();
            ctx.arc(startPos.x, startPos.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            break;
        case 'line':
            ctx.beginPath();
            ctx.moveTo(startPos.x, startPos.y);
            ctx.lineTo(currentPos.x, currentPos.y);
            ctx.stroke();
            break;
    }
}

function handleCanvasUp(e) {
    if(!isDrawing) return;
    isDrawing = false;

    const rect = e.target.getBoundingClientRect();
    const endPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };

    saveState();
    switch(activeTool) {
        case 'text':
            createTextAnnotation(startPos);
            break;
        case 'rectangle':
            annotations.push({
                type: 'rectangle',
                x: startPos.x,
                y: startPos.y,
                width: endPos.x - startPos.x,
                height: endPos.y - startPos.y,
                color: document.getElementById('colorPicker').value
            });
            break;
        case 'circle':
            annotations.push({
                type: 'circle',
                x: startPos.x,
                y: startPos.y,
                radius: Math.sqrt(
                    Math.pow(endPos.x - startPos.x, 2) +
                    Math.pow(endPos.y - startPos.y, 2)
                ),
                color: document.getElementById('colorPicker').value
            });
            break;
        case 'line':
            annotations.push({
                type: 'line',
                x1: startPos.x,
                y1: startPos.y,
                x2: endPos.x,
                y2: endPos.y,
                color: document.getElementById('colorPicker').value
            });
            break;
    }
    renderPDF();
}

// Text Annotation
function createTextAnnotation(pos) {
    const text = prompt('Enter text:');
    if(text) {
        annotations.push({
            type: 'text',
            text: text,
            x: pos.x,
            y: pos.y,
            fontSize: document.getElementById('fontSize').value,
            fontFamily: document.getElementById('fontFamily').value,
            color: document.getElementById('colorPicker').value
        });
    }
}

// Undo/Redo System
function saveState() {
    undoStack.push(JSON.stringify(annotations));
    if(undoStack.length > 50) undoStack.shift();
    redoStack = [];
}

function undo() {
    if(undoStack.length > 0) {
        redoStack.push(JSON.stringify(annotations));
        annotations = JSON.parse(undoStack.pop());
        renderPDF();
    }
}

function redo() {
    if(redoStack.length > 0) {
        undoStack.push(JSON.stringify(annotations));
        annotations = JSON.parse(redoStack.pop());
        renderPDF();
    }
}

// Signature Support
function initSignaturePad() {
    const canvas = document.getElementById('signatureCanvas');
    signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgba(255, 255, 255, 0)',
        penColor: 'rgb(0, 0, 0)'
    });

    document.getElementById('saveSignature').addEventListener('click', () => {
        if(!signaturePad.isEmpty()) {
            annotations.push({
                type: 'signature',
                image: signaturePad.toDataURL(),
                x: 50,
                y: 50
            });
            signaturePad.clear();
            renderPDF();
        }
    });
}

// Save Functionality
async function saveEditedPDF() {
    const pdfDoc = await PDFDocument.create();
    
    for(let i = 0; i < currentPDF.getPageCount(); i++) {
        const [page] = await pdfDoc.copyPages(currentPDF, [i]);
        const { width, height } = page.getSize();

        annotations.filter(a => a.page === i+1).forEach(async annotation => {
            switch(annotation.type) {
                case 'text':
                    page.drawText(annotation.text, {
                        x: annotation.x,
                        y: height - annotation.y,
                        size: parseInt(annotation.fontSize),
                        font: await pdfDoc.embedFont(annotation.fontFamily),
                        color: rgb(...hexToRgb(annotation.color))
                    });
                    break;
                case 'signature':
                    const image = await pdfDoc.embedPng(annotation.image);
                    page.drawImage(image, {
                        x: annotation.x,
                        y: height - annotation.y - 50,
                        width: 150,
                        height: 50
                    });
                    break;
                // Add other annotation types
            }
        });
        pdfDoc.addPage(page);
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'edited-document.pdf';
    link.click();
}

// Helper Functions
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
}

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
        const file = e.dataTransfer.files[0];
        if(file) handleFileUpload({ target: { files: [file] } });
    });
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if(file) loadPDF(file);
}

function updateToolVisibility() {
    document.querySelectorAll('.property-group').forEach(el => 
        el.style.display = 'none'
    );
    document.getElementById(`${activeTool}Properties`).style.display = 'block';
}