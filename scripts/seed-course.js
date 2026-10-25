'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Loads the client-side data modules in a sandbox to get the complete sample course.
 */
function loadSampleCourse() {
  const sandbox = {
    window: { XC: {} },
    console: { log: () => {} }
  };
  vm.createContext(sandbox);

  const files = [
    'js/data-topics.js',
    'js/data-cheatcodes.js',
    'js/data-vaathiyar.js'
  ];

  for (const rel of files) {
    const full = path.join(__dirname, '..', rel);
    if (fs.existsSync(full)) {
      const code = fs.readFileSync(full, 'utf8');
      vm.runInContext(code, sandbox);
    }
  }

  const rawTopics = sandbox.window.XC.TOPICS || [];
  return rawTopics;
}

/**
 * Generates SQL seed script or directly executes seed against Supabase.
 */
function generateSeedSql(userId = '00000000-0000-0000-0000-000000000001') {
  const topics = loadSampleCourse();
  const docId = '10000000-0000-0000-0000-000000000001';
  
  const unitDefs = [
    { num: 1, title: 'Physical Layer & Fundamentals', start: 1, end: 15 },
    { num: 2, title: 'Data Link Layer & MAC Sublayer', start: 16, end: 35 },
    { num: 3, title: 'Network Layer & Routing', start: 36, end: 55 },
    { num: 4, title: 'Transport Layer & Congestion Control', start: 56, end: 75 },
    { num: 5, title: 'Application Layer & Network Security', start: 76, end: 100 }
  ];

  let sql = `-- Seed Sample Computer Networks Course\n`;
  sql += `INSERT INTO public.users (id, email, plan) VALUES ('${userId}', 'demo@xamcode.internal', 'free') ON CONFLICT (id) DO NOTHING;\n\n`;
  sql += `INSERT INTO public.documents (id, user_id, pdf_hash, r2_key, pages, subject, status) VALUES ('${docId}', '${userId}', 'sample_hash_networks', 'courses/sample_networks.pdf', 100, 'Computer Networks', 'ready') ON CONFLICT (id) DO NOTHING;\n\n`;

  const unitIds = {};
  unitDefs.forEach((u, i) => {
    const uId = `20000000-0000-0000-0000-00000000000${u.num}`;
    unitIds[u.num] = uId;
    sql += `INSERT INTO public.units (id, document_id, idx, title, page_start, page_end, status) VALUES ('${uId}', '${docId}', ${u.num}, '${u.title}', ${u.start}, ${u.end}, 'ready') ON CONFLICT (id) DO NOTHING;\n`;
  });
  sql += '\n';

  topics.forEach((t, idx) => {
    // Unit assignment heuristic: 29 topics across 5 units
    const unitNum = Math.min(5, Math.floor(idx / 6) + 1);
    const unitId = unitIds[unitNum];
    const topId = `30000000-0000-0000-0000-${String(idx + 1).padStart(12, '0')}`;
    
    // Clean topic json payload
    const payload = {
      id: t.id,
      title: t.title,
      topic: t.topic,
      pdfPage: t.pdfPage,
      pdfQuote: t.pdfQuote,
      explanation: t.explanation,
      keyPoints: t.keyPoints || [],
      steps: t.steps || [],
      cheatcode: t.cheatcode || {},
      vaathiyar: t.vaathiyar || {}
    };

    const jsonStr = JSON.stringify(payload).replace(/'/g, "''");
    sql += `INSERT INTO public.topics (id, unit_id, idx, title, json, visual_type, validated) VALUES ('${topId}', '${unitId}', ${idx + 1}, '${t.title.replace(/'/g, "''")}', '${jsonStr}'::jsonb, '${t.visualType || 'process_flow'}', true) ON CONFLICT (id) DO NOTHING;\n`;
  });

  return sql;
}

if (require.main === module) {
  const sql = generateSeedSql();
  const outPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
  fs.writeFileSync(outPath, sql, 'utf8');
  console.log('✓ Generated seed SQL with ' + loadSampleCourse().length + ' topics to ' + outPath);
}

module.exports = {
  loadSampleCourse,
  generateSeedSql
};

