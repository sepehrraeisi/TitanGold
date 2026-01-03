import fs from 'fs';

const file = 'routes/ai-agents.js';
const content = fs.readFileSync(file, 'utf8');

// Find old handler start and end
const startMarker = "router.post('/:id/run-OLD";
const endMarker = "// Get manager overview";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find markers');
  process.exit(1);
}

// Extract old handler
const before = content.substring(0, startIdx);
const oldHandler = content.substring(startIdx, endIdx);
const after = content.substring(endIdx);

// Comment out old handler (add /* */ around it)
const newContent = before + '/*\n' + oldHandler + '\n*/\n\n' + after;

fs.writeFileSync(file, newContent, 'utf8');
console.log('✅ Old handler commented out successfully');
