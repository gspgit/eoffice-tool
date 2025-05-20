document.getElementById('fileInput').addEventListener('change', handleFileSelect);

let pdfFile = null;

function handleFileSelect(event) {
    pdfFile = event.target.files[0];
    const fileInfo = document.getElementById('fileInfo');
    if (pdfFile) {
        fileInfo.innerHTML = `<p>Selected file: <strong>${pdfFile.name}</strong></p>`;
    } else {
        fileInfo.innerHTML = '';
    }
}

function clearFile() {
    document.getElementById('fileInput').value = '';
    document.getElementById('fileInfo').innerHTML = '';
    document.getElementById('outputText').value = '';
    document.getElementById('progressInfo').innerText = '';
    pdfFile = null;
}

async function convertToText() {
    if (!pdfFile) {
        alert('Please select a PDF file first.');
        return;
    }

    const preserveLineBreaks = document.getElementById('preserveLineBreaks')?.checked;
    const removeWhitespace = document.getElementById('removeWhitespace')?.checked;
    const progressInfo = document.getElementById('progressInfo');
    const outputContainer = document.getElementById('outputText');

    const reader = new FileReader();

    reader.onload = async function () {
        const typedArray = new Uint8Array(reader.result);
        const loadingTask = pdfjsLib.getDocument({ data: typedArray });
        const pdf = await loadingTask.promise;

        let fullText = '';
        progressInfo.innerText = `Processing ${pdf.numPages} page(s)...`;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            progressInfo.innerText = `Processing page ${pageNum} of ${pdf.numPages}...`;

            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const strings = textContent.items.map(item => item.str);

            let pageText = strings.join(preserveLineBreaks ? '\n' : ' ');
            if (removeWhitespace) {
                pageText = pageText.replace(/\s+/g, ' ').trim();
            }

            fullText += pageText + (preserveLineBreaks ? '\n\n' : ' ');
        }

        progressInfo.innerText = `Done. Extracted text is shown below.`;
        outputContainer.value = fullText.trim();

        // Optional auto-download
        // downloadText(fullText.trim(), pdfFile.name.replace(/\.pdf$/i, '.txt'));
    };

    reader.readAsArrayBuffer(pdfFile);
}

function copyToClipboard() {
    const outputText = document.getElementById('outputText');
    outputText.select();
    outputText.setSelectionRange(0, 99999); // For mobile
    document.execCommand('copy');
    alert('Text copied to clipboard.');
}

function downloadEditedText() {
    const editedText = document.getElementById('outputText').value;
    if (!editedText.trim()) {
        alert('There is no text to download.');
        return;
    }

    const filename = pdfFile
        ? pdfFile.name.replace(/\.pdf$/i, '-edited.txt')
        : 'edited-text.txt';

    downloadText(editedText, filename);
}

function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}