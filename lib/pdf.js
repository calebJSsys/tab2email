/*
 * TabMail — PDF Generator
 *
 * Converts a chord sheet into a clean, printable PDF using PDFKit.
 * No browser/Chromium dependency — runs on minimal memory.
 *
 * Layout: US Letter, 0.75" margins, monospace font for chord alignment,
 * section headers and chords highlighted in blue.
 */

const PDFDocument = require('pdfkit');

async function generatePDF(chordSheet) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 54, bottom: 54, left: 54, right: 54 },
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(20).font('Helvetica-Bold')
        .text(chordSheet.title || 'Unknown Song', { align: 'left' });

      // Artist
      doc.fontSize(14).font('Helvetica')
        .text(chordSheet.artist || 'Unknown Artist', { align: 'left' });

      // Metadata (key, capo, tuning — only if non-default)
      const meta = [];
      if (chordSheet.key) meta.push(`Key: ${chordSheet.key}`);
      if (chordSheet.capo && chordSheet.capo !== 'none') meta.push(`Capo: ${chordSheet.capo}`);
      if (chordSheet.tuning && chordSheet.tuning !== 'Standard') meta.push(`Tuning: ${chordSheet.tuning}`);
      if (meta.length > 0) {
        doc.fontSize(10).font('Helvetica-Oblique')
          .text(meta.join('  |  '), { align: 'left' });
      }

      // Separator line
      doc.moveDown(0.5);
      doc.moveTo(54, doc.y)
        .lineTo(doc.page.width - 54, doc.y)
        .strokeColor('#cccccc')
        .stroke();
      doc.moveDown(0.5);

      // Chord sheet content — line by line, monospace
      const lines = (chordSheet.content || '').split('\n');
      const pageBottom = doc.page.height - 72;

      for (const line of lines) {
        if (doc.y > pageBottom) {
          doc.addPage();
        }

        const trimmed = line.trim();

        // Section headers: [Verse 1], [Chorus], [Intro], etc.
        if (/^\[.*\]$/.test(trimmed)) {
          doc.moveDown(0.3);
          doc.fontSize(11).font('Helvetica-Bold')
            .fillColor('#2563eb')
            .text(trimmed, { continued: false });
          doc.fillColor('#000000');
        }
        // Chord lines — highlighted in blue
        else if (isChordLine(trimmed)) {
          doc.fontSize(10).font('Courier-Bold')
            .fillColor('#2563eb')
            .text(line, { continued: false });
          doc.fillColor('#000000');
        }
        // Empty lines
        else if (trimmed === '') {
          doc.moveDown(0.3);
        }
        // Regular lyrics/text
        else {
          doc.fontSize(10).font('Courier')
            .fillColor('#000000')
            .text(line, { continued: false });
        }
      }

      // Footer
      const footerY = doc.page.height - 40;
      doc.fontSize(8).font('Helvetica').fillColor('#999999')
        .text('Sent via TabMail — non-commercial, personal use', 54, footerY, {
          align: 'center',
          width: doc.page.width - 108,
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Heuristic: is this line mostly chord names?
function isChordLine(line) {
  if (!line || line.length === 0) return false;
  const tokens = line.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return false;
  const chordPattern = /^[A-G][#b]?(m|maj|min|dim|aug|sus|add|2|4|5|6|7|9|11|13|\/[A-G][#b]?)*$/;
  const chordCount = tokens.filter(t => chordPattern.test(t)).length;
  return chordCount / tokens.length >= 0.5;
}

module.exports = { generatePDF };
