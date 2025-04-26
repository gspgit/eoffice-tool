// page-numbers.js
class PageNumberTool {
    constructor() {
        this.pdfFile = null;
        this.pdfDoc = null;
        this.initialize();
    }

    initialize() {
        this.initializePDFJS();
        this.setupEventListeners();
    }

    initializePDFJS() {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';
    }

    setupEventListeners() {
        // File Input
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('clearBtn').addEventListener('click', () => this.resetAll());
        // Drag & Drop
        const dropZone = document.getElementById('dropZone');
        dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        dropZone.addEventListener('drop', (e) => this.handleFileDrop(e));
        
        // Controls
        document.getElementById('addNumbersBtn').addEventListener('click', () => this.addPageNumbers());
        document.getElementById('startFrom').addEventListener('change', () => this.toggleStartNumber());
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }
    async handleFileDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) this.handleFileUpload({ target: { files: [file] } });
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!this.validateFile(file)) return;

        this.pdfFile = file;
        try {
            const arrayBuffer = await file.arrayBuffer();
            await this.showPreview(arrayBuffer);
            this.showFileInfo(file);
        } catch (error) {
            this.showError('Error loading PDF', error);
        }
    }

    validateFile(file) {
        const maxSize = 25 * 1024 * 1024;
        const validTypes = ['application/pdf', 'application/octet-stream'];
        
        if (!validTypes.includes(file.type)) {
            this.showError('Please select a PDF file');
            return false;
        }
        
        if (file.size > maxSize) {
            this.showError('File size exceeds 25MB limit');
            return false;
        }
        return true;
    }

    async showPreview(arrayBuffer) {
        try {
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            this.pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            
            const container = document.getElementById('previewContainer');
            container.innerHTML = '';
            
            // Render first 3 pages
            for (let i = 0; i < Math.min(pdf.numPages, 3); i++) {
                const page = await pdf.getPage(i + 1);
                const viewport = page.getViewport({ scale: 0.5 });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
                
                const pageDiv = document.createElement('div');
                pageDiv.className = 'preview-page';
                pageDiv.innerHTML = `<p>Page ${i + 1}</p>`;
                pageDiv.appendChild(canvas);
                container.appendChild(pageDiv);
            }
        } catch (error) {
            this.showError('Error generating preview', error);
        }
    }

    async addPageNumbers() {
        if (!this.pdfDoc) {
            this.showError('Please upload a PDF file first');
            return;
        }

        try {
            const pages = this.pdfDoc.getPages();
            const font = await this.getSelectedFont();
            
            pages.forEach((page, index) => {
                if (this.shouldSkipPage(index)) return;
                
                const pageNumber = this.calculatePageNumber(index);
                const text = this.formatPageNumber(pageNumber);
                const position = this.calculatePosition(page, text, font);
                
                page.drawText(text, {
                    x: position.x,
                    y: position.y,
                    size: this.getFontSize(),
                    font: font,
                    color: this.getTextColor(),
                    opacity: 0.9
                });
            });

            this.downloadModifiedPDF();
        } catch (error) {
            this.showError('Failed to add page numbers', error);
        }
    }

    getSelectedFont() {
        const fontMap = {
            'Helvetica': 'Helvetica',
            'Times-Roman': 'Times-Roman',
            'Courier': 'Courier'
        };
        const selectedFont = document.getElementById('fontFamily').value;
        return this.pdfDoc.embedFont(fontMap[selectedFont]);
    }

    calculatePageNumber(index) {
        const startFrom = document.getElementById('startFrom').checked ?
            parseInt(document.getElementById('startNumber').value) : 1;
        const skipFirst = document.getElementById('skipFirstPage').checked;
        
        return startFrom + (skipFirst ? index - 1 : index);
    }

    calculatePosition(page, text, font) {
        const { width, height } = page.getSize();
        const position = document.getElementById('position').value;
        const margin = parseInt(document.getElementById('marginSize').value) || 20;
        const fontSize = this.getFontSize();

        const textWidth = font.widthOfTextAtSize(text, fontSize);
        
        const positions = {
            'top-left': { x: margin, y: height - margin - fontSize },
            'top-right': { x: width - textWidth - margin, y: height - margin - fontSize },
            'bottom-center': { x: (width - textWidth) / 2, y: margin },
            'bottom-left': { x: margin, y: margin },
            'bottom-right': { x: width - textWidth - margin, y: margin }
        };

        return positions[position];
    }

    formatPageNumber(number) {
        const format = document.getElementById('numberFormat').value;
        
        const formatters = {
            '1': n => n.toString(),
            'A': n => this.numberToLetter(n).toUpperCase(),
            'a': n => this.numberToLetter(n).toLowerCase(),
            'I': n => this.numberToRoman(n).toUpperCase(),
            'i': n => this.numberToRoman(n).toLowerCase()
        };
        
        return formatters[format](number);
    }

    numberToLetter(n) {
        let result = '';
        while (n > 0) {
            const remainder = (n - 1) % 26;
            result = String.fromCharCode(65 + remainder) + result;
            n = Math.floor((n - 1) / 26);
        }
        return result || 'A';
    }

    numberToRoman(num) {
        const roman = [
            ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
            ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
            ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]
        ];
        
        return roman.reduce((acc, [key, value]) => {
            while (num >= value) {
                acc += key;
                num -= value;
            }
            return acc;
        }, '');
    }

    getFontSize() {
        return parseInt(document.getElementById('fontSize').value) || 12;
    }

    getTextColor() {
        const hex = document.getElementById('textColor').value;
        const rgb = hex.match(/[A-Za-z0-9]{2}/g).map(v => parseInt(v, 16)/255);
        return PDFLib.rgb(...rgb);
    }

    shouldSkipPage(index) {
        return document.getElementById('skipFirstPage').checked && index === 0;
    }
    
resetAll() {
    // Reset form elements
    document.getElementById('fileInput').value = '';
    document.getElementById('position').value = 'bottom-center';
    document.getElementById('marginSize').value = 20;
    document.getElementById('numberFormat').value = '1';
    document.getElementById('fontFamily').value = 'Helvetica';
    document.getElementById('fontSize').value = '12';
    document.getElementById('textColor').value = '#000000';
    document.getElementById('startFrom').checked = false;
    document.getElementById('startNumber').value = '1';
    document.getElementById('skipFirstPage').checked = false;

    // Clear PDF data
    this.pdfFile = null;
    this.pdfDoc = null;

    // Clear preview and file info
    document.getElementById('fileInfo').innerHTML = '';
    document.getElementById('previewContainer').innerHTML = '';
    document.getElementById('previewSection').style.display = 'none';

    // Reset any error messages
    document.getElementById('errorAlert').style.display = 'none';
    document.getElementById('errorAlert').textContent = '';

    // Ensure start number input is properly disabled
    this.toggleStartNumber();
}
    toggleStartNumber() {
        const startNumber = document.getElementById('startNumber');
        startNumber.disabled = !document.getElementById('startFrom').checked;
    }

    async downloadModifiedPDF() {
        const pdfBytes = await this.pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `numbered-${this.pdfFile.name}`;
        link.click();
    }

    showFileInfo(file) {
        document.getElementById('fileInfo').innerHTML = `
            <p><strong>File:</strong> ${file.name}</p>
            <p><strong>Size:</strong> ${this.formatFileSize(file.size)}</p>
        `;
    }

    formatFileSize(bytes) {
        const units = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Byte';
        const exp = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, exp)).toFixed(2) + ' ' + units[exp];
    }

    showError(message, error = null) {
        console.error(error || message);
        alert(`${message}${error ? `: ${error.message}` : ''}`);
    }
}

// Initialize the tool
const pageNumberTool = new PageNumberTool();

this 