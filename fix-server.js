const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server.js');
let src = fs.readFileSync(filePath, 'utf8');

// Find the exact text to replace
const oldText = [
  '    const seen = new Set();',
  '    /* 1. Keep only integer, in-range indices; first occurrence wins. */',
  '    for (const unit of pack.units){',
  '      if (!unit) continue;',
  '      if (typeof unit.learningGoals === \'string\') unit.learningGoals = [unit.learningGoals];',
  '      const topics = Array.isArray(unit.topics) ? unit.topics.filter(Boolean) : [];',
  '      unit.topics = topics;',
  '      for (const topic of topics){',
  '        const raw = Array.isArray(topic.conceptIndices) ? topic.conceptIndices',
  '          : (Number.isInteger(topic.conceptIndices) ? [topic.conceptIndices] : []);',
  '        const keep = [];',
  '        for (const i of raw){',
  '          if (Number.isInteger(i) && i >= 0 && i < n && !seen.has(i)) { seen.add(i); keep.push(i); }',
  '        }',
  '        keep.sort((a, b) => a - b);',
  '        topic.conceptIndices = keep;',
  '      }',
  '    }'
].join('\n');

const newText = [
  '    const seen = new Set();',
  '    /* Track which topic first saw each concept, so duplicates can be',
  '       removed from the original topic too. */',
  '    const seenTopic = new Map();',
  '    /* 1. Keep only integer, in-range indices; first occurrence wins. */',
  '    for (const unit of pack.units){',
  '      if (!unit) continue;',
  '      if (typeof unit.learningGoals === \'string\') unit.learningGoals = [unit.learningGoals];',
  '      const topics = Array.isArray(unit.topics) ? unit.topics.filter(Boolean) : [];',
  '      unit.topics = topics;',
  '      for (const topic of topics){',
  '        const raw = Array.isArray(topic.conceptIndices) ? topic.conceptIndices',
  '          : (Number.isInteger(topic.conceptIndices) ? [topic.conceptIndices] : []);',
  '        const keep = [];',
  '        for (const i of raw){',
  '          if (Number.isInteger(i) && i >= 0 && i < n) {',
  '            if (seen.has(i)) {',
  '              /* Duplicate: also remove from the topic that first saw it. */',
  '              const origTopic = seenTopic.get(i);',
  '              if (origTopic && origTopic !== topic) {',
  '                origTopic.conceptIndices = origTopic.conceptIndices.filter(x => x !== i);',
  '              }',
  '            } else {',
  '              seen.add(i);',
  '              seenTopic.set(i, topic);',
  '              keep.push(i);',
  '            }',
  '          }',
  '        }',
  '        keep.sort((a, b) => a - b);',
  '        topic.conceptIndices = keep;',
  '      }',
  '    }'
].join('\n');

if (src.indexOf(oldText) === -1) {
  console.error('ERROR: Could not find the old text to replace');
  // Debug: show what we're looking for
  console.error('Looking for:');
  console.error(oldText.substring(0, 200));
  process.exit(1);
}

src = src.replace(oldText, newText);
fs.writeFileSync(filePath, src);
console.log('Successfully replaced the duplicate handling code');
