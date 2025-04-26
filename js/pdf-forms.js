// Initialize Fabric.js canvas
const canvas = new fabric.Canvas('pdfCanvas', {
    width: 800,
    height: 1000,
    selection: true,
    backgroundColor: '#ffffff'
});

let currentField = null;

// Toolbox Event Listeners
document.querySelectorAll('.form-field').forEach(item => {
    item.addEventListener('click', () => {
        const type = item.dataset.type;
        createFormField(type);
    });
});

// Form Field Creation
function createFormField(type) {
    let field;
    const defaultProps = {
        left: 100,
        top: 100,
        hasControls: true,
        lockRotation: true,
        lockScalingFlip: true,
        borderColor: '#3498db',
        cornerColor: '#3498db',
        cornerSize: 10,
        transparentCorners: false
    };

    switch(type) {
        case 'text':
            field = new fabric.Textbox('Text Input', {
                ...defaultProps,
                width: 200,
                fontSize: 14,
                type: 'textfield'
            });
            break;

        case 'checkbox':
            field = new fabric.Group([
                new fabric.Rect({
                    width: 20,
                    height: 20,
                    fill: 'white',
                    stroke: '#000',
                    strokeWidth: 1
                }),
                new fabric.Text('Checkbox', {
                    left: 30,
                    fontSize: 14
                })
            ], {
                ...defaultProps,
                type: 'checkbox'
            });
            break;

        case 'radio':
            field = new fabric.Group([
                new fabric.Circle({
                    radius: 8,
                    fill: 'white',
                    stroke: '#000',
                    strokeWidth: 1
                }),
                new fabric.Text('Radio Option', {
                    left: 25,
                    fontSize: 14
                })
            ], {
                ...defaultProps,
                type: 'radio'
            });
            break;

        case 'dropdown':
            field = new fabric.Group([
                new fabric.Rect({
                    width: 200,
                    height: 30,
                    fill: 'white',
                    stroke: '#000',
                    strokeWidth: 1
                }),
                new fabric.Triangle({
                    left: 180,
                    top: 12,
                    width: 10,
                    height: 10,
                    fill: '#666'
                })
            ], {
                ...defaultProps,
                type: 'dropdown'
            });
            break;
    }

    field.on('selected', updatePropertiesPanel);
    canvas.add(field);
    canvas.setActiveObject(field);
    canvas.renderAll();
}

// Update Properties Panel
function updatePropertiesPanel() {
    currentField = canvas.getActiveObject();
    document.getElementById('fieldName').value = currentField.name || '';
    document.getElementById('fieldLabel').value = currentField.label || '';
    document.getElementById('fieldRequired').checked = currentField.required || false;

    const typeProps = document.getElementById('typeSpecificProps');
    typeProps.innerHTML = '';

    if(currentField.type === 'dropdown') {
        typeProps.innerHTML = `
            <div class="form-group">
                <label>📜 Options:</label>
                <textarea id="fieldOptions" class="form-control" rows="4"></textarea>
                <small>Separate options with new lines</small>
            </div>
        `;
    }
}

// PDF Export Function
async function exportPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    // Add form fields
    canvas.getObjects().forEach(obj => {
        const fieldProps = {
            name: obj.name || `field_${Date.now()}`,
            x: obj.left,
            y: obj.top,
            width: obj.width,
            height: obj.height
        };

        switch(obj.type) {
            case 'textfield':
                pdf.text(obj.text, fieldProps.x, fieldProps.y);
                pdf.textField(fieldProps.name, fieldProps.x, fieldProps.y, {
                    width: fieldProps.width,
                    height: 20
                });
                break;

            case 'checkbox':
                pdf.checkbox(fieldProps.name, fieldProps.x, fieldProps.y);
                break;

            case 'radio':
                pdf.radioButton(fieldProps.name, fieldProps.x, fieldProps.y);
                break;

            case 'dropdown':
                pdf.dropdown(fieldProps.name, fieldProps.x, fieldProps.y, {
                    width: fieldProps.width,
                    height: 20
                });
                break;
        }
    });

    pdf.save('form.pdf');
}

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';