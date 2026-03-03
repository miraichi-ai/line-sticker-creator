const fs = require('fs');
const UPNG = require('./node_modules/upng-js/UPNG.js');

function crc32(data) {
    let crc = 0xFFFFFFFF;
    const table = getCRC32Table();
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

let _crc32Table = null;
function getCRC32Table() {
    if (_crc32Table) return _crc32Table;
    _crc32Table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        _crc32Table[n] = c;
    }
    return _crc32Table;
}

function patchAPNGMetadata(apngBuffer, options) {
    const data = new Uint8Array(apngBuffer);
    const dv = new DataView(data.buffer);
    let offset = 8;
    while (offset < data.length - 8) {
        const chunkLength = dv.getUint32(offset);
        const chunkType = String.fromCharCode(
            data[offset + 4], data[offset + 5],
            data[offset + 6], data[offset + 7]
        );
        if (chunkType === 'acTL') {
            dv.setUint32(offset + 12, options.loopCount);
            const crcData = data.slice(offset + 4, offset + 8 + chunkLength);
            dv.setUint32(offset + 8 + chunkLength, crc32(crcData));
        } else if (chunkType === 'fcTL') {
            dv.setUint16(offset + 28, options.duration);
            dv.setUint16(offset + 30, options.frameCount);
            const crcData = data.slice(offset + 4, offset + 8 + chunkLength);
            dv.setUint32(offset + 8 + chunkLength, crc32(crcData));
        }
        offset += 12 + chunkLength;
    }
    return data.buffer;
}

const w = 240, h = 240;
const frames = Array(14).fill(new Uint8Array(w * h * 4).buffer);
const delays = Array(14).fill(214);

const apngData = UPNG.encode(frames, w, h, 0, delays);
fs.writeFileSync('test1.png', Buffer.from(apngData));

const modifiedData = patchAPNGMetadata(apngData.slice(0), {
    loopCount: 2,
    duration: 2,
    frameCount: 14
});
fs.writeFileSync('test2.png', Buffer.from(modifiedData));

function readChunks(filePath) {
    const buffer = fs.readFileSync(filePath);
    let offset = 8;
    console.log(`--- ${filePath} ---`);
    while (offset < buffer.length) {
        let len = buffer.readUInt32BE(offset);
        let type = buffer.toString('ascii', offset + 4, offset + 8);
        console.log(`Chunk: ${type}, length: ${len}`);
        if (type === 'acTL') {
            console.log(`  num_frames: ${buffer.readUInt32BE(offset + 8)}, num_plays: ${buffer.readUInt32BE(offset + 12)}`);
        }
        if (type === 'fcTL') {
            console.log(`  seq: ${buffer.readUInt32BE(offset + 8)}`);
            console.log(`  delay_num: ${buffer.readUInt16BE(offset + 28)}, delay_den: ${buffer.readUInt16BE(offset + 30)}`);
        }
        offset += len + 12;
    }
}

readChunks('test1.png');
readChunks('test2.png');
