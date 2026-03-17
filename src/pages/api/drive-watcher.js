// api/drive-watcher.js
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

export default async function handler(req, res) {
  try {
    // ----------------------
    // TEMP DIR FOR SERVERLESS
    // ----------------------
    const TEMP_DIR = "/tmp"; // Vercel serverless temp dir
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

    // ----------------------
    // ENV VARIABLES CHECK
    // ----------------------
    const requiredEnvs = [
      "GOOGLE_SERVICE_JSON",
      "DRIVE_INPUT_FOLDER_ID",
      "DRIVE_PROCESSED_FOLDER_ID",
      "PDF_PROCESSOR_API",
    ];
    for (const key of requiredEnvs) {
      if (!process.env[key]) throw new Error(`${key} not set`);
    }

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
    async function listFiles() {
      const listRes = await drive.files.list({
        q: `'${INPUT_FOLDER_ID}' in parents and trashed=false and name contains '.pdf'`,
        fields: "files(id, name)",
      });
      return listRes.data.files || [];
    }

    const files = await listFiles();

    if (files.length === 0) {
      console.log("No PDFs found in input folder.");
      return res.status(200).json({ success: true, message: "No PDFs found." });
    }

    const processedFiles = [];

    // ----------------------
    // PROCESS FILES
    // ----------------------
    for (const file of files) {
      try {
        console.log("📄 Found PDF:", file.name);

        // 1️⃣ Download locally
        const localPath = path.join(TEMP_DIR, file.name);
        const fileRes = await drive.files.get(
          { fileId: file.id, alt: "media" },
          { responseType: "arraybuffer" }
        );
        fs.writeFileSync(localPath, Buffer.from(fileRes.data));
        console.log("✅ Downloaded to temp:", localPath, "Size:", fs.statSync(localPath).size);

        // 2️⃣ Send to PDF processing API
        const formData = new FormData();
        formData.append("file", fs.createReadStream(localPath));

        const processedRes = await axios.post(PDF_PROCESSOR_API, formData, {
          headers: formData.getHeaders(),
          responseType: "arraybuffer",
        });

        const processedPath = localPath.replace(".pdf", "_secured.pdf");
        fs.writeFileSync(processedPath, Buffer.from(processedRes.data));
        console.log("✅ Processed PDF saved locally:", processedPath, "Size:", fs.statSync(processedPath).size);

        if (fs.statSync(processedPath).size === 0) {
          console.warn("⚠️ Processed PDF is empty:", processedPath);
          continue; // skip upload
        }

        // 3️⃣ Upload processed PDF to Drive
        const uploadRes = await drive.files.create({
          resource: { name: path.basename(processedPath), parents: [PROCESSED_FOLDER_ID] },
          media: { mimeType: "application/pdf", body: fs.createReadStream(processedPath) },
          fields: "id",
        });
        console.log("📤 Uploaded to Drive with ID:", uploadRes.data.id);

        processedFiles.push(file.name);

        // 4️⃣ Delete original input PDF
        await drive.files.delete({ fileId: file.id });
        console.log("🗑 Deleted original input PDF:", file.name);

        // 5️⃣ Cleanup temp files
        fs.unlinkSync(localPath);
        fs.unlinkSync(processedPath);
      } catch (fileErr) {
        console.error("❌ Error processing file:", file.name, fileErr);
      }
    }

    res.status(200).json({ success: true, processed: processedFiles });
  } catch (err) {
    console.error("❌ Drive watcher error:", err);
    res.status(500).json({ error: err.message });
  }
}