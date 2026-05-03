const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path'); // NEW: Helps handle file paths
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

// --- HUFFMAN ENGINE ---
function buildHuffmanTree(data) {
    const freq = {};
    for (let byte of data) freq[byte] = (freq[byte] || 0) + 1;
    let nodes = Object.keys(freq).map(byte => ({ byte, freq: freq[byte], left: null, right: null }));
    while (nodes.length > 1) {
        nodes.sort((a, b) => a.freq - b.freq);
        let left = nodes.shift();
        let right = nodes.shift();
        nodes.push({ byte: null, freq: left.freq + right.freq, left, right });
    }
    return nodes[0];
}

function generateCodes(node, prefix = "", codes = {}) {
    if (node.byte !== null) {
        codes[node.byte] = prefix;
    } else {
        generateCodes(node.left, prefix + "0", codes);
        generateCodes(node.right, prefix + "1", codes);
    }
    return codes;
}

// --- ROUTES ---

app.post('/compress', upload.single('file'), (req, res) => {
    const rawData = fs.readFileSync(req.file.path);
    const tree = buildHuffmanTree(rawData);
    const codes = generateCodes(tree);
    
    let compressedBinary = "";
    for (let byte of rawData) compressedBinary += codes[byte];

    // --- NEW: SAVE THE COMPRESSED DATA TO A FILE ---
    // We create a unique name using the current timestamp
    const fileName = `compressed_${Date.now()}.huff`;
    const filePath = path.join(__dirname, 'uploads', fileName);
    
    fs.writeFileSync(filePath, compressedBinary);

    res.send({
        message: "Compression Complete!",
        originalSize: `${rawData.length} bytes`,
        compressedBits: `${compressedBinary.length} bits`,
        ratio: `${((1 - (compressedBinary.length / (rawData.length * 8))) * 100).toFixed(2)}%`,
        preview: compressedBinary.substring(0, 100),
        fileName: fileName // NEW: We send the name back so the UI knows what to download
    });
});

// --- NEW: DOWNLOAD ROUTE ---
// This allows the browser to request the file we just created
app.get('/download', (req, res) => {
    const fileName = req.query.file;
    const filePath = path.join(__dirname, 'uploads', fileName);
    
    // Check if file exists before trying to send it
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send("File not found.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));