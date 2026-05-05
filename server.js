const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const app = express();

// Use a persistent uploads folder
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));
app.use(express.json());

// --- HUFFMAN ENGINE ---
function buildHuffmanTree(data) {
    const freq = {};
    const text = data.toString('utf8');
    for (let char of text) freq[char] = (freq[char] || 0) + 1;
    
    let nodes = Object.keys(freq).map(char => ({ 
        char, 
        freq: freq[char], 
        left: null, 
        right: null 
    }));

    if (nodes.length === 0) return null;

    while (nodes.length > 1) {
        nodes.sort((a, b) => a.freq - b.freq);
        let left = nodes.shift();
        let right = nodes.shift();
        nodes.push({ char: null, freq: left.freq + right.freq, left, right });
    }
    return nodes[0];
}

function generateCodes(node, prefix = "", codes = {}) {
    if (!node) return codes;
    if (node.char !== null) {
        codes[node.char] = prefix;
    } else {
        generateCodes(node.left, prefix + "0", codes);
        generateCodes(node.right, prefix + "1", codes);
    }
    return codes;
}

// --- ROUTES ---

app.post('/compress', upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const rawData = fs.readFileSync(req.file.path);
        const textData = rawData.toString('utf8');
        
        const tree = buildHuffmanTree(rawData);
        if (!tree) throw new Error("Could not build tree - file may be empty.");

        const codes = generateCodes(tree);
        
        let compressedBinary = "";
        for (let char of textData) {
            compressedBinary += codes[char];
        }

        const fileName = `compressed_${Date.now()}.huff`;
        const filePath = path.join(uploadDir, fileName);
        
        // Write the binary string to a file
        fs.writeFileSync(filePath, compressedBinary);

        // Delete the original uploaded file to save space on Render
        fs.unlinkSync(req.file.path);

        res.json({
            message: "Compression Complete!",
            originalSize: rawData.length,
            compressedBits: compressedBinary.length,
            ratio: `${((1 - (compressedBinary.length / (rawData.length * 8))) * 100).toFixed(2)}%`,
            preview: compressedBinary.substring(0, 100),
            fileName: fileName,
            root: tree // This is the tree needed for the frontend decompressor
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/download', (req, res) => {
    const fileName = req.query.file;
    const filePath = path.join(uploadDir, fileName);
    
    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (!err) {
                // Optional: Delete the compressed file after download to keep server clean
                // fs.unlinkSync(filePath); 
            }
        });
    } else {
        res.status(404).send("File not found.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
