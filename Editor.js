const { PDFDocument, layoutMultilineText, StandardFonts } = require('pdf-lib');
fs = require('fs');
fontkit = require('@pdf-lib/fontkit')

async function mergePDF(pdfPagesList, currentFileName, fileList) {
    const mainPdf = await PDFDocument.load(fileList[0]);

    let pagesArray = await mainPdf.copyPages(mainPdf, mainPdf.getPageIndices())

    for (let j = 0; j < pdfPagesList[0].length; j++) {
        let [orderPage] = await mainPdf.copyPages(mainPdf, [pdfPagesList[0][j]]);
        mainPdf.addPage(orderPage);
    }
    for (let j = 0; j < pagesArray.length; j++) {
        mainPdf.removePage(0);

    }

    for (let i = 1; i < fileList.length; i++) {
        const mergePdf = await PDFDocument.load(fileList[i]);

        let pagesArray = await mainPdf.copyPages(mergePdf, mergePdf.getPageIndices())

        for (let j = 0; j < pdfPagesList[i].length; j++) {
            let [orderPage] = await mergePdf.copyPages(mergePdf, [pdfPagesList[i][j]]);
            mergePdf.addPage(orderPage);
        }
        for (let j = 0; j < pagesArray.length; j++) {
            mergePdf.removePage(0);

        }

        pagesArray = await mainPdf.copyPages(mergePdf, mergePdf.getPageIndices())
        for (const page of pagesArray) {
            mainPdf.addPage(page);
        }

    }
    return await mainPdf.saveAsBase64({ dataUri: true });
}

async function reorderPDFpage(mainFile, fileName, arr) {

    const mainPdf = await PDFDocument.load(mainFile);

    let pagesArray = await mainPdf.copyPages(mainPdf, mainPdf.getPageIndices());

    for (let i = 0; i < arr.length; i++) {
        let [orderPage] = await mainPdf.copyPages(mainPdf, [arr[i]]);
        mainPdf.addPage(orderPage);
    }
    for (let i = 0; i < pagesArray.length; i++) {
        mainPdf.removePage(0);

    }
    return await mainPdf.saveAsBase64({ dataUri: true });

}

async function fillForm(textAreaList, file, base64Canvas, screenSize) {
    const mainPdf = await PDFDocument.load(file);
    mainPdf.registerFontkit(fontkit);
    const fonts = ['Arial', 'Brush_Script_MT', 'Courier_New', 'Comic_Sans_MS', 'Garamond', 'Georgia',
        'Tahoma', 'Trebuchet_MS', 'Times_New_Roman', 'Verdana'];
    const fontMap = new Map();
    await Promise.all(fonts.map(async (val) => {
        const fontBytes = fs.readFileSync(`./fonts/${val}.ttf`, null);
        const font = await mainPdf.embedFont(fontBytes);
        const fontName = val.replace(/_/g, ' ');
        fontMap.set(fontName, font)
    }))
    for (let i = 0; i < textAreaList.length; i++) {
        textAreaList[i].forEach(async textArea => {
            const page = mainPdf.getPage(i);

            const widthValue = Number(textArea.width.substring(0, textArea.width.indexOf("p")))
            const heightValue = Number(textArea.height.substring(0, textArea.height.indexOf("p")))

            const rate = page.getHeight() / screenSize
            if (textArea.type === 'S') {
                const multiText = layoutMultilineText(textArea.content, {
                    font: fontMap.get(textArea.font),
                    fontSize: textArea.fontSize,
                    bounds: { x: textArea.x * rate, y: (screenSize - textArea.y - heightValue) * rate, width: widthValue, height: heightValue },
                })
                multiText.lines.forEach(line => {
                    page.drawText(line.text, {
                        x: line.x,
                        y: line.y,
                        font: fontMap.get(textArea.font),
                        size: textArea.fontSize,
                    },
                    )
                });
            }
            else if (textArea.type === 'F') {
                const form = mainPdf.getForm();
                const fillableField = form.createTextField(`textArea.Field${i}${textArea.ID}`);
                fillableField.setText(textArea.content);
                fillableField.addToPage(page, {
                    x: textArea.x * rate,
                    y: (screenSize - textArea.y - heightValue) * rate,
                    font:fontMap.get(textArea.font),
                    width: widthValue,
                    height: heightValue,
                })
                fillableField.updateAppearances(fontMap.get(textArea.font));
            }
        });
    }
    const temp = await mainPdf.saveAsBase64({ dataUri: true });
    return await addCanvasToPDF(temp, base64Canvas);

}

async function addCanvasToPDF(file, base64Canvas) {
    const mainPdf = await PDFDocument.load(file);
    const numPages = mainPdf.getPageCount();
    for (let i = 0; i < numPages; i++) {
        if (!base64Canvas[i]) { continue; }
        const canvas = await mainPdf.embedPng(base64Canvas[i]);
        const firstPage = mainPdf.getPage(i);
        firstPage.drawImage(canvas, {
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height,
        })
    }
    return await mainPdf.saveAsBase64({ dataUri: true });
}
async function pdfSplit(mainFile, splitPages, rangeNumber) {
    const mainPdf = await PDFDocument.load(mainFile);

    let pagesArray = await mainPdf.copyPages(mainPdf, mainPdf.getPageIndices());
    var len;
    var index = 0;
    if (rangeNumber > 0) {
        len = pagesArray.length / rangeNumber;
        index = pagesArray.length
    }
    else {
        len = splitPages.length;
    }

    var array = [];
    var count = 0;
    var flag = 0;
    if (rangeNumber > 0)
        for (let i = 0; i < len; i++) {
            const pdfDoc = await PDFDocument.create();

            if (index > 0) {
                for (let j = 0; j < rangeNumber && j < index - count; j++) {
                    let [orderPage] = await pdfDoc.copyPages(mainPdf, [count + j]);
                    const page = pdfDoc.addPage(orderPage);
                }
                count = count + rangeNumber;
                array[i] = await pdfDoc.saveAsBase64();
            }
            flag++;
        }
    if (flag == 0) {
        const pdfDoc = await PDFDocument.create();
        for (let j = 0; j < len; j++) {
            let [orderPage] = await pdfDoc.copyPages(mainPdf, [splitPages[j]]);
            const page = pdfDoc.addPage(orderPage);
        }
        for (let j = 0; j < len; j++) {
            mainPdf.removePage(splitPages[0]);
        }
        array[0] = await mainPdf.saveAsBase64();
        array[1] = await pdfDoc.saveAsBase64();

    }
    return array;

}
module.exports.reorderPDFpage = reorderPDFpage;
module.exports.mergePDF = mergePDF;
module.exports.fillForm = fillForm;
module.exports.addCanvasToPDF = addCanvasToPDF;
module.exports.fillForm = fillForm;
module.exports.pdfSplit = pdfSplit;

