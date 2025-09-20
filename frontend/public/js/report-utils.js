// FILE: frontend/public/js/report-utils.js

/**
 * A reusable function to export a given HTML element to a PDF document.
 * It handles the 'oklch' color issue with DaisyUI and html2canvas.
 *
 * @param {object} options - The configuration for the PDF export.
 * @param {string} options.reportElementId - The ID of the HTML element to be exported.
 * @param {string} options.fileName - The desired name for the output PDF file.
 * @param {HTMLElement} options.buttonElement - The button that triggered the export, to manage its loading state.
 * @param {'portrait'|'landscape'} [options.orientation='landscape'] - The orientation of the PDF.
 * @param {string} [options.format='legal'] - The format of the PDF page (e.g., 'a4', 'letter', 'legal').
 */
export async function exportToPDF(options) {
    const {
        reportElementId,
        fileName,
        buttonElement,
        orientation = 'landscape',
        format = 'legal'
    } = options;

    const { jsPDF } = window.jspdf;
    const reportElement = document.getElementById(reportElementId);

    if (!reportElement) {
        console.error(`Export failed: Element with ID "${reportElementId}" not found.`);
        alert(`Export failed: Report element not found.`);
        return;
    }

    // Show a temporary loading message
    const originalButtonContent = buttonElement.innerHTML;
    buttonElement.disabled = true;
    buttonElement.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Exporting...`;
    lucide.createIcons();

    try {
        const margin = 15; // 15mm margin on each side
        const pdf = new jsPDF({ orientation, unit: 'mm', format });
        const pagesToProcess = reportElement.querySelectorAll('.printable-page');
        const elements = pagesToProcess.length > 0 ? Array.from(pagesToProcess) : [reportElement];

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                onclone: (clonedDoc) => {
                    const style = clonedDoc.createElement('style');
                    style.textContent = `
                        :root {
                            --fallback-p: #491eff; --fallback-pc: #d4dbff; --fallback-s: #ff41c7; --fallback-sc: #fff9fc;
                            --fallback-a: #00cfbd; --fallback-ac: #00100d; --fallback-n: #2b3440; --fallback-nc: #d7dde4;
                            --fallback-b1: #ffffff; --fallback-b2: #e5e6e6; --fallback-b3: #e5e6e6; --fallback-bc: #1f2937;
                            --fallback-in: #00b3f0; --fallback-inc: #000000; --fallback-su: #00ca92; --fallback-suc: #000000;
                            --fallback-wa: #ffc22d; --fallback-wac: #000000; --fallback-er: #ff6f70; --fallback-erc: #000000;
                        }
                    `;
                    clonedDoc.head.appendChild(style);
                    for (const sheet of Array.from(clonedDoc.styleSheets)) {
                        try {
                            if (sheet.cssRules) {
                                for (const rule of Array.from(sheet.cssRules)) {
                                    if (rule.style && rule.style.cssText.includes('oklch')) {
                                        rule.style.cssText = rule.style.cssText.replace(/oklch/g, 'ignore');
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn("Could not process stylesheet for PDF export:", e.message);
                        }
                    }
                }
            });

            const imgData = canvas.toDataURL('image/png');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // Calculate available width and height inside margins
            const contentWidth = pdfWidth - (margin * 2);
            const contentHeight = pdfHeight - (margin * 2);

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const canvasRatio = canvasHeight / canvasWidth;

            let imgWidth = contentWidth;
            let imgHeight = imgWidth * canvasRatio;

            // If the image height exceeds the content area, scale it down.
            if (imgHeight > contentHeight) {
                imgHeight = contentHeight;
                imgWidth = imgHeight / canvasRatio;
            }

            if (i > 0) {
                pdf.addPage();
            }
            // Center the image within the content area
            const x = margin + (contentWidth - imgWidth) / 2;
            const y = margin + (contentHeight - imgHeight) / 2;
            pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
        }

        pdf.save(fileName);

    } catch (err) {
        console.error("Error exporting to PDF:", err);
        alert("An error occurred while exporting to PDF.");
    } finally {
        buttonElement.disabled = false;
        buttonElement.innerHTML = originalButtonContent;
        lucide.createIcons();
    }
}

/**
 * Toggles a print-preview mode on the page.
 * @param {object} options - The configuration for the preview mode.
 * @param {'portrait'|'landscape'} options.orientation - The orientation for sizing the preview area.
 * @param {string} options.exitButtonId - The ID of the button used to exit preview mode.
 */
export function togglePreviewMode(options) {
    const { orientation, exitButtonId, reportElementId } = options;
    const exitButton = document.getElementById(exitButtonId);
    const isPreviewing = document.body.classList.contains('print-preview-mode');

    // Use a closure to store the original position of the previewed element
    if (!window.gsoPreviewState) {
        window.gsoPreviewState = {
            originalParent: null,
            originalNextSibling: null,
            previewedElement: null,
        };
    }

    if (isPreviewing) {
        // Exit preview mode
        document.body.classList.remove('print-preview-mode', 'preview-portrait', 'preview-landscape');
        if (exitButton) exitButton.classList.add('hidden');

        // Move the element back to its original position
        const { previewedElement, originalParent, originalNextSibling } = window.gsoPreviewState;
        if (previewedElement && originalParent) {
            originalParent.insertBefore(previewedElement, originalNextSibling);
        }
        
        // Reset state
        window.gsoPreviewState = {};

    } else {
        // Enter preview mode
        const elementToPreview = document.getElementById(reportElementId);
        if (!elementToPreview) {
            console.error(`Preview failed: element with ID "${reportElementId}" not found.`);
            return;
        }

        // Save original position and the element itself
        window.gsoPreviewState.originalParent = elementToPreview.parentElement;
        window.gsoPreviewState.originalNextSibling = elementToPreview.nextSibling;
        window.gsoPreviewState.previewedElement = elementToPreview;

        // Move element to be a direct child of the body to escape clipping contexts
        document.body.appendChild(elementToPreview);

        document.body.classList.add('print-preview-mode', `preview-${orientation}`);
        if (exitButton) exitButton.classList.remove('hidden');
    }
}