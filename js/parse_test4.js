const fs = require('fs');
const UPNG = require('./node_modules/upng-js/UPNG.js');

const w = 240, h = 240;
const frames = Array(14).fill(new Uint8Array(w*h*4).buffer);
const delays = [215,215,215,215,214,214,214,214,214,214,214,214,214,214]; // sum = 3000

const apngData = UPNG.encode(frames, w, h, 0, delays);
fs.writeFileSync('test3.png', Buffer.from(apngData));

function readDelays(filePath) {
    const buffer = fs.readFileSync(filePath);
    let offset = 8;
    console.log(`--- ${filePath} ---`);
    let totalDelayNum = 0;
    while(offset < buffer.length - 8) {
        let len = buffer.readUInt32BE(offset);
        let type = buffer.toString('ascii', offset+4, offset+8);
        if(type === 'fcTL') {
            const num = buffer.readUInt16BE(offset+28);
            const den = buffer.readUInt16BE(offset+30);
            console.log(`Frame delay: ${num}/${den}`);
            totalDelayNum += num / den;
        }
        offset += len + 12;
    }
    console.log(`Total duration: ${totalDelayNum} seconds`);
}

readDelays('test3.png');
