// api/drive-watcher.js

import { google } from "googleapis";
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

export default async function handler(req, res) {
  try {
    // ----------------------
    // TEMP DIR FOR THIS EXECUTION
    // ----------------------
    const TEMP_DIR = "/tmp"; // Vercel serverless temp dir
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

    // ----------------------
    // ENV VARIABLES CHECK
    // ----------------------
    if (!process.env.GOOGLE_SERVICE_JSON)
      throw new Error("GOOGLE_SERVICE_JSON not set");
    if (!process.env.DRIVE_INPUT_FOLDER_ID)
      throw new Error("DRIVE_INPUT_FOLDER_ID not set");
    if (!process.env.DRIVE_PROCESSED_FOLDER_ID)
      throw new Error("DRIVE_PROCESSED_FOLDER_ID not set");
    if (!process.env.PDF_PROCESSOR_API)
      throw new Error("PDF_PROCESSOR_API not set");

    const INPUT_FOLDER_ID = process.env.DRIVE_INPUT_FOLDER_ID;
    const PROCESSED_FOLDER_ID = process.env.DRIVE_PROCESSED_FOLDER_ID;
    const PDF_PROCESSOR_API = process.env.PDF_PROCESSOR_API;

    // ----------------------
    // AUTHENTICATION
    // ----------------------
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_JSON);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    const drive = google.drive({ version: "v3", auth });

    // ----------------------
    // LIST PDF FILES
    // ----------------------
    const listRes = await drive.files.list({
      q: `'${INPUT_FOLDER_ID}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: "files(id, name)",
    });

    const files = listRes.data.files || [];

    if (files.length === 0) {
      console.log("No PDFs found in input folder.");
      return res.status(200).json({ success: true, message: "No PDFs found." });
    }

    // ----------------------
    // PROCESS FILES
    // ----------------------
    for (const file of files) {
      try {
        console.log("Processing:", file.name);

        // 1️⃣ Download file locally
        const localPath = path.join(TEMP_DIR, file.name);
        const fileRes = await drive.files.get(
          { fileId: file.id, alt: "media" },
          { responseType: "arraybuffer" }
        );
        fs.writeFileSync(localPath, Buffer.from(fileRes.data)); // ✅ FIXED

        // 2️⃣ Send to PDF processing API
        const formData = new FormData();
        formData.append("file", fs.createReadStream(localPath));

        const processedRes = await axios.post(PDF_PROCESSOR_API, formData, {
          headers: formData.getHeaders(),
          responseType: "arraybuffer",
        });

        const processedPath = localPath.replace(".pdf", "_secured.pdf");
        fs.writeFileSync(processedPath, Buffer.from(processedRes.data)); // ✅ FIXED

        // 3️⃣ Upload processed PDF to Drive
        await drive.files.create({
          resource: { name: path.basename(processedPath), parents: [PROCESSED_FOLDER_ID] },
          media: { mimeType: "application/pdf", body: fs.createReadStream(processedPath) },
          fields: "id",
        });

        // 4️⃣ Delete original PDF from input folder
        await drive.files.delete({ fileId: file.id });

        // 5️⃣ Cleanup temp files
        fs.unlinkSync(localPath);
        fs.unlinkSync(processedPath);

        console.log("✅ Successfully processed:", file.name);
      } catch (fileErr) {
        console.error("❌ Error processing file:", file.name, fileErr.message);
      }
    }

    res.status(200).json({ success: true, processed: files.length });
  } catch (err) {
    console.error("❌ Drive watcher error:", err);
    res.status(500).json({ error: err.message });
  }
}