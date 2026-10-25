'use strict';

/**
 * Deterministic Mock AI Provider for Golden Fixture Testing
 * Generates 100% schema-compliant, lexically grounded courses
 * directly from the extracted page texts of any supplied PDF fixture.
 */

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Generates a valid outline from extracted page headings.
 */
function generateOutlineFromPages(extractedPages) {
  const pages = extractedPages.pages || [];
  const subject = pages[0] && pages[0].title
    ? pages[0].title.split(/[:\d]/)[0].trim()
    : (pages[0]?.headings[0] ? pages[0].headings[0].split(/[:\d]/)[0].trim() : 'Academic Course');

  const units = [];
  pages.forEach((p, pIdx) => {
    const unitNum = pIdx + 1;
    const h = p.headings[0] || `Core Concepts Part ${unitNum}`;
    const topicTitle = p.headings[0] || `Foundation Topic ${unitNum}`;
    const slug = slugify(topicTitle);

    units.push({
      unit_number: unitNum,
      unit_title: `Unit ${unitNum}: ${h}`,
      overview: `Comprehensive exploration of ${h} and associated engineering mechanisms.`,
      topics: [
        {
          id: `${slug}-${unitNum}`,
          title: topicTitle,
          topic: h,
          start_page: p.pageNumber,
          end_page: p.pageNumber,
          first_lines: p.firstLines || `Core principles of ${topicTitle}`
        }
      ]
    });
  });

  return {
    subject,
    units
  };
}

/**
 * Generates a valid, lexically grounded topic from page text.
 */
function generateTopicFromPages(topicMeta, pageTexts) {
  const combinedText = Object.values(pageTexts).join('\n');
  const candidateLines = combinedText
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length >= 25 && !s.startsWith('--- PAGE'));

  // Pick a real verbatim sentence from the extracted text for lexical grounding
  const verbatimQuote = candidateLines.find(l => l.length >= 35 && !l.includes('Lecture')) || candidateLines[0] || 'Core architectural principle in engineering.';
  const secondSentence = candidateLines.find(l => l !== verbatimQuote && l.length >= 30) || verbatimQuote;

  const visualTypes = ['process_flow', 'topology', 'packet_flow', 'sliding_window'];
  const visType = visualTypes[Math.abs(topicMeta.title.length) % visualTypes.length];

  return {
    id: topicMeta.id,
    unit: topicMeta.unit || 1,
    unitTitle: topicMeta.unitTitle || `Unit ${topicMeta.unit || 1}: ${topicMeta.title}`,
    title: topicMeta.title,
    topic: topicMeta.topic || topicMeta.title,
    pdfPage: `Page ${topicMeta.start_page}`,
    pdfQuote: verbatimQuote,
    explanation: `${verbatimQuote} ${secondSentence} This forms the architectural foundation for subsequent systems.`,
    keyPoints: [
      verbatimQuote.slice(0, 60),
      secondSentence.slice(0, 60),
      `Core operational principles of ${topicMeta.title}`
    ],
    steps: [
      { title: 'Initialization', desc: `System setup and context initialization for ${topicMeta.title}.` },
      { title: 'Core Execution', desc: `${verbatimQuote.slice(0, 50)} is processed.` },
      { title: 'State Verification', desc: `Output validation and state progression verification.` },
      { title: 'Completion', desc: `Final transition and acknowledgment delivered.` }
    ],
    visual: {
      type: visType,
      title: `${topicMeta.title} Dynamic Visualization`,
      steps: [
        { title: 'Phase 1: Trigger', desc: 'Initial stimulus received by the primary node.' },
        { title: 'Phase 2: Transit', desc: 'Signals traverse intermediate channels.' },
        { title: 'Phase 3: Verify', desc: 'Integrity checking and response dispatch.' }
      ],
      parameters: { speed: 1.0, activeNodes: 3 }
    },
    cheatcode: {
      why: `Because systems require predictable coordination without human intervention.`,
      like: `Like a synchronized traffic signal grid coordinating vehicular flow.`,
      wrong: `Believing that ${topicMeta.title} operates instantaneously without state checks.`,
      right: `${verbatimQuote.slice(0, 70)}.`,
      see: ['Production Cloud Servers', 'Operating System Kernels', 'Network Gateways', 'Distributed Nodes'],
      oneLine: `${topicMeta.title}: ${verbatimQuote.slice(0, 60)}.`
    },
    questions: [
      {
        q: `According to the lecture text, which of the following is true regarding ${topicMeta.title}?`,
        opts: [
          verbatimQuote,
          `It operates with zero memory overhead or state persistence.`,
          `It has been deprecated across modern distributed computing architectures.`,
          `It only applies to single-threaded offline batch jobs.`
        ],
        a: 0,
        cat: 'CONCEPT',
        diff: 'Easy',
        why: `The text explicitly states: "${verbatimQuote}".`,
        wrong: [
          `Correct: grounded directly in lecture text.`,
          `Incorrect: systems maintain state context.`,
          `Incorrect: widely utilized in modern architectures.`,
          `Incorrect: applies across networked environments.`
        ],
        quote: verbatimQuote,
        page: `Page ${topicMeta.start_page}`,
        hint: `Look for the verbatim statement from the opening paragraphs.`,
        eli: `The direct quote gives the answer.`
      },
      {
        q: `What is the primary role of ${topicMeta.title} in system execution?`,
        opts: [
          `To coordinate state transitions and maintain system invariants.`,
          `To terminate all active processes unconditionally.`,
          `To bypass security and integrity checks.`,
          `To serialize data into unreadable random noise.`
        ],
        a: 0,
        cat: 'MECHANISM',
        diff: 'Medium',
        why: `It ensures predictable state progression according to operational rules.`,
        wrong: [
          `Correct: maintains operational invariants.`,
          `Incorrect: does not terminate processes.`,
          `Incorrect: integrity is preserved.`,
          `Incorrect: structured format is maintained.`
        ],
        quote: secondSentence,
        page: `Page ${topicMeta.start_page}`,
        hint: `Think about how coordinated state transitions function.`,
        eli: `Keeping things organized and reliable.`
      }
    ],
    vaathiyar: {
      crash: [
        { tag: 'INTUITION', text: `Vanakkam, students. Today we break down ${topicMeta.title}.`, readMs: 5000 },
        { tag: 'MECHANISM', text: verbatimQuote, readMs: 5200 },
        { tag: 'TAKEAWAY', text: `Devices + State Coordination = Reliable ${topicMeta.title}.`, readMs: 4800 }
      ],
      crashExplain: [
        { h: 'Why it was invented', t: 'Manual coordination could not scale with distributed computing.' },
        { h: 'Real-world anchor', t: 'Powers core internet routing and enterprise systems daily.' }
      ],
      compare: {
        left: topicMeta.title,
        right: 'Uncoordinated Baseline',
        rows: [
          ['State Safety', 'Guaranteed', 'Unpredictable'],
          ['Throughput', 'High & Managed', 'Erratic'],
          ['Overhead', 'Bounded', 'Minimal but Unsafe']
        ],
        bars: [
          { label: 'Reliability', leftPct: 95, rightPct: 25, leftTxt: '95%', rightTxt: '25%' },
          { label: 'Throughput', leftPct: 85, rightPct: 40, leftTxt: 'High', rightTxt: 'Low' }
        ]
      },
      compareExplain: [
        { h: 'Key Difference', t: 'Coordinated execution prevents race conditions and data corruption.' }
      ],
      solve: {
        q: `Given a transmission rate of 100 Mbps and RTT of 20ms, calculate the Bandwidth-Delay Product (BDP).`,
        steps: [
          { label: 'STEP 1 — GIVEN', math: 'R = 100 × 10⁶ bps, RTT = 0.020 s', note: 'Convert units' },
          { label: 'STEP 2 — FORMULA', math: 'BDP = R × RTT', note: 'Standard product' },
          { label: 'STEP 3 — CALCULATE', math: 'BDP = 100 × 10⁶ × 0.020 = 2,000,000 bits', note: '2 Megabits capacity' },
          { label: 'ANSWER', math: '250 KB in flight', note: '2,000,000 / 8 bytes' }
        ]
      },
      solveExplain: [
        { h: 'What BDP means', t: 'The volume of data the network pipe can hold in flight at once.' }
      ],
      life: [
        { ic: '🌐', h: 'Global Cloud Systems', t: 'Powers distributed Kubernetes clusters.' },
        { ic: '📱', h: 'Mobile Applications', t: 'Handles reliable socket streams across fluctuating cell networks.' }
      ],
      lifeExplain: [
        { h: 'Ubiquitous presence', t: 'Every networked device relies on these exact coordination primitives.' }
      ],
      history: [
        { yr: '1970s', h: 'Protocol Inception', t: 'Pioneered during early ARPANET internetworking experiments.' },
        { yr: 'Present', h: 'Modern Scale', t: 'Scales across millions of concurrent enterprise connections.' }
      ],
      historyExplain: [
        { h: 'Evolutionary path', t: 'Iteratively refined across decades of production experience.' }
      ],
      flash: [
        { q: `What is the core purpose of ${topicMeta.title}?`, a: verbatimQuote.slice(0, 80) },
        { q: `What invariant is guaranteed?`, a: 'Deterministic state coordination.' }
      ],
      flashExplain: [
        { h: 'Active recall tip', t: 'State the mechanism definition before flipping the card.' }
      ],
      exam: [
        { q: `Define ${topicMeta.title} and state two primary advantages.`, a: `${verbatimQuote}. Advantages: deterministic safety and predictable performance.` },
        { q: `Explain how failures are handled.`, a: 'Through retransmissions, timeouts, and state checkpoints.' }
      ],
      examExplain: [
        { h: 'Mark distribution', t: 'Definitions carry 2 marks; comparative evaluation carries 5 marks.' }
      ],
      eli5: {
        kid: `Imagine a line of friendly helpers passing toys in order without dropping any!`,
        middle: `It is a rulebook for computers so they can talk without stepping on each other's messages.`,
        engg: `${verbatimQuote} Formally satisfies sequential consistency across distributed state machines.`
      },
      eli5Explain: [
        { h: 'Progressive disclosure', t: 'Build intuition first, then grasp the formal rigorous specification.' }
      ]
    }
  };
}

module.exports = {
  generateOutlineFromPages,
  generateTopicFromPages
};
