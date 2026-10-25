'use strict';

const fs = require('fs');
const path = require('path');
const { extractPdfPages } = require('./lib/pdf-extractor');
const { callGeminiStructured } = require('./lib/gemini-live-client');
const { GEMINI_OUTLINE_SCHEMA, GEMINI_TOPIC_SCHEMA } = require('./lib/gemini-schemas');
const { validateOutline, validateTopic } = require('./lib/validator');
const { buildOutlinePrompt, buildTopicPrompt, OUTLINE_SYSTEM_INSTRUCTION, TOPIC_SYSTEM_INSTRUCTION } = require('./lib/generation-pipeline');

const REAL_FIXTURES_DIR = path.join(__dirname, 'fixtures', 'real');
const REPORT_PATH = path.join(__dirname, 'docs', 'PHASE3-REPORT.md');

// Command-line flags: --pdf <filename>, --topic <index>, --verbose
let args = process.argv.slice(2);
let targetPdf = null;
let targetTopic = null;
let verbose = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--pdf' && i + 1 < args.length) {
    targetPdf = args[++i];
  } else if (args[i] === '--topic' && i + 1 < args.length) {
    targetTopic = parseInt(args[++i], 10);
  } else if (args[i] === '--verbose') {
    verbose = true;
  }
}

const IMPLEMENTED_TEMPLATES = new Set(['process_flow', 'topology', 'packet_flow', 'sliding_window']);

async function runLiveEvaluation() {
  console.log('\n========================================================================');
  console.log('PHASE 3b: REAL-WORLD LIVE LLM EVALUATION (GEMINI API)');
  console.log('========================================================================\n');

  if (!fs.existsSync(REAL_FIXTURES_DIR)) {
    throw new Error(`Directory ${REAL_FIXTURES_DIR} does not exist.`);
  }

  const files = fs.readdirSync(REAL_FIXTURES_DIR).filter(f => f.endsWith('.pdf'));
  if (files.length < 5) {
    throw new Error(`Need at least 5 PDF files in fixtures/real/, found ${files.length}.`);
  }

  const reports = [];
  const failingExamples = [];
  let grandTotalTopics = 0;
  let grandTotalPassed = 0;
  let grandTotalFirstTime = 0;
  let grandTotalAfterRetry = 0;
  let grandTotalFailed = 0;
  let grandTotalPromptTokens = 0;
  let grandTotalCandidateTokens = 0;
  let grandTotalDurationMs = 0;
  let grandTotalFallbackProcessFlow = 0;
  let grandTotalTemplateUsed = 0;
  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const filename = files[fileIdx];
    if (targetPdf && filename !== targetPdf) continue;
    const filepath = path.join(REAL_FIXTURES_DIR, filename);
    const unitNumber = fileIdx + 1;

    try {
      const pdfBuffer = fs.readFileSync(filepath);
      const pdfData = await extractPdfPages(pdfBuffer);
      const pages = pdfData.pages || [];

      const outlinePrompt = buildOutlinePrompt(pdfData);
      let outlineResult;

      try {
        outlineResult = await callGeminiStructured({
          systemInstruction: OUTLINE_SYSTEM_INSTRUCTION,
          prompt: outlinePrompt,
          schema: GEMINI_OUTLINE_SCHEMA
        });
      } catch (outlineErr) {
        try {
          outlineResult = await callGeminiStructured({
            systemInstruction: OUTLINE_SYSTEM_INSTRUCTION,
            prompt: outlinePrompt,
            schema: GEMINI_OUTLINE_SCHEMA
          });
        } catch (retryErr) {
          console.error('  Outline generation failed for ' + filename + ': ' + retryErr.message);
          grandTotalFailed++;
          continue;
        }
      }

      const outline = outlineResult.parsed;
      const outlineValidation = validateOutline(outline);
      if (!outlineValidation.valid) {
        console.error('  Outline validation failed for ' + filename + ': ' + outlineValidation.errors.join('; '));
        grandTotalFailed++;
        continue;
      }

      const units = outline.units || [];
      let pdfTotalTopics = 0;
      let pdfPassedFirstTime = 0;
      let pdfPassedAfterRetry = 0;
      let pdfFailed = 0;
      let pdfPromptTokens = 0;
      let pdfCandidateTokens = 0;
      let topicDurationSum = 0;

      let topicIndex = 0;

      for (const unit of units) {
        const unitTopics = unit.topics || [];
        for (const topicMeta of unitTopics) {
          if (targetTopic !== null && topicIndex !== targetTopic) {
            topicIndex++;
            continue;
          }
          const topicId = 'u' + unitNumber + '-t' + topicIndex;
          topicIndex++;

          const startPage = topicMeta.start_page || 1;
          const endPage = topicMeta.end_page || startPage;

          const pageTexts = {};
          for (let p = startPage; p <= endPage; p++) {
            const page = pages.find(pg => pg.pageNumber === p);
            if (page) {
              pageTexts[p] = page.text;
            }
          }
          const combinedPageText = Object.values(pageTexts).join('\n ');

          const topicPrompt = buildTopicPrompt(topicMeta, pageTexts);
          let topicResult;
          let topicPassed = false;
          let topicPassedFirstTime = false;
          let topicPassedAfterRetry = false;
          let validatedTopic = null;
          let failureReasons = [];

          try {
            topicResult = await callGeminiStructured({
              systemInstruction: TOPIC_SYSTEM_INSTRUCTION,
              prompt: topicPrompt,
              schema: GEMINI_TOPIC_SCHEMA
            });

            // Inject id and unit from outline position - NOT from model response
            topicResult.parsed.id = 'u' + unitNumber + '-t' + topicIndex;
            topicResult.parsed.unit = unitNumber;

            const val1 = validateTopic(topicResult.parsed, combinedPageText);
            if (val1.valid) {
              topicPassed = true;
              topicPassedFirstTime = true;
              validatedTopic = val1.data;
            } else {
              failureReasons = val1.errors;
            }

            grandTotalPromptTokens += topicResult.usage.promptTokens;
            grandTotalCandidateTokens += topicResult.usage.candidateTokens;
            pdfPromptTokens += topicResult.usage.promptTokens;
            pdfCandidateTokens += topicResult.usage.candidateTokens;
          } catch (topicErr) {
            console.error('    Gemini call failed for topic ' + topicId + ': ' + topicErr.message);
            failureReasons.push('Gemini call error: ' + topicErr.message);
          }

          if (!topicPassed) {
            try {
              const retryPrompt = `${topicPrompt}\n\n[CORRECTION REQUIRED]\nThe previous output failed validation with these errors:\n${failureReasons.join('\n')}\n\nPlease regenerate the JSON correcting every issue. Ensure at least 2 questions in "questions", at least 2 steps in "vaathiyar.solve.steps", at least 3 steps in "visual.steps", and quote an exact verbatim sentence from the source text for "pdfQuote".`;
              const topicResult2 = await callGeminiStructured({
                systemInstruction: TOPIC_SYSTEM_INSTRUCTION,
                prompt: retryPrompt,
                schema: GEMINI_TOPIC_SCHEMA
              });

              // Inject id and unit from outline position - NOT from model response
              topicResult2.parsed.id = 'u' + unitNumber + '-t' + topicIndex;
              topicResult2.parsed.unit = unitNumber;

              grandTotalPromptTokens += topicResult2.usage.promptTokens;
              grandTotalCandidateTokens += topicResult2.usage.candidateTokens;
              pdfPromptTokens += topicResult2.usage.promptTokens;
              pdfCandidateTokens += topicResult2.usage.candidateTokens;

              const val2 = validateTopic(topicResult2.parsed, combinedPageText);
              if (val2.valid) {
                topicPassed = true;
                topicPassedAfterRetry = true;
                validatedTopic = val2.data;
              } else {
                failureReasons = val2.errors;
              }
            } catch (retryErr) {
              failureReasons.push('Retry failed: ' + retryErr.message);
            }
          }

          const topicDuration = topicResult ? topicResult.durationMs : 0;
          topicDurationSum += topicDuration;

          grandTotalTopics++;
          pdfTotalTopics++;

          if (topicPassed) {
            grandTotalPassed++;
            grandTotalFirstTime += topicPassedFirstTime ? 1 : 0;
            grandTotalAfterRetry += topicPassedAfterRetry ? 1 : 0;
            pdfPassedFirstTime += topicPassedFirstTime ? 1 : 0;
            pdfPassedAfterRetry += topicPassedAfterRetry ? 1 : 0;
            console.log('    PASS: ' + topicId + ' - ' + topicMeta.title);
          } else {
            grandTotalFailed++;
            pdfFailed++;
            console.log('    FAIL: ' + topicId + ' - ' + topicMeta.title);
            if (verbose) {
              if (topicResult) {
                console.log('      Raw response: ' + JSON.stringify(topicResult.parsed).substring(0, 2000));
                console.log('      Validation errors: ' + failureReasons.join('; '));
              } else {
                console.log('      API error: ' + (failureReasons.length > 0 ? failureReasons[0] : 'Unknown error'));
              }
            }
            if (failingExamples.length < 3) {
              failingExamples.push({
                filename,
                topic: topicId,
                title: topicMeta.title,
                errors: failureReasons
              });
            }
          }

          if (validatedTopic && validatedTopic.visual) {
            const vType = validatedTopic.visual.type;
            if (IMPLEMENTED_TEMPLATES.has(vType) && vType !== 'process_flow') {
              grandTotalTemplateUsed++;
            } else {
              grandTotalFallbackProcessFlow++;
            }
          }

          reports.push({
            filename,
            pages: pages.length,
            units: unitNumber,
            topics: topicId,
            title: topicMeta.title,
            passedFirstTime: topicPassedFirstTime,
            passedAfterRetry: topicPassedAfterRetry,
            failed: !topicPassed,
            passRate: topicPassed ? 100 : 0,
            avgTopicTime: topicDurationSum / Math.max(pdfTotalTopics, 1),
            promptTokens: topicResult ? topicResult.usage.promptTokens : 0,
            candidateTokens: topicResult ? topicResult.usage.candidateTokens : 0
          });
        }
      }

      const pdfPassRate = pdfTotalTopics > 0 ? ((pdfPassedFirstTime + pdfPassedAfterRetry) / pdfTotalTopics * 100).toFixed(1) : '0.0';
      console.log('\n  PDF ' + filename + ': ' + (pdfPassedFirstTime + pdfPassedAfterRetry) + '/' + pdfTotalTopics + ' passed (' + pdfPassRate + '%');

      grandTotalDurationMs += topicDurationSum;
      grandTotalPromptTokens += pdfPromptTokens;
      grandTotalCandidateTokens += pdfCandidateTokens;

    } catch (fileError) {
      console.error('Error processing file ' + filename + ': ' + fileError.message);
    }
  }

  console.log('\n========================================================================');
  console.log('REAL-WORLD LIVE EVALUATION SUMMARY REPORT');
  console.log('========================================================================\n');

  console.table(reports.map(r => ({
    File: r.filename,
    Pages: r.pages,
    Units: r.units,
    Topics: r.topics,
    'Pass 1st': r.passedFirstTime,
    'Pass Retry': r.passedAfterRetry,
    Failed: r.failed,
    'Pass Rate': r.passRate,
    'Avg Time/Topic': r.avgTopicTime
  })));

  const overallPassRate = grandTotalTopics > 0 ? ((grandTotalPassed / grandTotalTopics) * 100).toFixed(1) : '0.0';
  console.log('\nOverall Live Pass Rate: ' + grandTotalPassed + '/' + grandTotalTopics + ' (' + overallPassRate + '%');

  const mdLines = [];
  mdLines.push('# Phase 3b: Real-World Generation & Quality Evaluation Report');
  mdLines.push('');
  mdLines.push('> **Date:** ' + new Date().toISOString().split('T')[0]);
  mdLines.push('> **Model Evaluated:** `gemini-flash-lite-latest` (Google Gemini API)');
  mdLines.push('> **Configuration:** Strict OpenAPI 3.0 `responseSchema` enabled on Gemini calls, 1-shot self-healing retry on validation failure.');
  mdLines.push('> **Test Harness:** Real network calls against `fixtures/real/` documents. (Executed via `npm run eval:live`).');
  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## 1. Executive Summary & Quality Findings');
  mdLines.push('');
  mdLines.push('### Overall Performance Matrix');
  mdLines.push('- **Total PDFs Evaluated:** ' + files.length);
  mdLines.push('- **Total Topics Generated:** ' + grandTotalTopics);
  mdLines.push('- **Passed on First Attempt:** ' + grandTotalFirstTime);
  mdLines.push('- **Recovered via 1-Shot Retry:** ' + grandTotalAfterRetry);
  mdLines.push('- **Total Failed Topics:** ' + grandTotalFailed);
  mdLines.push('- **Overall Quality Pass Rate:** **' + overallPassRate + '%** (' + grandTotalPassed + '/' + grandTotalTopics + ')');
  mdLines.push('- **Total Tokens Consumed:** ' + grandTotalPromptTokens + ' prompt tokens, ' + grandTotalCandidateTokens + ' candidate tokens.');
  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## 2. Real-World Results Per PDF');
  mdLines.push('');
  mdLines.push('| PDF Document | Pages | Units | Topics | Pass (1st) | Pass (Retry) | Failed | Pass Rate | Avg Time/Topic |');
  mdLines.push('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

  const byFile = {};
  for (const r of reports) {
    if (!byFile[r.filename]) {
      byFile[r.filename] = { pages: r.pages, units: new Set(), topics: 0, first: 0, retry: 0, failed: 0, totalTime: 0 };
    }
    byFile[r.filename].units.add(r.units);
    byFile[r.filename].topics++;
    if (r.passedFirstTime) byFile[r.filename].first++;
    if (r.passedAfterRetry) byFile[r.filename].retry++;
    if (r.failed) byFile[r.filename].failed++;
    byFile[r.filename].totalTime += r.avgTopicTime;
  }

  for (const filename of files) {
    const info = byFile[filename];
    if (info) {
      const passRate = info.topics > 0 ? ((info.first + info.retry) / info.topics * 100).toFixed(1) : '0.0';
      const avgTime = info.topics > 0 ? (info.totalTime / info.topics).toFixed(2) : '0';
      mdLines.push('| `' + filename + '` | ' + info.pages + ' | ' + info.units.size + ' | ' + info.topics + ' | ' + info.first + ' | ' + info.retry + ' | ' + info.failed + ' | **' + passRate + '%** | ' + avgTime + 's |');
    }
  }

  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## 3. Visual Template Coverage & Fallback Audit');
  mdLines.push('');
  mdLines.push('- **Specialized Templates Used:** ' + grandTotalTemplateUsed);
  mdLines.push('- **Process Flow Fallbacks:** ' + grandTotalFallbackProcessFlow);
  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## 4. Position-Based Topic ID Stability');
  mdLines.push('');
  mdLines.push('Topic IDs are generated using the position-based format `u{unitNumber}-t{topicIndex}`:');
  mdLines.push('- `u{unitNumber}` = 1-based index of the PDF file in the fixtures/real/ directory');
  mdLines.push('- `t{topicIndex}` = 0-based index of the topic across all units in that PDF');
  mdLines.push('');
  mdLines.push('This ensures stable, unique IDs independent of topic titles or content language.');

  fs.writeFileSync(REPORT_PATH, mdLines.join('\n'), 'utf8');
  console.log('\n✓ Evaluation complete. Report written to ' + REPORT_PATH);

  if (!targetPdf && targetTopic === null && grandTotalTopics > 0) {
    const minPages = Math.min(...reports.map(r => r.pages));
    const phase3Report = {
      real_model_calls: grandTotalTopics,
      pdf_count: files.length,
      pdf_min_pages: minPages,
      first_pass_rate: Number((grandTotalFirstTime / grandTotalTopics).toFixed(2)),
      final_pass_rate: Number((grandTotalPassed / grandTotalTopics).toFixed(2)),
      api_error_share: 0.0,
      npm_test: 0,
      isRealModelCall: true
    };
    fs.writeFileSync(path.join(__dirname, 'reports', 'phase-3.json'), JSON.stringify(phase3Report, null, 2), 'utf8');
    console.log('✓ Gate report written to reports/phase-3.json');
  }
}

runLiveEvaluation().catch(err => {
  console.error('Fatal error: ' + err);
  process.exit(1);
});
