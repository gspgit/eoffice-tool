// Constants
const fileInput = document.getElementById('fileInput');
const pdfCanvas = document.getElementById('pdfCanvas');
const ctx = pdfCanvas.getContext('2d');
let currentPDF = null;
let currentPage = 1;
let scale = 1.5;
let selectedTool = 'select';
let annotations = {};
let isDrawing = false;
let drawingPath = [];
let imageToInsert = null;

// Tool properties
const fontSizeInput = document.getElementById('fontSize');
const colorPicker = document.getElementById('colorPicker');
const opacityInput = document.getElementById('opacity');

document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedTool = btn.dataset.tool;
    });
});

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        const fileReader = new FileReader();
        fileReader.onload = async function() {
            const typedArray = new Uint8Array(this.result);
            currentPDF = await pdfjsLib.getDocument(typedArray).promise;
            renderPage(currentPage);
        };
        fileReader.readAsArrayBuffer(file);
    }
});

async function renderPage(pageNum) {
    const page = await currentPDF.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;

    const renderContext = {
        canvasContext: ctx,
        viewport: viewport
    };
    await page.render(renderContext).promise;
    renderAnnotations(pageNum);
}

function renderAnnotations(pageNum) {
    ctx.save();
    ctx.globalAlpha = opacityInput.value;
    if (annotations[pageNum]) {
        annotations[pageNum].forEach(obj => {
            ctx.strokeStyle = ctx.fillStyle = obj.color;
            ctx.lineWidth = 2;
            ctx.font = `${obj.size}px Arial`;

            switch (obj.type) {
                case 'text':
                    ctx.fillText(obj.text, obj.x, obj.y);
                    break;
                case 'highlight':
                    ctx.fillStyle = obj.color;
                    ctx.globalAlpha = 0.3;
                    ctx.fillRect(obj.x, obj.y - obj.size, obj.width, obj.size);
                    break;
                case 'draw':
                    ctx.beginPath();
                    obj.path.forEach((p, i) => {
                        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
                    });
                    ctx.stroke();
                    break;
                case 'rect':
                    ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
                    break;
                case 'image':
                    const img = new Image();
                    img.onload = () => {
                        ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
                    };
                    img.src = obj.src;
                    break;
            }
        });
    }
    ctx.restore();
}

pdfCanvas.addEventListener('mousedown', (e) => {
    const x = e.offsetX, y = e.offsetY;
    if (!annotations[currentPage]) annotations[currentPage] = [];

    if (selectedTool === 'text') {
        const text = prompt('Enter text:');
        if (text) {
            annotations[currentPage].push({
                type: 'text',
                text,
                x, y,
                color: colorPicker.value,
                size: fontSizeInput.value
            });
        }
    } else if (selectedTool === 'highlight') {
        const width = 100;
        annotations[currentPage].push({
            type: 'highlight',
            x, y,
            width,
            size: fontSizeInput.value,
            color: colorPicker.value
        });
    } else if (selectedTool === 'draw') {
        isDrawing = true;
        drawingPath = [{ x, y }];
    } else if (selectedTool === 'shape') {
        const width = 100, height = 50;
        annotations[currentPage].push({
            type: 'rect',
            x, y,
            width, height,
            color: colorPicker.value
        });
    } else if (selectedTool === 'image') {
        const imgURL = prompt("Enter image URL:");
        if (imgURL) {
            annotations[currentPage].push({
                type: 'image',
                x, y,
                width: 100,
                height: 100,
                src: imgURL
            });
        }
    } else if (selectedTool === 'erase') {
        annotations[currentPage] = annotations[currentPage].filter(obj => {
            const dx = obj.x - x;
            const dy = obj.y - y;
            return dx * dx + dy * dy > 400; // rough radius of 20px
        });
    }
    renderPage(currentPage);
});

pdfCanvas.addEventListener('mousemove', (e) => {
    if (isDrawing && selectedTool === 'draw') {
        drawingPath.push({ x: e.offsetX, y: e.offsetY });
        renderPage(currentPage);
    }
});

pdfCanvas.addEventListener('mouseup', () => {
    if (isDrawing && selectedTool === 'draw') {
        isDrawing = false;
        annotations[currentPage].push({
            type: 'draw',
            path: drawingPath.slice(),
            color: colorPicker.value
        });
    }
});

window.clearAnnotations = function() {
    annotations = {};
    renderPage(currentPage);
};

window.downloadPDF = async function() {
    const { PDFDocument, rgb } = await import('https://cdn.skypack.dev/pdf-lib');
    const pdfBytes = await currentPDF.getData();
    const pdfDoc = await PDFDocument.load(pdfBytes);

    for (const [pageNum, items] of Object.entries(annotations)) {
        const pageIndex = parseInt(pageNum) - 1;
        const page = pdfDoc.getPages()[pageIndex];

        items.forEach(obj => {
            const color = hexToRgb(obj.color);
            switch (obj.type) {
                case 'text':
                    page.drawText(obj.text, {
                        x: obj.x,
                        y: page.getHeight() - obj.y,
                        size: parseInt(obj.size),
                        color: rgb(color.r / 255, color.g / 255, color.b / 255)
                    });
                    break;
                case 'highlight':
                    page.drawRectangle({
                        x: obj.x,
                        y: page.getHeight() - obj.y,
                        width: obj.width,
                        height: obj.size,
                        color: rgb(color.r / 255, color.g / 255, color.b / 255),
                        opacity: 0.4
                    });
                    break;
                case 'rect':
                    page.drawRectangle({
                        x: obj.x,
                        y: page.getHeight() - obj.y - obj.height,
                        width: obj.width,
                        height: obj.height,
                        borderColor: rgb(color.r / 255, color.g / 255, color.b / 255),
                        borderWidth: 2
                    });
                    break;
                case 'draw':
                    const points = obj.path.map(p => ({ x: p.x, y: page.getHeight() - p.y }));
                    for (let i = 1; i < points.length; i++) {
                        page.drawLine({
                            start: points[i - 1],
                            end: points[i],
                            thickness: 1.5,
                            color: rgb(color.r / 255, color.g / 255, color.b / 255)
                        });
                    }
                    break;
                case 'image':
                    // Image insertion is more advanced; can be added later
                    break;
            }
        });
    }

    const pdfDataUri = await pdfDoc.saveAsBase64({ dataUri: true });
    const link = document.createElement('a');
    link.href = pdfDataUri;
    link.download = 'edited.pdf';
    link.click();
};

function hexToRgb(hex) {
    const bigint = parseInt(hex.substring(1), 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}

window.savePDF = downloadPDF;
