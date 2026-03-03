const fs = require('fs');

function readChunks(filePath) {
    const buffer = fs.readFileSync(filePath);
    let offset = 8;
    console.log(`--- ${filePath} ---`);
    let totalDelayNum = 0;
    while(offset < buffer.length - 8) {
        let len = buffer.readUInt32BE(offset);
        let type = buffer.toString('ascii', offset+4, offset+8);
        if(type === 'fcTL') {
            totalDelayNum += buffer.readUInt16BE(offset+28) / buffer.readUInt16BE(offset+30);
        }
        offset += len + 12;
    }
    console.log(`Total duration: ${totalDelayNum} seconds`);
}

readChunks('test1.png');
readChunks('test2.png');
