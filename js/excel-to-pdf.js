// ======================
// Configuration & State
// ======================
const config = {
  maxFileSize: 20 * 1024 * 1024, // 20MB
  allowedTypes: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ],
  pdfSettings: {
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    margins: 10
  }
};

let state = {
  excelFile: null,
  isConverting: false,
  jsPDF: window.jspdf.jsPDF
};

// Initialize jsPDF plugins
state.jsPDF.autoTable = window.jspdfAutoTable;

// ======================
// Initialization
// ======================
function initialize() {
  initializeEventListeners();
}

function initializeEventListeners() {
  document.getElementById('fileInput').addEventListener('change', handleFileUpload);
  document.getElementById('convertBtn').addEventListener('click', convertToPDF);
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  initDragDrop();
}

// ======================
// File Handling
// ======================
async function handleFileUpload(e) {
  const files = e.target.files || e.dataTransfer.files;
  
  if (files.length > 1) {
    alert('Please select only one file');
    return;
  }
  
  const file = files[0];
  if (!validateFile(file)) return;
  
  state.excelFile = file;
  showFileInfo(file);
  await showPreview();
}

function validateFile(file) {
  if (!config.allowedTypes.includes(file.type)) {
    alert('Please select an Excel file (XLS/XLSX)');
    return false;
  }
  
  if (file.size > config.maxFileSize) {
    alert('File size exceeds 20MB limit');
    return false;
  }
  
  return true;
}

// ======================
// Conversion Controller
// ======================
async function convertToPDF() {
  if (!state.excelFile) return alert('Please select an Excel file');
  if (state.isConverting) return;
  
  try {
    startConversionProcess();
    
    const pdf = createPDFDocument();
    const workbook = await processExcelFile();
    const conversionMode = document.getElementById('conversionMode').value;
    
    for (const [index, sheetName] of workbook.SheetNames.entries()) {
      if (index > 0) pdf.addPage();
      
      const sheet = workbook.Sheets[sheetName];
      conversionMode === 'table' 
        ? convertTable(pdf, sheet, sheetName)
        : await convertImage(pdf, sheet, sheetName);
    }
    
    savePDF(pdf);
  } catch (err) {
    handleConversionError(err);
  } finally {
    endConversionProcess();
  }
}

// ======================
// PDF Creation
// ======================
function createPDFDocument() {
  return new state.jsPDF({
    orientation: document.getElementById('pageOrientation').value || config.pdfSettings.orientation,
    unit: config.pdfSettings.unit,
    format: config.pdfSettings.format
  });
}

async function processExcelFile() {
  const data = await state.excelFile.arrayBuffer();
  return XLSX.read(data, { type: 'array' });
}

function savePDF(pdf) {
  const fileName = `converted-${state.excelFile.name.replace(/\.[^/.]+$/, "")}.pdf`;
  pdf.save(fileName);
}

// ======================
// Conversion Methods
// ======================
function convertTable(pdf, sheet, sheetName) {
  try {
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length === 0) return;

    const { headers, body } = prepareTableData(data);
    
    pdf.autoTable({
      head: [headers],
      body: body,
      margin: getTableMargins(),
      didDrawPage: () => drawSheetHeader(pdf, sheetName),
      styles: getTableStyles(),
      headStyles: {
        fillColor: [22, 160, 133],
        textColor: 255,
        fontStyle: 'bold'
      }
    });
  } catch (err) {
    console.error('Table conversion error:', err);
    throw new Error(`Table processing failed: ${err.message}`);
  }
}

async function convertImage(pdf, sheet, sheetName) {
  try {
    const { canvas } = await renderSheetToCanvas(sheet);
    const imageData = canvas.toDataURL('image/png');
    const dimensions = calculateImageDimensions(pdf, canvas);
    
    pdf.addImage(imageData, 'PNG', dimensions.xPos, dimensions.yPos, dimensions.imgWidth, dimensions.imgHeight);
    drawSheetHeader(pdf, sheetName);
  } catch (err) {
    console.error('Image conversion error:', err);
    throw new Error(`Image processing failed: ${err.message}`);
  }
}

// ======================
// Conversion Utilities
// ======================
function prepareTableData(data) {
  const headers = data[0].map((col, idx) => String(col || `Column ${idx + 1}`));
  const body = data.slice(1).map(row => headers.map((_, i) => String(row[i] || '')));
  return { headers, body };
}

async function renderSheetToCanvas(sheet) {
  const html = XLSX.utils.sheet_to_html(sheet);
  const tempDiv = createTempContainer(html);
  document.body.appendChild(tempDiv);
  
  // Apply styles for better rendering
  tempDiv.querySelectorAll('table').forEach(table => {
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
  });
  
  const canvas = await html2canvas(tempDiv, {
    scale: 1,
    logging: false,
    useCORS: true,
    backgroundColor: '#FFFFFF'
  });
  
  document.body.removeChild(tempDiv);
  return { canvas };
}

function createTempContainer(html) {
  const div = document.createElement('div');
  Object.assign(div.style, {
    position: 'absolute',
    left: '-9999px',
    width: '800px',
    padding: '20px',
    background: 'white',
    boxSizing: 'border-box'
  });
  div.innerHTML = html;
  return div;
}

function calculateImageDimensions(pdf, canvas) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  const maxWidth = pageWidth - 40;
  const maxHeight = pageHeight - 40;
  const ratio = canvas.width / canvas.height;
  
  let imgWidth = maxWidth;
  let imgHeight = imgWidth / ratio;
  
  if (imgHeight > maxHeight) {
    imgHeight = maxHeight;
    imgWidth = imgHeight * ratio;
  }

  return {
    xPos: (pageWidth - imgWidth) / 2,
    yPos: 20,
    imgWidth,
    imgHeight
  };
}

// ======================
// UI Functions
// ======================
function startConversionProcess() {
  state.isConverting = true;
  document.getElementById('convertBtn').disabled = true;
  document.getElementById('loading').style.display = 'block';
}

function endConversionProcess() {
  state.isConverting = false;
  document.getElementById('convertBtn').disabled = false;
  document.getElementById('loading').style.display = 'none';
}

function handleConversionError(err) {
  console.error('Conversion error:', err);
  alert(`Conversion failed: ${err.message}`);
}

async function showPreview() {
  try {
    const data = await state.excelFile.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    document.getElementById('tablePreview').innerHTML = XLSX.utils.sheet_to_html(firstSheet);
  } catch (err) {
    console.error('Preview error:', err);
    document.getElementById('tablePreview').innerHTML = '<p>Error loading preview</p>';
  }
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
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// ======================
// Drag & Drop
// ======================
function initDragDrop() {
  const dropZone = document.getElementById('dropZone');
  
  ['dragover', 'dragleave', 'drop'].forEach(event => {
    dropZone.addEventListener(event, e => {
      e.preventDefault();
      e.stopPropagation();
    });
  });
  
  dropZone.addEventListener('dragover', () => dropZone.classList.add('dragover'));
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', handleFileDrop);
}

function handleFileDrop(e) {
  dropZone.classList.remove('dragover');
  handleFileUpload(e);
}

// ======================
// Utility Functions
// ======================
function getTableMargins() {
  const margin = parseInt(document.getElementById('pageMargins').value) || config.pdfSettings.margins;
  return { 
    top: 20,
    right: margin,
    left: margin,
    bottom: margin
  };
}

function getTableStyles() {
  return {
    overflow: 'linebreak',
    cellPadding: 2,
    fontSize: 10,
    valign: 'middle'
  };
}

function drawSheetHeader(pdf, sheetName) {
  pdf.setFontSize(12);
  pdf.setTextColor(40);
  pdf.text(sheetName, 20, 15);
}

function clearAll() {
  state.excelFile = null;
  document.getElementById('fileInfo').innerHTML = '';
  document.getElementById('tablePreview').innerHTML = '';
  document.getElementById('fileInput').value = '';
}

// Initialize the application
initialize();