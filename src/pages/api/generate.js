import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import { IncomingForm } from "formidable";
import { addLog } from "../../lib/auditstore";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

// Utility: Generate random ID
const generateId = (prefix) => {
  return prefix + "_" + Math.floor(Math.random() * 1000000);
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = new IncomingForm();

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        console.error("Form parse error:", err);
        return res.status(500).json({ error: "File upload error" });
      }

      console.log("FILES RECEIVED:", files);

      // Handle file (supports both array & object formats)
      const uploadedFile = Array.isArray(files.file)
        ? files.file[0]
        : files.file;

      if (!uploadedFile) {
        throw new Error("No file uploaded");
      }

      const filePath = uploadedFile.filepath;
      console.log("File path:", filePath);

      const fileBuffer = fs.readFileSync(filePath);

      // 🕒 IST Timestamp
      const timestamp = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      });

      // 🔥 Dynamic QR JSON
      const qrData = {
        document_id: generateId("DOC"),
        user_id: "USR_" + Math.floor(Math.random() * 100000),
        print_id: generateId("PRT"),
        timestamp_ist: timestamp,
      };

      const qrJson = JSON.stringify(qrData);

      console.log("QR DATA:", qrJson);
      addLog(qrData);

      // Generate QR as base64
      const qrImage = await QRCode.toDataURL(qrJson, {
        color: {
        dark: "#555555",   // lighter than black
        light: "#FFFFFF00" // transparent background
        }
     });

      // Load PDF
      const pdfDoc = await PDFDocument.load(fileBuffer);
      const pages = pdfDoc.getPages();

      const pngImage = await pdfDoc.embedPng(qrImage);

      // Add QR to all pages (top-right)
      pages.forEach((page) => {
        const { width, height } = page.getSize();

        page.drawImage(pngImage, {
          x: width - 90,
          y: height - 90,
          width: 60,
          height: 60,
        });
      });

      const pdfBytes = await pdfDoc.save();

      // ✅ Proper response headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=secure_print.pdf");

      return res.status(200).send(Buffer.from(pdfBytes));

    } catch (error) {
      console.error("ERROR:", error);
      return res.status(500).json({
        error: "Failed to process PDF",
        details: error.message,
      });
    }
  });
}