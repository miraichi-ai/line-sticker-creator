const fs = require('fs');
function readChunks(buffer) {
    let offset = 8;
    while(offset < buffer.length) {
        let len = buffer.readUInt32BE(offset);
        let type = buffer.toString('ascii', offset+4, offset+8);
        console.log(`Chunk: ${type}, length: ${len}`);
        if(type === 'acTL') {
            console.log(`  num_frames: ${buffer.readUInt32BE(offset+8)}, num_plays: ${buffer.readUInt32BE(offset+12)}`);
        }
        if(type === 'fcTL') {
            console.log(`  seq: ${buffer.readUInt32BE(offset+8)}`);
            console.log(`  delay_num: ${buffer.readUInt16BE(offset+28)}, delay_den: ${buffer.readUInt16BE(offset+30)}`);
        }
        offset += len + 12;
    }
}
