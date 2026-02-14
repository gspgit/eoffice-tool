self.importScripts(
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js",
  "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"
);

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

self.onmessage = async function (e) {

  const { fileBuffer, quality } = e.data;

  let imageQuality = 0.8;
  let scale = 1;

  if (quality === "medium") {
    imageQuality = 0.7;
    scale = 0.8;
  }
  if (quality === "low") {
    imageQuality = 0.5;
    scale = 0.6;
  }

  const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
  const newPdf = await PDFLib.PDFDocument.create();

  for (let i = 1; i <= pdf.numPages; i++) {

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    await page.render({
      canvasContext: context,
      viewport
    }).promise;

    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: imageQuality
    });

    const imgBytes = await blob.arrayBuffer();
    const jpgImage = await newPdf.embedJpg(imgBytes);

    const newPage = newPdf.addPage([viewport.width, viewport.height]);
    newPage.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height
    });

    self.postMessage({ progress: (i / pdf.numPages) * 100 });
  }

  const compressedBytes = await newPdf.save();

  self.postMessage({
    done: true,
    compressedBytes
  });
};