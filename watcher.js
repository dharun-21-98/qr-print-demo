const chokidar = require("chokidar");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const INPUT_DIR = "C:\\Users\\DB-L-098\\qr-print-input";
const PROCESSED_DIR = "C:\\Users\\DB-L-098\\qr-print-processed";

// Make sure the processed folder exists
if (!fs.existsSync(PROCESSED_DIR)) {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

console.log("Watching folder:", INPUT_DIR);

chokidar.watch(INPUT_DIR, { ignoreInitial: true }).on("add", async (filePath) => {
  // Only process PDF files
  if (!filePath.endsWith(".pdf")) return;

  console.log("New file detected:", filePath);

  try {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));

    // Send file to your API
    const response = await axios.post(
      "https://qr-print-demo.vercel.app/",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        responseType: "arraybuffer",
      }
    );

    // Save processed file in the PROCESSED_DIR
    const outputFileName = path.basename(filePath).replace(".pdf", "_secured.pdf");
    const outputPath = path.join(PROCESSED_DIR, outputFileName);

    fs.writeFileSync(outputPath, response.data);

    console.log("✅ Processed file saved:", outputPath);

  } catch (err) {
    console.error("❌ FULL ERROR:", err);

    if (err.response) {
      console.error("📦 Response data:", err.response.data?.toString());
      console.error("📊 Status:", err.response.status);
    } else if (err.request) {
      console.error("📡 No response received");
    } else {
      console.error("⚠️ Error message:", err.message);
    }
  }
});