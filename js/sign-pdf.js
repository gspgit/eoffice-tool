class PDFSigner {
    constructor() {
        this.pdfDoc = null;
        this.signatureImage = null;
        this.currentTab = 'draw';
        this.initialize();
    }

    initialize() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupPDFJS();
    }

    setupPDFJS() {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
    }

    setupCanvas() {
        this.canvas = document.getElementById('signatureCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setCanvasResolution();
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = 2;
    }

    setCanvasResolution() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * devicePixelRatio;
        this.canvas.height = rect.height * devicePixelRatio;
        this.ctx.scale(devicePixelRatio, devicePixelRatio);
    }

    setupEventListeners() {
        // File Handling
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileUpload(e));
        
        // Drag & Drop
        const dropZone = document.getElementById('dropZone');
        dropZone.addEventListener('dragover', (e) => e.preventDefault());
        dropZone.addEventListener('drop', (e) => this.handleFileDrop(e));

        // Signature Drawing
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.endDrawing());
        this.canvas.addEventListener('touchstart', (e) => this.startDrawing(e));
        this.canvas.addEventListener('touchmove', (e) => this.draw(e));
        this.canvas.addEventListener('touchend', () => this.endDrawing());

        // Controls
        document.getElementById('inkColor').addEventListener('input', (e) => {
            this.ctx.strokeStyle = e.target.value;
        });
        
        document.getElementById('brushSize').addEventListener('input', (e) => {
            this.ctx.lineWidth = e.target.value;
        });

        // Tabs
        document.querySelectorAll('.signature-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.type));
        });

        // Image Upload
        document.getElementById('imageUpload').addEventListener('change', (e) => {
            this.handleImageUpload(e.target.files[0]);
        });
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            this.pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            this.showPDFPreview(file);
        } catch (error) {
            alert('Error loading PDF: ' + error.message);
        }
    }

    async showPDFPreview(file) {
        const pdfData = await this.pdfDoc.saveAsBase64();
        const preview = document.getElementById('pdfPreview');
        preview.innerHTML = `
            <iframe src="data:application/pdf;base64,${pdfData}"
                    width="100%" 
                    height="600"
                    style="border: 1px solid #ddd">
            </iframe>
        `;
        document.getElementById('fileInfo').innerHTML = `
            <p>File: ${file.name}<br>Size: ${this.formatFileSize(file.size)}</p>
        `;
    }

    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        [this.lastX, this.lastY] = [clientX - rect.left, clientY - rect.top];
    }

    draw(e) {
        if (!this.isDrawing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        [this.lastX, this.lastY] = [x, y];
    }

    endDrawing() {
        this.isDrawing = false;
    }

    async handleImageUpload(file) {
        if (!file.type.startsWith('image/')) return alert('Please upload an image file');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('imagePreview').innerHTML = `
                <img src="${e.target.result}" class="image-preview">
            `;
            this.signatureImage = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    switchTab(tabType) {
        this.currentTab = tabType;
        document.querySelectorAll('.signature-content').forEach(content => {
            content.classList.toggle('active', content.dataset.type === tabType);
        });
        document.querySelectorAll('.signature-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === tabType);
        });
    }

    async signPDF() {
        if (!this.pdfDoc) return alert('Please upload a PDF first');
        if (!this.validateSignature()) return alert('Please create or upload a signature');

        try {
            const signature = this.currentTab === 'draw' 
                ? await this.getCanvasSignature()
                : this.signatureImage;

            const pngImage = await this.pdfDoc.embedPng(signature);
            this.addSignatureToPDF(pngImage);
            this.downloadSignedPDF();
        } catch (error) {
            alert('Error signing PDF: ' + error.message);
        }
    }

    validateSignature() {
        if (this.currentTab === 'draw') {
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            return imageData.data.some(channel => channel !== 0);
        }
        return !!this.signatureImage;
    }

    getCanvasSignature() {
        return new Promise((resolve) => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.canvas.width;
            tempCanvas.height = this.canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(this.canvas, 0, 0);
            resolve(tempCanvas.toDataURL());
        });
    }

    addSignatureToPDF(pngImage) {
        const pages = this.pdfDoc.getPages();
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();
        
        const signatureWidth = 150;
        const signatureHeight = (pngImage.height * signatureWidth) / pngImage.width;
        
        firstPage.drawImage(pngImage, {
            x: width - signatureWidth - 50,
            y: 50,
            width: signatureWidth,
            height: signatureHeight,
            opacity: 0.9
        });
    }

    downloadSignedPDF() {
        const pdfBytes = this.pdfDoc.saveAsBase64();
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${pdfBytes}`;
        link.download = `signed-${Date.now()}.pdf`;
        link.click();
    }

    clearSignature() {
        if (this.currentTab === 'draw') {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.signatureImage = null;
            document.getElementById('imagePreview').innerHTML = '';
        }
    }

    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const exp = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, exp)).toFixed(2) + ' ' + units[exp];
    }
}

// Initialize the application
new PDFSigner();