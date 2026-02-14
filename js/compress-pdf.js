let currentPDF = null;
let compressedPDF = null;
let originalSize = 0;

document.addEventListener("DOMContentLoaded", function(){

    const fileInput = document.getElementById("fileInput");
    const dropZone = document.getElementById("dropZone");

    fileInput.addEventListener("change", handleFile);

    dropZone.addEventListener("dragover", function(e){
        e.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", function(){
        dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", function(e){
        e.preventDefault();
        dropZone.classList.remove("dragover");
        handleFile({ target: { files: e.dataTransfer.files } });
    });

});

function handleFile(e){
    const file = e.target.files[0];
    if(!file || file.type !== "application/pdf"){
        alert("Select valid PDF file");
        return;
    }
    currentPDF = file;
    originalSize = file.size;
    document.getElementById("fileInfo").innerHTML =
        `<p><strong>${file.name}</strong><br>${formatSize(file.size)}</p>`;
}

function formatSize(bytes){
    return (bytes/(1024*1024)).toFixed(2) + " MB";
}

async function compressPDF(){

    if(!currentPDF){
        alert("Select PDF first");
        return;
    }

    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");

    progressContainer.style.display = "block";
    progressBar.style.width = "0%";

    try{

        const qualityOption =
        document.querySelector('input[name="quality"]:checked').value;

        let imageQuality = 0.8;
        let scale = 1;

        if(qualityOption === "medium"){
            imageQuality = 0.7;
            scale = 0.8;
        }
        if(qualityOption === "low"){
            imageQuality = 0.5;
            scale = 0.6;
        }

        const arrayBuffer = await currentPDF.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const newPdf = await PDFLib.PDFDocument.create();

        for(let i=1;i<=pdf.numPages;i++){

            progressText.textContent = `Processing ${i}/${pdf.numPages}`;

            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport
            }).promise;

            const imgData =
            canvas.toDataURL("image/jpeg", imageQuality);

            const imgBytes =
            await fetch(imgData).then(res=>res.arrayBuffer());

            const jpgImage =
            await newPdf.embedJpg(imgBytes);

            const newPage =
            newPdf.addPage([canvas.width, canvas.height]);

            newPage.drawImage(jpgImage,{
                x:0,
                y:0,
                width:canvas.width,
                height:canvas.height
            });

            progressBar.style.width =
            Math.round((i/pdf.numPages)*100)+"%";
        }

        const compressedBytes = await newPdf.save();
        compressedPDF =
        new Blob([compressedBytes],{type:"application/pdf"});

        document.getElementById("originalSize")
        .textContent = formatSize(originalSize);

        document.getElementById("compressedSize")
        .textContent = formatSize(compressedPDF.size);

        document.getElementById("results")
        .style.display="block";

        progressText.textContent="Compression Complete!";

    }catch(err){
        console.error(err);
        alert("Compression failed: "+err.message);
        progressContainer.style.display="none";
    }
}

function downloadCompressed(){
    if(!compressedPDF) return;
    saveAs(compressedPDF,"compressed-"+currentPDF.name);
}

function clearFile(){
    currentPDF=null;
    compressedPDF=null;
    document.getElementById("fileInfo").innerHTML="";
    document.getElementById("results").style.display="none";
    document.getElementById("progressContainer").style.display="none";
}