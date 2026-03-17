import { google } from "googleapis";
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

export default async function handler(req, res) {
  try {
    // temp folder for this execution
    const TEMP_DIR = "/tmp";
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

    // parse service account JSON from env
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_JSON);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    const drive = google.drive({ version: "v3", auth });

    const INPUT_FOLDER_ID = process.env.DRIVE_INPUT_FOLDER_ID;
    const PROCESSED_FOLDER_ID = process.env.DRIVE_PROCESSED_FOLDER_ID;

    // list files
    const listRes = await drive.files.list({
      q: `'${INPUT_FOLDER_ID}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: "files(id, name)",
    });

    const files = listRes.data.files || [];

    for (const file of files) {
      const localPath = path.join(TEMP_DIR, file.name);

      // download file
      const fileRes = await drive.files.get(
        { fileId: file.id, alt: "media" },
        { responseType: "arraybuffer" }
      );
      fs.writeFileSync(localPath, fileRes.data);

      // call your PDF processing API (if it's a separate function)
      const formData = new FormData();
      formData.append("file", fs.createReadStream(localPath));
      const processedRes = await axios.post(process.env.PDF_PROCESSOR_API, formData, {
        headers: formData.getHeaders(),
        responseType: "arraybuffer",
      });

      const processedPath = localPath.replace(".pdf", "_secured.pdf");
      fs.writeFileSync(processedPath, processedRes.data);

      // upload processed file
      await drive.files.create({
        resource: { name: path.basename(processedPath), parents: [PROCESSED_FOLDER_ID] },
        media: { mimeType: "application/pdf", body: fs.createReadStream(processedPath) },
        fields: "id",
      });

      // delete original input file
      await drive.files.delete({ fileId: file.id });

      // cleanup
      fs.unlinkSync(localPath);
      fs.unlinkSync(processedPath);
    }

    res.status(200).json({ success: true, processed: files.length });
  } catch (err) {
    console.error("❌ Function error:", err);
    res.status(500).json({ error: err.message });
  }
}