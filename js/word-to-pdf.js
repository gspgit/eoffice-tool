// js/word-to-pdf.js
class PDFConverter {
    static init() {
        this.fileInput = document.getElementById('fileInput');
        this.dropZone = document.getElementById('dropZone');
        this.convertBtn = document.getElementById('convertBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.previewContainer = document.getElementById('previewContainer');
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.currentFile = null;

        this.registerEventListeners();
    }

    static registerEventListeners() {
        // File selection
        document.getElementById('selectFileBtn').addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileInput(e.target.files));

        // Drag and drop
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('dragover');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            this.handleFileInput(e.dataTransfer.files);
        });

        // Buttons
        this.convertBtn.addEventListener('click', () => this.convertToPDF());
        this.clearBtn.addEventListener('click', () => this.clearAll());
    }

    static handleFileInput(files) {
        if (!files.length) return;
        
        const file = files[0];
        if (this.validateFile(file)) {
            this.currentFile = file;
            this.showFileInfo(file);
            this.previewFile(file);
        }
    }

    static validateFile(file) {
        const validTypes = [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        const maxSize = 20 * 1024 * 1024; // 20MB

        if (!validTypes.includes(file.type)) {
            this.showError('Please select a Word document (.doc or .docx)');
            return false;
        }

        if (file.size > maxSize) {
            this.showError('File size exceeds 20MB limit');
            return false;
        }

        return true;
    }

    static async convertToPDF() {
        if (!this.currentFile) {
            this.showError('Please select a file first');
            return;
        }

        try {
            this.toggleLoading(true);
            const htmlContent = await this.convertWordToHtml(this.currentFile);
            const pdf = await this.generatePDF(htmlContent);
            this.savePDF(pdf);
            this.showSuccess('File converted successfully!');
        } catch (error) {
            this.showError(`Conversion failed: ${error.message}`);
        } finally {
            this.toggleLoading(false);
        }
    }

    static async convertWordToHtml(file) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        
        if (result.messages.length > 0) {
            console.warn('Conversion warnings:', result.messages);
        }

        return this.sanitizeHTML(result.value);
    }

    static sanitizeHTML(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remove potentially dangerous elements
        const forbiddenTags = ['script', 'iframe', 'object', 'embed'];
        forbiddenTags.forEach(tag => {
            tempDiv.querySelectorAll(tag).forEach(el => el.remove());
        });

        return tempDiv.innerHTML;
    }

    static async generatePDF(html) {
        return new Promise((resolve, reject) => {
            const pageSize = document.getElementById('pageSize').value;
            const margin = parseInt(document.getElementById('pageMargin').value);
            
            // Create temporary container
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            tempDiv.style.width = this.getPageWidth(pageSize) + 'mm';
            tempDiv.innerHTML = html;
            document.body.appendChild(tempDiv);

            html2canvas(tempDiv, {
                scale: 2,
                logging: false,
                useCORS: true
            }).then(canvas => {
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: pageSize
                });

                const imgData = canvas.toDataURL('image/png');
                const imgProps = pdf.getImageProperties(imgData);
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                
                // Calculate dimensions with margins
                const contentWidth = pageWidth - (margin * 2);
                const contentHeight = (imgProps.height * contentWidth) / imgProps.width;

                pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
                document.body.removeChild(tempDiv);
                resolve(pdf);
            }).catch(reject);
        });
    }

    static getPageWidth(pageSize) {
        const sizes = {
            a4: 210,
            letter: 216,
            legal: 216
        };
        return sizes[pageSize] || 210;
    }

    static savePDF(pdf) {
        const fileName = this.currentFile.name.replace(/\.[^/.]+$/, "") + '.pdf';
        pdf.save(fileName);
    }

    static toggleLoading(show) {
        this.loadingSpinner.style.display = show ? 'flex' : 'none';
        this.convertBtn.disabled = show;
    }

    static showFileInfo(file) {
        document.getElementById('fileInfo').innerHTML = `
            <div class="file-info">
                <i class="fas fa-file-word"></i>
                <div>
                    <p>${file.name}</p>
                    <small>${this.formatFileSize(file.size)}</small>
                </div>
            </div>
        `;
    }

    static formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
    }

    static showError(message) {
        this.showNotification(message, 'error');
    }

    static showSuccess(message) {
        this.showNotification(message, 'success');
    }

    static showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'times-circle' : 'check-circle'}"></i>
            ${message}
        `;

        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    static clearAll() {
        this.currentFile = null;
        document.getElementById('fileInfo').innerHTML = '';
        this.fileInput.value = '';
        this.previewContainer.innerHTML = '';
    }

    static async previewFile(file) {
        try {
            const htmlContent = await this.convertWordToHtml(file);
            this.previewContainer.innerHTML = htmlContent;
        } catch (error) {
            this.showError('Preview unavailable: ' + error.message);
        }
    }
}