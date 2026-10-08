/* ============================================================
   DATA — VAATHIYAR MODE · UNIT II (DATA LINK LAYER)
   ============================================================
   Merges into the shared VAATHIYAR map built by data-vaathiyar.js,
   so getVaathiyar() resolves these without any other change.

   Every entry carries the same 8 sub-modes as Unit I: crash,
   compare, solve, life, history, flash, exam, eli5 — plus the
   matching *Explain blocks.

   solve.figure is optional. Only topics that genuinely have a
   packet-timeline story supply one; everything else falls back to
   the generic step schematic in vaathiyarTabView().

   Source: Ferosan Computer Networks notes, Unit II (pp. 35-72).
   ============================================================ */
window.XC = window.XC || {};

Object.assign(window.XC.VAATHIYAR, {

/* ==========================================================
     DATA LINK LAYER SERVICES — what the layer promises
     ========================================================== */
  'dll-services': {
    crash:[
      { tag:'WHY LAYER 2 EXISTS', text:"Physical layer bits-a kuduthu kattu vidunga — bits correct aagana guarantee illa. Data link layer indha gap-a fill panradhu.", visual:`<div style="text-align:center"><div style="display:flex;gap:18px;justify-content:center;align-items:center;flex-wrap:wrap"><div style="padding:12px 18px;border:2px solid #6b7280;border-radius:10px;color:#9ca3af;font-size:11px;font-weight:800">LAYER 1<br>PHYSICAL<br><span style="color:#ef4444;font-size:10px">raw bits</span></div><div style="font-size:26px;color:#2dd4bf">&#8594;</div><div style="padding:12px 18px;border:2px solid #2dd4bf;border-radius:10px;color:#2dd4bf;font-size:11px;font-weight:800">LAYER 2<br>DATA LINK<br><span style="color:#22c55e;font-size:10px">frames &#10003;</span></div></div></div>`, readMs:5200 },
      { tag:'FRAMING', text:"Bit stream-a manage-a pannu frame la pack pannu, receiver-kku end-a start-a theriyanum maari delimit pannu. Adhu mattum thaan framing.", visual:`<svg viewBox="0 0 400 90" style="width:100%;max-width:400px"><rect x="10" y="26" width="380" height="38" rx="8" fill="#111a2e" stroke="#2dd4bf" stroke-width="2"/><rect x="10" y="26" width="46" height="38" rx="8" fill="#a78bfa"/><rect x="340" y="26" width="50" height="38" rx="8" fill="#facc15"/><text x="33" y="50" text-anchor="middle" font-size="10" font-weight="800" fill="#000">FLAG</text><text x="365" y="50" text-anchor="middle" font-size="10" font-weight="800" fill="#000">FLAG</text><text x="198" y="50" text-anchor="middle" font-size="11" font-weight="700" fill="#e2e8f0">PAYLOAD</text></svg>`, readMs:5000 },
      { tag:'PHYSICAL ADDRESSING', text:"Frame-kku oru MAC address vechirakottu vazhangum. Link layer-kku node-a node-a address mattu, IP address alla.", visual:`<div style="display:flex;gap:16px;justify-content:center;align-items:center;flex-wrap:wrap"><div style="text-align:center"><div style="font-size:40px">&#128421;</div><div style="color:#a78bfa;font-size:10px;font-weight:800;margin-top:6px">A2:4B:7C</div></div><div style="font-size:22px;color:#2dd4bf">&#8676;</div><div style="text-align:center"><div style="font-size:40px">&#128424;</div><div style="color:#a78bfa;font-size:10px;font-weight:800;margin-top:6px">D1:9E:F3</div></div><div style="font-size:10px;color:#6b7280;max-width:160px;text-align:left">MAC = link-layer<br>48-bit address</div></div>`, readMs:5000 },
      { tag:'FLOW + ERROR CONTROL', text:"Slow receiver-ku fast sender vaadiyathum OK — flow control maattrom. Error varathum theriyathanum — error control maattrom.", visual:`<div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap"><div style="padding:14px;border:2px solid #22c55e;border-radius:10px;text-align:center;min-width:130px"><div style="font-size:26px">&#128681;</div><div style="color:#22c55e;font-size:11px;font-weight:800;margin-top:6px">FLOW CONTROL</div><div style="color:#9ca3af;font-size:10px;margin-top:4px">Don't flood me</div></div><div style="padding:14px;border:2px solid #facc15;border-radius:10px;text-align:center;min-width:130px"><div style="font-size:26px">&#128269;</div><div style="color:#facc15;font-size:11px;font-weight:800;margin-top:6px">ERROR CONTROL</div><div style="color:#9ca3af;font-size:10px;margin-top:4px">Tell me if bits broke</div></div></div>`, readMs:5400 },
      { tag:'ACCESS CONTROL', text:"Shared link-la oru varaichu yaar yaar kelkkalum decide pannanum. Adhu access control.", visual:`<div style="text-align:center"><svg viewBox="0 0 340 100" style="width:100%;max-width:340px"><line x1="20" y1="34" x2="320" y2="34" stroke="#2dd4bf" stroke-width="4"/><text x="20" y="20" font-size="10" font-weight="800" fill="#2dd4bf">SHARED LINK</text><rect x="40" y="52" width="70" height="30" rx="7" fill="#a78bfa"/><rect x="140" y="52" width="70" height="30" rx="7" fill="#22c55e"/><rect x="240" y="52" width="70" height="30" rx="7" fill="#facc15"/><text x="75" y="72" text-anchor="middle" font-size="10" font-weight="800" fill="#000">A</text><text x="175" y="72" text-anchor="middle" font-size="10" font-weight="800" fill="#000">B</text><text x="275" y="72" text-anchor="middle" font-size="10" font-weight="800" fill="#000">C</text></svg></div>`, readMs:5000 },
      { tag:'ONE LINE', text:"Five-a varum: framing, physical addressing, flow control, error control, access control. Full service ellaam.", visual:`<div style="text-align:center"><div style="font-size:60px">&#127919;</div><div style="color:#2dd4bf;font-weight:900;font-size:16px;margin-top:16px;padding:18px 26px;background:rgba(45,212,191,.08);border:2px dashed rgba(45,212,191,.4);border-radius:16px;line-height:1.7;max-width:520px">Framing &#183; Addressing &#183; Flow<br>Error &#183; Access</div></div>`, readMs:5000 }
    ],
    crashExplain:[
      {h:'The layer in one sentence', t:'The data link layer turns an unreliable bit pipe into a reliable hop-to-hop link between two directly connected nodes.'},
      {h:'Why hop-to-hop only', t:'Layer 2 repairs each individual link. It does not provide end-to-end reliability — that is the transport layer job.'},
      {h:'Common trap', t:'Students swap MAC and IP addresses. MAC is strictly local to one link and is never routed.'}
    ],
    compare:{
      left:'Data Link Layer', right:'Transport Layer',
      rows:[
        ['Scope','Single hop — one link','End to end — whole path'],
        ['Address','MAC (48-bit, flat)','IP address + port number'],
        ['Unit passed','Frame','Segment / datagram'],
        ['Error handling','Detect and correct per link','Check and retransmit end to end'],
        ['Main job','Framing, access, local error','Reliability, flow, process to process']
      ],
      bars:[
        {label:'Scope of control', leftPct:25, rightPct:100, leftTxt:'One hop', rightTxt:'End to end'},
        {label:'Addressing depth', leftPct:30, rightPct:95, leftTxt:'MAC only', rightTxt:'IP + port'},
        {label:'Error handling', leftPct:70, rightPct:100, leftTxt:'Correct in place', rightTxt:'Retransmit'},
        {label:'Multiplexing', leftPct:10, rightPct:85, leftTxt:'None', rightTxt:'Port numbers'}
      ]
    },
    compareExplain:[
      {h:'The cleanest distinction', t:'Layer 2 gets bits across ONE wire correctly. Layer 4 gets data from PROCESS A to PROCESS B reliably across many wires.'},
      {h:'How to spot it in a question', t:'"A frame arrives with a CRC error" is layer 2. "TCP retransmits the segment" is layer 4.'},
      {h:'Real example', t:'WiFi drops a frame — layer 2 CSMA/CA retries locally. A lost TCP segment crossing the country is layer 4.'}
    ],
    solve:{
      q:'A 1 Mbps shared link carries 10 computers using CSMA/CD. Each computer needs 100 kbps. Can the link carry all 10?',
      steps:[
        {label:'STEP 1 — TOTAL DEMAND', math:'10 x 100 kbps = 1000 kbps', note:'Stations multiplied by per-station need'},
        {label:'STEP 2 — LINK CAPACITY', math:'1 Mbps = 1000 kbps', note:'Convert the link rate to the same units'},
        {label:'STEP 3 — COMPARE', math:'1000 vs 1000 kbps', note:'Demand exactly equals capacity'},
        {label:'STEP 4 — CONTENTION COST', math:'Collisions make it < 100%', note:'Every collision wastes a slot'},
        {label:'ANSWER', math:'No — not in practice', note:'Shared links need headroom for collisions'}
      ]
    },
    solveExplain:[
      {h:'Why units must match', t:'1 Mbps = 1000 kbps. Mixing bits with bytes, or M with k, is the commonest arithmetic slip in this unit.'},
      {h:'The hidden cost', t:'The numbers look exactly balanced, but every collision retransmits a frame. Real capacity sits well below 1000 kbps.'},
      {h:'Design lesson', t:'Shared media are always provisioned below peak so contention never saturates the link.'}
    ],
    life:[
      {ic:'📺', h:'Smart TV streaming', t:'Your TV pulls 4K frames over WiFi — layer 2 reframes and checks every chunk before it is handed up.'},
      {ic:'🏧', h:'ATM withdrawal', t:'The ATM reaches the bank server over a link that error-checks each hop before moving on.'},
      {ic:'🚗', h:'Car Bluetooth', t:'Your phone and the car exchange framed messages over a short personal-area link.'},
      {ic:'📞', h:'Video call', t:'Every frame leaves your laptop through a WiFi link before it crosses the world.'},
      {ic:'🖨️', h:'Office printer', t:'The printer has its own MAC address, and layer 2 delivers frames addressed to it.'},
      {ic:'🏭', h:'Factory machines', t:'Sensors stream tiny frames over wired links where a single loss is unacceptable.'}
    ],
    lifeExplain:[
      {h:'Layer 2 is everywhere', t:'Any cable, WiFi link or Bluetooth connection you see is running framing and error checking underneath.'},
      {h:'Why you never notice it', t:'It is reliable enough to be invisible. The moment it fails, all you register is "the internet is down".'}
    ],
    history:[
      {yr:'1971', h:'ARPANET goes live', t:'The first host-to-host link had to solve exactly this: framing and error control over one wire.'},
      {yr:'1974', h:'Ethernet specified', t:'IEEE 802.3 fixed CSMA/CD and the 48-bit MAC address as the link-layer standard.'},
      {yr:'1980s', h:'Token Ring', t:'An alternative that removed collisions by passing a token as the right to transmit.'},
      {yr:'1990s', h:'Fast Ethernet', t:'100 Mbps then 1 Gbps shrank the collision domain and made it cheap to manage.'},
      {yr:'2000s', h:'WiFi needs CSMA/CA', t:'A radio cannot listen while transmitting, so WiFi avoids collisions instead of detecting them.'},
      {yr:'Today', h:'Full-duplex switching', t:'Modern switched Ethernet made collisions structurally impossible on wired links.'}
    ],
    historyExplain:[
      {h:'Why collision detection failed on WiFi', t:'A radio cannot hear itself while transmitting. So WiFi moved from CSMA/CD to CSMA/CA — avoid, do not detect.'},
      {h:'The trend', t:'Every generation moved toward full-duplex switched links, where collisions no longer exist at all.'}
    ],
    flash:[
      {q:'What are the five data link layer services?', a:'Framing, physical addressing, error control, flow control and access control.'},
      {q:'How long is a MAC address?', a:'48 bits, written as six hex bytes such as A2:4B:7C:11:22:33.'},
      {q:'Which layer error-checks each individual link?', a:'The data link layer — layer 2.'},
      {q:'What is a frame?', a:'The link-layer unit: a header, a payload, and a trailer such as a CRC.'},
      {q:'What does framing do?', a:'It delimits the bit stream into frames so the receiver can find every frame boundary.'},
      {q:'Why does layer 2 need access control?', a:'On a shared link several stations transmit, so something must decide who goes when.'},
      {q:'Is a MAC address the same as an IP address?', a:'No. MAC identifies a node on one link; IP identifies a host across networks.'},
      {q:'What is flow control at layer 2?', a:'Stopping a fast sender from overwhelming a slow receiver.'}
    ],
    flashExplain:[
      {h:'Active recall', t:'Say the answer out loud before flipping. Hesitation means the card goes back in the deck.'},
      {h:'Spaced repetition', t:'Review after 1 day, 3 days, then 7 days. That spacing is what makes it stick.'}
    ],
    exam:[
      {q:'List the services provided by the data link layer.', a:'(i) Framing, (ii) physical addressing with MAC addresses, (iii) error control, (iv) flow control, (v) access control.'},
      {q:'Differentiate the data link layer from the transport layer.', a:'Layer 2 works over a single hop using MAC addresses and frames; layer 4 works end to end using IP plus port numbers and segments. Layer 2 repairs each link, layer 4 guarantees process-to-process delivery.'},
      {q:'Why does the data link layer exist when the physical layer already moves bits?', a:'The physical layer offers no error guarantee and no notion of message boundaries. Layer 2 adds framing, addressing and error detection to make the link usable.'},
      {q:'What is the role of a MAC address?', a:'It is the link-layer address used to deliver a frame to the correct node on the local link.'},
      {q:'Explain full-duplex versus half-duplex transmission.', a:'In full-duplex both nodes transmit simultaneously; in half-duplex only one node may transmit at a time, so the other must wait.'}
    ],
    examExplain:[
      {h:'Marks pattern', t:'List questions are 5 marks — one per service. Comparisons are 5 marks: give the scope first, then the mechanism.'},
      {h:'Define before you differ', t:'Write one clean line per layer, then state the difference. Examiners reward scope words like "single hop" and "end to end".'},
      {h:'Common mistake', t:'Claiming layer 2 guarantees delivery. It only guarantees the single hop it controls.'}
    ],
    eli5:{
      kid:'Imagine you pass notes in class. The teacher needs to know where one note ends and the next begins — layer 2 sticks a label at the start and end of every note. And if a note gets wet and smudged, layer 2 says "this one is spoiled" instead of making you copy it all again.',
      middle:'The data link layer takes the raw bit stream from the physical layer and turns it into framed, addressed, error-checked messages for one single link. It offers five services: framing, physical addressing, flow control, error control and access control. The MAC address belongs to that link only — it is not the IP address.',
      engg:'The data link layer provides hop-to-hop delivery across a single physical link. Its five services are framing (delimiting boundaries by character count, byte or bit stuffing, or physical coding), physical addressing via 48-bit MAC addresses, error control (parity, checksum or CRC), flow control (stop-and-wait or sliding window) and access control (ALOHA, CSMA/CD, CSMA/CA or token passing). It is strictly local: MAC addresses are never routed and end-to-end reliability belongs to the transport layer.'
    },
    eli5Explain:[
      {h:'Why three levels', t:'One idea pitched at a child, a student and an engineer. Depth builds by reading the same concept at three altitudes.'},
      {h:'How to use it', t:'Kid level for intuition, middle for the working definition, then engg for the exam vocabulary.'}
    ]
  },

/* ==========================================================
     FRAMING — how a bit stream gets marked into frames
     ========================================================== */
  'framing': {
    crash:[
      { tag:'THE PROBLEM', text:"Physical layer oru bit stream-a kuduthu kattu vidunga — theriyadhu end frame, start frame enga. Boundary theriyadanum!", visual:`<div style="text-align:center"><div style="color:#ef4444;font-size:11px;font-weight:800;margin-bottom:10px">one endless bit stream</div><div style="font-size:20px;font-weight:800;letter-spacing:4px;color:#6b7280">1011011100101110</div><div style="color:#2dd4bf;font-size:11px;margin-top:12px">&#8594; where does a frame start?</div></div>`, readMs:5000 },
      { tag:'METHOD 1 — CHARACTER COUNT', text:"Header-la frame length-a vechirakottu sollunga. Simple-a, but count corrupt aayidum na, next frame eppo start aagano theriyadhu.", visual:`<div style="text-align:center"><div style="display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap"><div style="padding:9px 12px;border-radius:8px;background:#a78bfa;color:#000;font-size:10px;font-weight:800">COUNT 4</div><div style="padding:9px 12px;border-radius:8px;border:1px solid #2dd4bf;color:#e2e8f0;font-size:10px">ABCD</div><div style="padding:9px 12px;border-radius:8px;background:#a78bfa;color:#000;font-size:10px;font-weight:800">COUNT 3</div><div style="padding:9px 12px;border-radius:8px;border:1px solid #2dd4bf;color:#e2e8f0;font-size:10px">EFG</div></div><div style="color:#ef4444;font-size:10px;margin-top:10px">a garbled count desynchronises everything after it</div></div>`, readMs:5400 },
      { tag:'METHOD 2 — BYTE STUFFING', text:"Frame flag bytes-a start-a end-a vechirakku. Data la flag varathum, escape byte (ESC) insert pannu — receiver destuff pannum.", visual:`<div style="text-align:center"><div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap"><div style="padding:8px 10px;border-radius:6px;background:#facc15;color:#000;font-size:10px;font-weight:800">FLAG</div><div style="padding:8px 10px;border-radius:6px;border:1px solid #2dd4bf;color:#e2e8f0;font-size:10px">A</div><div style="padding:8px 10px;border-radius:6px;background:#a78bfa;color:#000;font-size:10px;font-weight:800">ESC</div><div style="padding:8px 10px;border-radius:6px;background:#facc15;color:#000;font-size:10px;font-weight:800">FLAG</div><div style="padding:8px 10px;border-radius:6px;border:1px solid #2dd4bf;color:#e2e8f0;font-size:10px">B</div><div style="padding:8px 10px;border-radius:6px;background:#facc15;color:#000;font-size:10px;font-weight:800">FLAG</div></div><div style="color:#6b7280;font-size:10px;margin-top:12px">ESC before FLAG = "this is data, not a delimiter"</div></div>`, readMs:5600 },
      { tag:'METHOD 3 — BIT STUFFING', text:"Byte values alla, raw bits-a oru pattern (five 1s) use pannu. Data la ila pattern varathum, ekka 0 insert pannu.", visual:`<div style="text-align:center"><div style="font-family:monospace;font-size:14px;font-weight:800;color:#e2e8f0;letter-spacing:3px">1 1 1 1 1 1</div><div style="color:#2dd4bf;font-size:13px;margin:8px 0">&#8595; insert a 0</div><div style="font-family:monospace;font-size:14px;font-weight:800;letter-spacing:3px;color:#22c55e">1 1 1 1 1 <span style="color:#a78bfa">0</span> 1</div><div style="color:#6b7280;font-size:10px;margin-top:12px">the receiver always removes the 0 after five 1s</div></div>`, readMs:5800 },
      { tag:'METHOD 4 — PHYSICAL CODING', text:"Valid data la occur aagadha code combination-a delimiter maari use pannu — e.g. bipolar encoding-a high-high-high end-marker.", visual:`<div style="text-align:center;display:flex;gap:20px;justify-content:center;flex-wrap:wrap"><div><div style="font-size:11px;color:#22c55e;font-weight:800">VALID DATA</div><div style="font-size:13px;letter-spacing:2px;color:#2dd4bf">+ - + - +</div></div><div style="font-size:12px;color:#facc15;font-weight:800;margin-top:14px">&#8594;</div><div><div style="font-size:11px;color:#ef4444;font-weight:800">IMPOSSIBLE</div><div style="font-size:13px;letter-spacing:2px;color:#ef4444">+ + +</div><div style="font-size:10px;color:#6b7280;margin-top:4px">use as END</div></div></div>`, readMs:5200 },
      { tag:'ONE LINE', text:"Count, byte stuffing, bit stuffing, physical coding — ellaam oru veledu: where does one frame end and the next begin?", visual:`<div style="text-align:center"><div style="font-size:52px">🎯</div><div style="color:#2dd4bf;font-weight:900;font-size:14px;margin-top:12px;padding:14px 20px;background:rgba(45,212,191,.08);border:2px dashed rgba(45,212,191,.4);border-radius:14px;line-height:1.7;max-width:460px">Count · Byte Stuffing<br>Bit Stuffing · Physical Coding</div></div>`, readMs:5000 }
    ],
    crashExplain:[
      {h:'Why framing comes first', t:'Everything else at layer 2 needs frames to exist. You cannot check or address a unit whose edges you cannot find.'},
      {h:'The core difficulty', t:'Data is arbitrary, so the delimiter pattern can appear naturally inside it. Every good method must escape or forbid that case.'},
      {h:'Common trap', t:'Students pick character count because it is simplest. It is the weakest — one bit flip desynchronises everything downstream.'}
    ],
    compare:{
      left:'Byte Stuffing', right:'Bit Stuffing',
      rows:[
        ['Delimiting unit','8-bit flag bytes','A single bit pattern such as 11111'],
        ['Escape mechanism','ESC byte before a flag','A 0 bit after five 1s'],
        ['Works with','8-bit character codes','Any data, including 16-bit UNICODE'],
        ['Efficiency','Worse — extra bytes','Better — inserts only when needed'],
        ['Found in','Older character protocols','HDLC and PPP — modern protocols']
      ],
      bars:[
        {label:'Generality', leftPct:35, rightPct:100, leftTxt:'8-bit only', rightTxt:'Any size'},
        {label:'Overhead', leftPct:80, rightPct:30, leftTxt:'High', rightTxt:'Low'},
        {label:'Implementation', leftPct:60, rightPct:45, leftTxt:'Bytewise', rightTxt:'Bitwise'},
        {label:'Modern use', leftPct:20, rightPct:100, leftTxt:'Rare', rightTxt:'HDLC, PPP'}
      ]
    },
    compareExplain:[
      {h:'The one line answer', t:'Byte stuffing escapes a whole byte; bit stuffing escapes a bit. Bit stuffing is more general and adds less overhead, which is why it won.'},
      {h:'Why 8-bit was a real limitation', t:'UNICODE uses 16-bit characters. Byte stuffing tied to 8-bit flags could not represent them cleanly, forcing a new technique.'},
      {h:'How to spot it in a question', t:'Mention of ESC or flag bytes means byte stuffing. Mention of five consecutive 1s means bit stuffing.'}
    ],
    solve:{
      q:'The sender must transmit the bytes A, FLAG, B using byte stuffing. What goes on the wire and what does the receiver deliver?',
      steps:[
        {label:'STEP 1 — OPEN', math:'FLAG | A', note:'Frame starts with a real flag byte'},
        {label:'STEP 2 — SPOT THE PROBLEM', math:'FLAG occurs in the payload', note:'It must not be read as the end'},
        {label:'STEP 3 — STUFF', math:'FLAG A ESC FLAG B', note:'Insert ESC before the data flag'},
        {label:'STEP 4 — CLOSE', math:'... B FLAG', note:'Real closing flag, no ESC before it'},
        {label:'ANSWER', math:'Receiver gets A, FLAG, B', note:'Round trip is lossless'}
      ]
    },
    solveExplain:[
      {h:'Why ESC is needed', t:'Without ESC the receiver would read the payload flag as the end of the frame and hand over only "A", losing FLAG and B.'},
      {h:'The doubling rule', t:'A single ESC means an escape sequence follows. A doubled ESC means one literal ESC occurred in the original data.'},
      {h:'Why the round trip matters', t:'After de-stuffing the receiver gets exactly the bytes that were sent — nothing added, nothing lost.'}
    ],
    life:[
      {ic:'📧', h:'Email attachments', t:'Attachments hold arbitrary bytes, so the framing layer escapes anything that resembles a delimiter.'},
      {ic:'💾', h:'File download', t:'A zip or pdf is raw binary — a naive delimiter scan would split it at the wrong place.'},
      {ic:'🖨️', h:'Print job', t:'The printer receives framed data, and ESC sequences mark where pages and formatting begin.'},
      {ic:'📞', h:'VoIP call', t:'Every voice packet is framed so the receiver knows where each block of samples starts.'},
      {ic:'🎮', h:'Online game', t:'Position updates arrive as discrete frames, each delimited and checksummed.'},
      {ic:'🏧', h:'ATM response', t:'Bank responses are framed so a truncated message is detected rather than half-processed.'}
    ],
    lifeExplain:[
      {h:'Framing is what makes binary safe', t:'Without it any random byte stream would be ambiguous. Framing is why an image can travel over a text link.'},
      {h:'You already depend on it', t:'Every file you download relies on correct framing end to end. One desync corrupts the whole file.'}
    ],
    history:[
      {yr:'1960s', h:'Character-oriented links', t:'Early protocols were tied to 8-bit character codes, so framing had to be byte based.'},
      {yr:'1970s', h:'HDLC bit stuffing', t:'High-Level Data Link Control adopted the five-ones rule so any bit pattern could be framed safely.'},
      {yr:'1980s', h:'PPP standardises it', t:'Point-to-Point Protocol reused HDLC framing, which is why dial-up and PPPoE links behave this way.'},
      {yr:'1990s', h:'16-bit codes appear', t:'UNICODE and other wide character sets exposed the 8-bit limitation of byte stuffing.'},
      {yr:'2000s', h:'High-speed links', t:'SONET and Ethernet used physical coding violations as delimiters instead of escaped bytes.'},
      {yr:'Today', h:'Bit stuffing dominates', t:'HDLC framing persists in PPP and older WAN links; Ethernet moved to a length field plus a preamble.'}
    ],
    historyExplain:[
      {h:'The direction of travel', t:'Each generation removed escaping overhead: explicit counts, then byte escapes, then bit escapes, then simply declaring a length.'},
      {h:'Why Ethernet is different', t:'Modern Ethernet does not stuff bits at all. An explicit length field plus a preamble is cheaper at high speed.'}
    ],
    flash:[
      {q:'Why does the data link layer need framing?', a:'The physical layer delivers an undelimited bit stream, so frames must be marked out before anything else can work.'},
      {q:'What is the weakness of the character count method?', a:'If the count field is corrupted, the receiver loses sync and cannot find the next frame boundary.'},
      {q:'What does byte stuffing do?', a:'It inserts an ESC byte before any flag byte appearing in the data so the receiver can tell data from delimiter.'},
      {q:'What does bit stuffing do?', a:'After five consecutive 1 bits it inserts a 0, and the receiver always removes that 0.'},
      {q:'Which method allows any character size?', a:'Bit stuffing, because it works on bits rather than 8-bit bytes.'},
      {q:'Which protocols use bit stuffing?', a:'HDLC and PPP.'},
      {q:'What is physical coding framing?', a:'Using a code combination that cannot occur in valid data as a delimiter, such as high-high-high in bipolar encoding.'},
      {q:'Why combine framing methods?', a:'For safety: the count locates the end, but the delimiter and checksum must also match before the frame is accepted.'}
    ],
    flashExplain:[
      {h:'Active recall', t:'Say the method and its escape rule out loud before flipping. Hesitation means the card stays in the deck.'},
      {h:'Link them as a ladder', t:'Count, byte, bit, code — the same idea at four levels of granularity. Remembering the ladder beats memorising four separate facts.'}
    ],
    exam:[
      {q:'Explain the character count method of framing and state its main drawback.', a:'The frame header stores the number of characters in the frame so the receiver knows where it ends. The drawback is that an error in the count field desynchronises the receiver; it cannot locate the start of the next frame even after detecting the bad frame.'},
      {q:'Explain byte stuffing with an example.', a:'Each frame begins and ends with flag bytes. If a flag byte occurs in the data an ESC byte is inserted before it, and on receipt the receiver removes the ESC preceding a flag. A doubled ESC represents one literal ESC in the original data.'},
      {q:'Explain bit stuffing.', a:'After five consecutive 1 bits the sender inserts a 0 bit, and the receiver removes any 0 that immediately follows five 1s. This makes the flag pattern impossible to produce accidentally and permits frames of arbitrary-size data.'},
      {q:'Why is byte stuffing unsuitable for UNICODE?', a:'It is tied to 8-bit flag bytes while UNICODE uses 16-bit characters, so a technique handling arbitrary character sizes was needed — bit stuffing.'},
      {q:'What is physical coding framing?', a:'Using a bit pattern that cannot occur in valid data as a frame delimiter, for example consecutive high voltages in bipolar encoding that valid data never produces.'}
    ],
    examExplain:[
      {h:'Marks pattern', t:'Framing questions are usually 5 marks: define it, give the rule, give an example, then state the drawback.'},
      {h:'Always give an example', t:'An example earns the application marks. Use A, FLAG, B and show the ESC inserted — that demonstrates the rule rather than quoting it.'},
      {h:'Common mistake', t:'Describing the method without saying what happens on an error. Examiners want the failure behaviour stated explicitly.'}
    ],
    eli5:{
      kid:'Imagine a long roll of paper covered in writing, with no spaces. You could never tell where one letter ended and the next began. So you tie a ribbon at the start and end of each letter. If the word "ribbon" happens to appear inside your writing, you draw an extra squiggle before it so nobody gets confused. That squiggle is the escape.',
      middle:'Framing means marking the boundaries of each frame inside a continuous bit stream. Four methods exist. Character count stores the length in a header but breaks if that count is corrupted. Byte stuffing escapes flag bytes with an ESC byte. Bit stuffing inserts a 0 after five consecutive 1s. Physical coding uses a pattern that valid data cannot produce. All four make the boundary unambiguous.',
      engg:'Framing delimits frames within a continuous bit stream. Character count is simple but fragile, since a corrupted count desynchronises the receiver permanently. Byte stuffing escapes flag bytes with an ESC byte and supports only 8-bit character codes, excluding UNICODE. Bit stuffing inserts a 0 bit after five consecutive 1s, making the delimiter unproducible while supporting arbitrary data widths; HDLC and PPP use it. Physical coding framing exploits code violations such as consecutive high levels in bipolar encoding. Production protocols often combine methods: a length field locates the end, and the frame is accepted only if the expected delimiter is present and the checksum matches.'
    },
    eli5Explain:[
      {h:'The unifying idea', t:'All four solve one problem: data is arbitrary, so the delimiter can appear inside it. Count declares it, stuffing escapes it, coding forbids it.'},
      {h:'How to revise fast', t:'Remember the ladder — count, byte, bit, code — and ask at each rung: what happens if the delimiter appears naturally in the data?'}
    ]
  }

});

/* ==========================================================
     ERROR DETECTION — parity, 2D parity, checksum, CRC
     ========================================================== */
Object.assign(window.XC.VAATHIYAR, {

  'error-detection': {
    crash:[
      { tag:'THE PROBLEM', text:"Signal attenuate aagum, noise varum. Receiver-ku theriyadanum — oru bit flip aayindha? Illa? Checking illatti bits kelavum madi aagum.", visual:`<div style="text-align:center"><div style="font-family:monospace;font-size:17px;font-weight:800;color:#22c55e;letter-spacing:3px">0 1 1 0 1 1 0 1</div><div style="color:#ef4444;font-size:12px;margin:8px 0">one bit flips in transit</div><div style="font-family:monospace;font-size:17px;font-weight:800;color:#ef4444;letter-spacing:3px">0 1 1 0 1 1 0 0</div><div style="color:#2dd4bf;font-size:11px;margin-top:12px">&#8594; add redundancy so the receiver can notice</div></div>`, readMs:5200 },
      { tag:'METHOD 1 — PARITY BIT', text:"One extra bit add pannu, total 1s even-aakum (even parity) illa odd-aakum (odd parity) nu set pannu. Receiver recount pannum — mismatch na error.", visual:`<div style="text-align:center"><div style="font-family:monospace;font-size:15px;font-weight:800;color:#e2e8f0;letter-spacing:2px">1 0 1 1 0 <span style="color:#a78bfa">?</span></div><div style="display:flex;gap:10px;justify-content:center;margin-top:12px;flex-wrap:wrap"><div style="padding:8px 12px;border-radius:8px;border:1px solid #22c55e;color:#22c55e;font-size:10px;font-weight:800">EVEN: add 1<br><span style="color:#9ca3af">3 ones, make 4</span></div><div style="padding:8px 12px;border-radius:8px;border:1px solid #facc15;color:#facc15;font-size:10px;font-weight:800">ODD: add 0<br><span style="color:#9ca3af">3 ones, keep odd</span></div></div></div>`, readMs:5400 },
      { tag:'WEAKNESS OF PARITY', text:"One bit error-a detect pannum. Aan double error (two bits flip) — parity correct-aa irundhu miss aagum. Adhu paritta weakness.", visual:`<div style="text-align:center;display:flex;gap:16px;justify-content:center;flex-wrap:wrap"><div style="padding:12px;border:2px solid #22c55e;border-radius:10px;text-align:center;min-width:120px"><div style="font-size:22px">1</div><div style="color:#22c55e;font-size:10px;font-weight:800;margin-top:6px">1 BIT ERROR</div><div style="color:#9ca3af;font-size:9px;margin-top:3px">detected</div></div><div style="padding:12px;border:2px solid #ef4444;border-radius:10px;text-align:center;min-width:120px"><div style="font-size:22px">2</div><div style="color:#ef4444;font-size:10px;font-weight:800;margin-top:6px">2 BIT ERROR</div><div style="color:#9ca3af;font-size:9px;margin-top:3px">MISSED</div></div></div>`, readMs:5400 },
      { tag:'METHOD 2 — 2D PARITY', text:"Data-a grid-la vechirakku, rows-kkum columns-kkum oru parity bit add pannu. Double error-a pattern change aagum, so thervum.", visual:`<div style="text-align:center"><div style="display:inline-block;font-family:monospace;font-size:12px;font-weight:800;letter-spacing:1px"><div style="background:#111a2e;padding:3px 8px;display:inline-block;color:#e2e8f0">1 0 1 <span style="color:#a78bfa">1</span></div><br><div style="background:#111a2e;padding:3px 8px;display:inline-block;color:#e2e8f0">0 1 1 <span style="color:#a78bfa">0</span></div><br><div style="background:#111a2e;padding:3px 8px;display:inline-block;color:#e2e8f0">1 1 0 <span style="color:#a78bfa">1</span></div><br><div style="background:#111a2e;padding:3px 8px;display:inline-block;color:#facc15">0 0 0 0</div></div><div style="color:#9ca3af;font-size:10px;margin-top:10px">purple = row parity &middot; yellow = column parity</div></div>`, readMs:5600 },
      { tag:'METHOD 3 — CHECKSUM', text:"Data-a 16-bit la vechirakku, 1s complement sum-a 2s complement vechirakku add pannu; sum-a end-a takkanum complement pannu.", visual:`<div style="text-align:center;font-family:monospace;font-size:12px;font-weight:800;line-height:1.9"><div style="color:#e2e8f0">1001 0110 0011 1000</div><div style="color:#a78bfa">0111 1001 1000 1101</div><div style="border-top:1px solid #6b7280;padding-top:4px;color:#facc15">1 001 0000 0000 0101</div><div style="color:#22c55e;margin-top:8px">1s complement: 0110 1111 1111 1010</div></div>`, readMs:5600 },
      { tag:'METHOD 4 — CRC (BEST)', text:"Data-a polynomial-a treat pannu, divide pannu, remainder-a CRC bit-a maattu add pannu. Receiver-la divide pannum — remainder 0 na clean.", visual:`<div style="text-align:center"><div style="font-family:monospace;font-size:14px;font-weight:800;color:#e2e8f0">1101011011</div><div style="color:#a78bfa;font-size:11px;margin:6px 0">&#247; 1011 (x&#179; + x + 1)</div><div style="color:#22c55e;font-size:13px;font-weight:800">remainder = 100</div><div style="color:#9ca3af;font-size:10px;margin-top:10px">divide again on receipt: remainder 0 = no error</div></div>`, readMs:5800 },
      { tag:'ONE LINE', text:"Redundancy vechirakku error-a theriyanum. Parity cheapest, CRC most reliable — ellaam same purpose, different strength.", visual:`<div style="text-align:center"><div style="font-size:52px">🎯</div><div style="color:#2dd4bf;font-weight:900;font-size:14px;margin-top:12px;padding:14px 20px;background:rgba(45,212,191,.08);border:2px dashed rgba(45,212,191,.4);border-radius:14px;line-height:1.7;max-width:460px">Parity &#8594; 2D &#8594; Checksum &#8594; CRC</div></div>`, readMs:5000 }
    ],
    crashExplain:[
      {h:'The shared idea', t:'All four send extra bits whose value is fixed by the data. The receiver recomputes and compares. A mismatch proves corruption.'},
      {h:'Why CRC won', t:'CRC catches all single-bit errors, all double-bit errors and all odd numbers of bit errors, using a fixed 32-bit field. Parity catches far less.'},
      {h:'Detection versus correction', t:'CRC detects but cannot say WHICH bit flipped. Hamming code, the next topic, adds enough redundancy to correct as well as detect.'}
    ],
    compare:{
      left:'Parity', right:'CRC',
      rows:[
        ['Extra bits','1 bit','r bits, usually 16 or 32'],
        ['Catches','Odd numbers of bit errors','All 1, 2 and odd counts of bit errors'],
        ['Math used','Count the 1s','Binary polynomial division'],
        ['Cost','Almost free','Modulo-2 hardware, cheap in practice'],
        ['Used for','Simple memory and ASCII transfers','Ethernet, WiFi, ZIP, PNG — nearly everything']
      ],
      bars:[
        {label:'Detection power', leftPct:25, rightPct:100, leftTxt:'Weak', rightTxt:'Near perfect'},
        {label:'Overhead', leftPct:10, rightPct:35, leftTxt:'1 bit', rightTxt:'32 bits'},
        {label:'Implementation', leftPct:15, rightPct:70, leftTxt:'Count 1s', rightTxt:'Polynomial divide'},
        {label:'Can correct?', leftPct:5, rightPct:10, leftTxt:'No', rightTxt:'No'}
      ]
    },
    compareExplain:[
      {h:'The crucial weakness', t:'Parity detects single-bit errors but misses any even number of bit errors, including two. That is fatal on a noisy link.'},
      {h:'Why CRC is everywhere', t:'CRC is effectively free in hardware — a shift register and XOR gates — so there was never a reason to use parity for real data.'},
      {h:'Neither can correct', t:'Both detect only. To locate and fix the bad bit you must add more redundancy, which is exactly what Hamming codes do.'}
    ],
    solve:{
      q:'Transmit the 8-bit message 10110110 with even parity. What goes on the wire, and what does the receiver conclude if it reads 10111110?',
      steps:[
        {label:'STEP 1 — COUNT ONES', math:'1 0 1 1 0 1 1 0 = 5 ones', note:'Count the data bits'},
        {label:'STEP 2 — EVEN PARITY', math:'Total ones must be even', note:'Even parity means an even count'},
        {label:'STEP 3 — ADD THE BIT', math:'5 is odd, so append 1', note:'5 + 1 = 6, now even'},
        {label:'STEP 4 — TRANSMIT', math:'10110110 1', note:'Nine bits go on the wire'},
        {label:'ANSWER', math:'Receiver accepts it — wrongly', note:'Received 6 ones = even, so it looks valid'}
      ]
    },
    solveExplain:[
      {h:'Why parity missed it', t:'A 0 became a 1 in the data (odd change) and the parity bit 1 became 0 (odd change). Two odd changes sum to an even change.'},
      {h:'What the receiver sees', t:'Six ones, which is even, so the check passes even though a bit is wrong. This is the classic undetectable double error.'},
      {h:'The lesson', t:'Parity is only safe on links where a double error is effectively impossible. Anything noisier needs CRC or Hamming.'}
    ],
    life:[
      {ic:'📶', h:'WiFi frames', t:'Every WiFi frame carries a CRC the receiver checks before passing it up the stack.'},
      {ic:'💿', h:'CD and DVD', t:'Disc sectors carry a CRC so a scratch cannot silently corrupt your movie.'},
      {ic:'🗜️', h:'ZIP archives', t:'Each entry has a CRC-32, which is why a corrupt archive tells you exactly which file failed.'},
      {ic:'🖼️', h:'PNG images', t:'A CRC per chunk catches a truncated or corrupted download before you see a broken picture.'},
      {ic:'🧠', h:'ECC memory', t:'Server RAM stores extra Hamming bits so a cosmic ray can be corrected, not merely detected.'},
      {ic:'🔌', h:'Ethernet', t:'Every frame ends in a 32-bit FCS, the reason a damaged frame is dropped instead of delivered.'}
    ],
    lifeExplain:[
      {h:'You rely on this daily', t:'Every file download and every video stream is protected by CRC. Corrupt data rarely reaches your application.'},
      {h:'Detection saves bandwidth', t:'Discarding a corrupt frame is far cheaper than asking the sender to retransmit it. That is why detect comes before correct.'}
    ],
    history:[
      {yr:'1940s', h:'Parity in early machines', t:'Parity checks were added to punch-card and early computer memory to catch hardware faults.'},
      {yr:'1950', h:'Hamming code', t:'Richard Hamming introduced the first code able to correct a single-bit error, for Bell relay machines.'},
      {yr:'1970s', h:'Ethernet picks CRC', t:'IEEE 802.3 adopted a 32-bit CRC in every frame from the very first standard.'},
      {yr:'1980s', h:'CRC in storage', t:'Disk drives adopted CRC so a read returning bad data would be reported instead of silently trusted.'},
      {yr:'1990s', h:'CRC-32 standardised', t:'ZIP, PNG and many file formats adopt CRC-32, making it the most widely used checksum in history.'},
      {yr:'Today', h:'ECC everywhere', t:'Servers, aircraft and cars use Hamming-based ECC memory and bus codes, not just detection but live correction.'}
    ],
    historyExplain:[
      {h:'Why Ethernet chose CRC', t:'Correcting a frame would need far more redundant bits, slowing every link. Detect-and-drop was the better trade.'},
      {h:'The modern shift', t:'When corruption is expensive to retry — memory, satellite, deep space — correction pays off, so ECC became standard.'}
    ],
    flash:[
      {q:'What problem does error detection solve?', a:'It lets the receiver notice that a transmitted frame was corrupted, so bad data is never delivered silently.'},
      {q:'How does parity work?', a:'One extra bit is chosen so the total number of 1s is even or odd. The receiver recounts and compares.'},
      {q:'What is the fatal weakness of parity?', a:'It misses any even number of bit errors, because those preserve the parity.'},
      {q:'How does 2D parity improve things?', a:'Parity is added across rows and columns, so a double error changes the parity pattern and becomes detectable.'},
      {q:'How does a checksum work?', a:'Split the data into 16-bit words, sum them using 1s complement, and transmit the complemented sum.'},
      {q:'How does CRC work?', a:'Treat the data as a polynomial, divide by a generator polynomial, and transmit the remainder. A nonzero remainder means an error.'},
      {q:'Which method do Ethernet and ZIP use?', a:'CRC — both use CRC-32.'},
      {q:'Can CRC correct an error?', a:'No. CRC detects only. Hamming codes add enough extra bits to also locate and correct.'}
    ],
    flashExplain:[
      {h:'Know the ordering', t:'Parity, 2D parity, checksum, CRC — each step adds more redundancy and more detection power. That ladder is the whole topic.'},
      {h:'Detect versus correct', t:'If you remember one distinction, make it this one. Detection is cheap; correction needs far more redundancy.'}
    ],
    exam:[
      {q:'Explain simple parity and state why two-bit errors go undetected.', a:'Parity adds one bit so the total number of 1s is even or odd. Flipping one bit changes the count by one and breaks the check. Flipping two bits changes the count by two, so parity is restored and the error passes undetected.'},
      {q:'Explain two-dimensional parity.', a:'Data is arranged in a grid. One parity bit is added to each row and one to each column. A single-bit error is located by finding the row and column whose checks fail. It also catches most double-bit errors, which simple parity misses.'},
      {q:'Explain the internet checksum.', a:'The data is split into 16-bit words, summed using 1s complement arithmetic by adding the 2s complement of each word, and the result is complemented and transmitted. At the receiver the sum of everything including the checksum must be all 1s.'},
      {q:'Explain the CRC frame check sequence.', a:'The sender treats the frame as a polynomial, divides it by a generator polynomial using modulo-2 arithmetic, and appends the r-bit remainder as the frame check sequence. The receiver divides the whole frame; a remainder of zero means no error, any other remainder means discard.'},
      {q:'Which error detection method do you use for real data and why?', a:'CRC. It detects all single-bit and double-bit errors and all odd numbers of bit errors, costs only a fixed 16 or 32 bits, and is cheap to compute with a shift register.'}
    ],
    examExplain:[
      {h:'Marks pattern', t:'Each method question is usually 5 marks: define it, show the rule with a small example, then state its weakness.'},
      {h:'The weakness is the marks', t:'Most of the marks are for stating what each method CANNOT do. Examiners want parity double-error blind spot stated explicitly.'},
      {h:'Common mistake', t:'Claiming CRC corrects errors. Detection and correction are different, and only Hamming codes do both.'}
    ],
    eli5:{
      kid:'Imagine you shout a long sentence across a field. The wind might change one letter and you would never know. So before you shout, you count your letters and add one extra letter that makes the count even. If your friend counts and gets an odd number, they know the wind changed something. But if the wind changed two letters, the count is even again and they get fooled — so for real messages we use a stronger check.',
      middle:'Error detection adds extra bits whose value depends on the data. Parity adds one bit so the count of 1s is even or odd, and it misses errors that flip an even number of bits. Two-dimensional parity adds parity across rows and columns, so most double errors become visible. A checksum adds 16-bit words using 1s complement arithmetic. CRC is the strongest and most widely used: it divides the data as a polynomial and appends the remainder, catching all single, double and odd-numbered bit errors.',
      engg:'Error detection appends redundancy derived from the data so the receiver can detect corruption. Simple parity uses one bit and detects only odd numbers of bit errors. Two-dimensional parity adds row and column parity, locating single-bit errors and detecting most double-bit errors. The internet checksum sums 16-bit words in 1s complement arithmetic. CRC treats the frame as a polynomial, performs modulo-2 division by a generator polynomial, and appends the r-bit remainder as the frame check sequence; a zero remainder on receipt proves no error. CRC-32 is used by Ethernet, ZIP and PNG. All of these detect only — correction requires the greater redundancy of Hamming codes, as in ECC memory.'
    },
    eli5Explain:[
      {h:'The single idea underneath', t:'Send something that is true only if the data arrived intact. The receiver recomputes it and compares. That is all four methods.'},
      {h:'Why CRC is the default', t:'It is almost free to compute in hardware and misses almost every realistic error, so no reason remains to use anything weaker.'}
    ]
  }

});

/* ---------- Rest of Unit II: error CORRECTION, flow control, access ---------- */
Object.assign(window.XC.VAATHIYAR, {

  'hamming': {
    crash:[
      { tag:'THE PROBLEM', text:"Parity and CRC can only DETECT an error. They tell you \"something is wrong\" but not WHICH bit. Hamming code goes one step further — it can actually FIX the bit for you.", visual:`<div style="text-align:center"><div style="font-size:66px">🩹</div><div style="color:#f472b6;font-weight:900;font-size:18px;margin-top:14px">DETECT vs CORRECT</div><div style="color:#94a3b8;font-size:12px;margin-top:10px">Parity says \"wrong\". Hamming says \"bit 3 is wrong\".</div></div>`, readMs:5200 },
      { tag:'THE IDEA', text:"Put the data bits at positions 1,2,4,8 and leave 2,4,8,16 for parity bits. Position numbers start at 1 — that off-by-one is what makes the whole thing work.", visual:`<svg viewBox="0 0 420 120" style="width:100%;max-width:420px">${Array.from({length:8},(_,i)=>{const n=i+1,isP=[1,2,4,8].includes(n),x=22+i*50;return `<text x="${x+14}" y="42" text-anchor="middle" font-size="10" fill="#64748b">p${n}</text><rect x="${x}" y="50" width="28" height="34" rx="5" fill="${isP?'#2dd4bf':'#1e293b'}" stroke="${isP?'#2dd4bf':'#334155'}" stroke-width="2"/><text x="${x+14}" y="72" text-anchor="middle" font-size="11" fill="${isP?'#042f2e':'#e2e8f0'}" font-weight="800">${isP?'P':'D'}</text>`}).join('')}</svg>`, readMs:5600 },
      { tag:'THE RULE', text:"Every parity bit at position 2^k covers itself plus every data position whose binary index has that bit set. That's it. One rule generates all of them.", visual:`<div style="font-family:monospace;font-size:12px;color:#cbd5e1;line-height:1.9;text-align:center">P1 → 1, 3, 5, 7<br>P2 → 2, 3, 6, 7<br>P4 → 4, 5, 6, 7</div>`, readMs:5400 },
      { tag:'⚡ ONE LINE', text:"The parity bits form a binary number that points at the corrupted bit. Zero means clean.", visual:`<div style="text-align:center"><div style="color:#2dd4bf;font-weight:900;font-size:17px;padding:18px 30px;background:rgba(45,212,191,.08);border:2px dashed rgba(45,212,191,.4);border-radius:14px;max-width:520px;margin:0 auto">Syndrome = 0 → no error. Otherwise syndrome = position of the bad bit.</div></div>`, readMs:5000 }
    ],
    crashExplain:[
      {h:'Why not just use CRC', t:'CRC is cheaper to compute and catches more errors, but it can only say yes/no. Hamming spends more bits to buy the ability to repair.'},
      {h:'Why number bits from 1', t:'Position 0 would be wasted, and the syndrome must point at a real bit position. Starting at 1 makes the arithmetic line up.'},
      {h:'What it costs', t:'With m data bits you need m+1 parity bits. That overhead is why hamming code is not on the internet — it is for ECC memory, where fixing is worth more than saving bytes.'}
    ],
    compare:{
      left:'Hamming Code', right:'CRC',
      rows:[
        ['Purpose','Finds AND fixes the bad bit','Finds that something is wrong'],
        ['Extra bits','m + 1 parity bits','r-bit remainder'],
        ['On error','Corrects it in place','Requests retransmission'],
        ['Typical use','ECC RAM, satellite links','Ethernet, WiFi, ZIP, PNG']
      ],
      bars:[
        {label:'Error correction', leftPct:100, rightPct:5, leftTxt:'Fixes it', rightTxt:'Cannot'},
        {label:'Detection power', leftPct:70, rightPct:100, leftTxt:'Single + double', rightTxt:'All burst'},
        {label:'Bandwidth cost', leftPct:75, rightPct:20, leftTxt:'Heavy', rightTxt:'Light'},
        {label:'Compute cost', leftPct:80, rightPct:30, leftTxt:'Matrix work', rightTxt:'Fast XOR'}
      ]
    },
    compareExplain:[
      {h:'The real trade-off', t:'Hamming buys correction with bandwidth. CRC buys cheap detection with no correction. They solve different halves of the same problem.'},
      {h:'Why Ethernet chose CRC', t:'On a wired link, dropped frames are cheap — just resend. Spending bits on correction would slow every packet down to fix a rare event.'},
      {h:'Why memory chose hamming', t:'You cannot resend DRAM. If a bit flips, that byte is simply wrong forever. So correction is the only option.'}
    ],
    solve:{
      q:'Encode the 4-bit data word 1001 using Hamming code. How many extra bits, and what is the final 7-bit code?',
      steps:[
        {label:'STEP 1 — HOW MANY',        math:'m = 4 data bits',             note:'m + 1 parity bits needed'},
        {label:'STEP 2 — COUNT PARITY',    math:'parity = 4 + 1 = 5',         note:'2^3 = 8 >= 5, so 3 parity bits'},
        {label:'STEP 3 — EMPTY POSITIONS', math:'H layout: P1 P2 D1 P4 D2 D3 D4', note:'Parity at 1,2,4; data at 3,5,6,7'},
        {label:'STEP 4 — PLACE DATA',      math:'P1 P2 1 P4 0 0 1',           note:'1001 goes to positions 3,5,6,7'},
        {label:'STEP 5 — SET PARITY',      math:'P1=0  P2=1  P4=0',           note:'Even parity over 1,3,5,7 / 2,3,6,7 / 4,5,6,7'},
        {label:'ANSWER',                   math:'0 1 1 0 0 0 1  =  0110001',  note:'3 parity bits, 7-bit code word'}
      ]
    },
    solveExplain:[
      {h:'Why 2^3 >= 5', t:'Each parity bit is one bit of the syndrome. Three parity bits can name any of 7 positions plus "clean", so 8 combinations are needed and 2^3 = 8 is exactly enough.'},
      {h:'Finding each parity', t:'P1 covers positions 1,3,5,7 → values P1,1,0,1. One 1 already, so P1 = 0 for even parity. P2 covers 2,3,6,7 → P2,1,0,1 → P2 = 1. P4 covers 4,5,6,7 → P4,0,0,1 → P4 = 0.'},
      {h:'Why read left to right', t:'The code is written from position 1 to 7, so parity and data interleave: P1 P2 D1 P4 D2 D3 D4 = 0 1 1 0 0 0 1.'},
      {h:'How would you decode', t:'Recompute the three parities. Their weighted sum P1·1 + P2·2 + P4·4 is the error position. 0 means the code word is clean.'}
    ],
    life:[
      {ic:'🧠',h:'ECC memory',t:'Every byte in your RAM is stored with hamming-style extra bits. A cosmic ray flips a bit and the memory fixes it silently.'},
      {ic:'🛰️',h:'Satellite links',t:'Signals travel 36,000 km through vacuum. A single bit flipped in transit would ruin a video, so satellites use correcting codes.'},
      {ic:'🧮',h:'QR codes',t:'A QR code stores error-correction blocks at several strengths. A scratched QR code still scans because the redundancy locates the damaged modules.'},
      {ic:'📀',h:'CD and DVD',t:'Discs are read forever and cannot be re-sent. They use Reed-Solomon, a cousin of hamming that corrects whole symbol errors.'},
      {ic:'📡',h:'Deep space links',t:'Probes send terabytes with almost no chance of a resend window, so every bit carries its own correction.'},
      {ic:'🎮',h:'Console saves',t:'Some consoles add parity over their save files so a marginal chip does not silently corrupt your progress.'}
    ],
    lifeExplain:[
      {h:'The pattern', t:'Anywhere you cannot ask for a resend, you pay bits up front to repair damage later. That is exactly when hamming earns its cost.'},
      {h:'Why you never see it', t:'It is invisible to users because a corrected byte is indistinguishable from an uncorrupted one. The feature only appears when it fails, which is the point.'}
    ],
    history:[
      {yr:'1950',h:'Richard Hamming',t:'Hamming published his error-correcting codes while working at Bell Labs, motivated by early machines that silently lost data.'},
      {yr:'1950s',h:'Early computers',t:'Valves failed constantly and the machine simply lost a bit with no warning. Detecting that was the first practical motivation.'},
      {yr:'1960s',h:'ECC memory ships',t:'Mainframes began storing memory with hamming-style parity so a single cell failure could be repaired instead of crashing the machine.'},
      {yr:'1970s',h:'ECC-1 / ECC-2',t:'General Purpose Error Correction Codes became standard for correcting single and double-bit memory errors.'},
      {yr:'1980s',h:'QR codes invented',t:'Masahiro Hara at Denso Wave added configurable error-correction levels so printed codes survive dirt and damage.'},
      {yr:'2000s',h:'Drives everywhere',t:'Hard disks and later SSDs adopted hamming-derived ECC, because a silent bit flip corrupts a file permanently with no way to re-request it.'}
    ],
    historyExplain:[
      {h:'A pattern worth noticing', t:'Hamming code came from a reliability problem, not a networking problem. Networking later borrowed it for the places where a retransmission is impossible.'},
      {h:'Why it still matters', t:'Bit flip rates did not vanish when files moved to RAM and SSD — they moved with them, which is why every modern memory controller still implements this exact idea.'}
    ],
    flash:[
      {q:'What can parity do that hamming cannot?',a:'Nothing extra — parity can only DETECT an odd number of bit errors. Hamming detects and then CORRECTS.'},
      {q:'How many parity bits for m data bits?',a:'m + 1. Each parity bit carries one bit of the syndrome, so you need enough to name every position plus "no error".'},
      {q:'Where do parity bits go?',a:'At positions 1, 2, 4, 8 and so on, counting from 1 — exactly the powers of two.'},
      {q:'Which positions does the parity bit at 4 cover?',a:'Position 4 itself plus every position whose binary index has the 4-bit set: 4, 5, 6 and 7.'},
      {q:'What does a syndrome of 0 mean?',a:'The word arrived correctly. A non-zero syndrome is read as a binary number that names the corrupted bit.'},
      {q:'Can hamming correct two errors?',a:'Not plain hamming. A double error produces a syndrome pointing at a good bit, so SEC-DED codes add one extra overall parity bit.'},
      {q:'Why does memory need correction rather than detection?',a:'You cannot resend DRAM. Once a bit flips the byte is wrong permanently, so the only useful response is to repair it in place.'},
      {q:'Why is hamming not used on the internet?',a:'The extra bits cost bandwidth on every packet, and a lossy link can simply ask for a resend instead. Correction is only worth it when a resend is impossible.'}
    ],
    flashExplain:[
      {h:'Fastest way to remember', t:'Parity bits sit on powers of two so the syndrome can read them off as a binary number. Everything else follows from that one choice.'},
      {h:'Most common exam slip', t:'Students start counting positions at 0. Always start at 1, or every parity assignment comes out wrong.'}
    ],
    exam:[
      {q:'Define a hamming code and state its overhead in terms of m.',a:'A hamming code adds m + 1 redundant parity bits to m data bits. The parity bits are placed at positions that are powers of two, and each parity bit covers itself plus every position whose binary index contains that bit value, so the weighted sum of the received parity bits names the corrupted position.'},
      {q:'Why can simple parity not detect a two-bit error, and how does 2D parity help?',a:'Flipping two bits changes the number of 1s by zero or two, so an even-parity check still passes. Two-dimensional parity adds parity across rows and columns as well as along each row, so a double error breaks the pattern and becomes detectable.'},
      {q:'How many parity bits are needed for a 16-bit data word, and how is the code length derived?',a:'For m = 16 you need 17 parity positions, giving a length of 33 bits. In general the length is 2^r − 1 where r is the number of parity bits, chosen so that 2^r ≥ m + r + 1.'},
      {q:'Explain how the syndrome locates a single-bit error.',a:'The receiver recomputes each parity group. Each failing group contributes its position value (1, 2, 4, 8 …) to the syndrome. Because the groups overlap in a binary pattern, their sum equals the index of the corrupted bit, and a sum of zero means the word is clean.'},
      {q:'Compare CRC and hamming code for a satellite link, justifying the choice.',a:'A satellite cannot cheaply resend a corrupted frame, so detection alone is not enough. Hamming is chosen because it locates and repairs the damage in place. Its higher bit cost is acceptable because retransmitting a large frame costs far more bandwidth than the parity bits, and many bits travel the link.'}
    ],
    examExplain:[
      {h:'Answer in this order', t:'Define, then the overhead formula, then the placement rule, then a worked position. Examiners award marks in that sequence.'},
      {h:'Never say "hamming detects more errors than CRC"', t:'CRC actually detects more error patterns. Hamming is chosen for its ability to CORRECT, not for detection strength.'},
      {h:'Score for the justification', t:'In "compare and justify" questions the marks are for WHY the choice suits the scenario, not just naming the technique.'}
    ],
    eli5:{
      kid:'Imagine your class writes a sentence where every 4th letter is written in red ink. The red letters are "parity letters". If the teacher counts the red letters and gets an odd number, they know something went wrong, and by working out WHICH groups of red letters look wrong they can point at the exact letter that was smudged — and fix it themselves.',
      middle:'A hamming code adds extra bits to a message so a receiver can not only detect corruption but repair it. The extra bits are placed at positions 1, 2, 4, 8 and so on, and each one checks itself plus every data position whose binary index contains its own bit. When a bit is damaged, the groups that fail spell out its position in binary, which tells the receiver exactly what to flip back.',
      engg:'A hamming code is a linear block code that adds m + 1 parity bits to m data bits, correcting any single-bit error. Data occupies the non-power-of-two positions; parity bit 2^k covers position 2^k and every position i where the k-th bit of i is set. The receiver recomputes each parity group and forms the syndrome S = Σ (failed parity position). S = 0 indicates a valid code word, otherwise S names the erroneous position and the bit is inverted. The limitation is that double-bit errors produce a false syndrome pointing at an undamaged bit, so practical memory uses SEC-DED extensions that add one overall parity bit to detect and then correct double errors.'
    },
    eli5Explain:[
      {h:'The single idea underneath', t:'Put each check bit at a place where its address is a different binary digit. Then failed checks read out the address of the damage directly.'},
      {h:'Why more bits can be better', t:'Extra bits feel wasteful, but they buy the ability to fix a problem without asking the sender to repeat the whole message. That trade is worth it exactly when repeating is impossible.'}
    ]
  }
,
  'sliding-window': {
    crash:[
      { tag:'THE PROBLEM', text:"Stop-and-wait is safe but pathetically slow. The sender puts ONE frame on the wire and then sits idle for a full round trip. On a long link the link is empty almost all the time.", visual:`<svg viewBox="0 0 420 130" style="width:100%;max-width:420px"><rect x="14" y="34" width="392" height="34" rx="8" fill="#0f172a" stroke="#334155"/><text x="30" y="56" font-size="11" fill="#64748b" font-family="monospace">WIRE ▸</text><rect x="120" y="40" width="26" height="22" rx="4" fill="#2dd4bf"/><rect x="300" y="40" width="26" height="22" rx="4" fill="#facc15"/><text x="133" y="56" text-anchor="middle" font-size="10" fill="#042f2e" font-weight="800">1</text><text x="313" y="56" text-anchor="middle" font-size="10" fill="#422006" font-weight="800">2</text><text x="240" y="18" text-anchor="middle" font-size="11" fill="#f472b6" font-weight="800">mostly EMPTY — link wasted</text><rect x="120" y="78" width="86" height="16" rx="8" fill="#1e293b"/><rect x="120" y="78" width="86" height="16" rx="8" fill="#2dd4bf" opacity=".5"><animate attributeName="width" dur="2.4s" repeatCount="indefinite" values="10;86"/></rect><text x="260" y="90" font-size="10" fill="#94a3b8">idle while waiting for ACK</text></svg>`, readMs:5600 },
      { tag:'THE WINDOW', text:"Fix it: let the sender keep SEVERAL frames in flight before it must stop. That allowed set of unacknowledged frames is the WINDOW. As ACKs come back the window slides forward.", visual:`<svg viewBox="0 0 420 120" style="width:100%;max-width:420px">${Array.from({length:8},(_,i)=>{const x=16+i*50,st=i<3?'acked':i<6?'inflight':'future';const c=st==='acked'?'#22c55e':st==='inflight'?'#2dd4bf':'#1e293b';return `<rect x="${x}" y="44" width="42" height="32" rx="6" fill="${c}" stroke="${st==='future'?'#334155':'none'}"/><text x="${x+21}" y="64" text-anchor="middle" font-size="11" fill="#042f2e" font-weight="800">${i+1}</text>`}).join('')}<rect x="16" y="34" width="192" height="52" rx="8" fill="none" stroke="#facc15" stroke-width="2" stroke-dasharray="5 4"><animate attributeName="x" dur="2.4s" repeatCount="indefinite" values="16;166"/></rect><text x="210" y="100" text-anchor="middle" font-size="11" fill="#facc15" font-weight="800">the WINDOW — allowed to be un-ACKed</text></svg>`, readMs:5800 },
      { tag:'THE THREE MOVES', text:"Stop-and-Wait is a window of 1. Go-Back-N resends EVERYTHING from the bad frame onward. Selective Repeat resends ONLY the lost frames — faster, but costs far more memory.", visual:`<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><div style="text-align:center;min-width:96px;padding:12px;border-radius:12px;background:rgba(34,197,94,.10);border:1px solid #22c55e"><div style="font-size:22px">🐢</div><div style="color:#22c55e;font-weight:800;font-size:11px;margin-top:6px">STOP-AND-WAIT</div><div style="color:#94a3b8;font-size:10px;margin-top:4px">W = 1</div></div><div style="text-align:center;min-width:96px;padding:12px;border-radius:12px;background:rgba(250,204,21,.10);border:1px solid #facc15"><div style="font-size:22px">↩️</div><div style="color:#facc15;font-weight:800;font-size:11px;margin-top:6px">GO-BACK-N</div><div style="color:#94a3b8;font-size:10px;margin-top:4px">resend all after loss</div></div><div style="text-align:center;min-width:96px;padding:12px;border-radius:12px;background:rgba(45,212,191,.10);border:1px solid #2dd4bf"><div style="font-size:22px">🎯</div><div style="color:#2dd4bf;font-weight:800;font-size:11px;margin-top:6px">SELECTIVE REPEAT</div><div style="color:#94a3b8;font-size:10px;margin-top:4px">resend only the loss</div></div></div>`, readMs:5800 },
      { tag:'THE FORMULA', text:"With m-bit sequence numbers, Go-Back-N allows 2^m − 1 frames in the window. Selective Repeat allows only 2^(m−1) — half — because out-of-order arrivals must still be unambiguous.", visual:`<div style="text-align:center;font-family:monospace;font-size:15px;color:#cbd5e1;line-height:2">Go-Back-N:&nbsp; W<sub>max</sub> = 2<sup>m</sup> − 1<br>Selective Repeat:&nbsp; W<sub>max</sub> = 2<sup>m−1</sup></div>`, readMs:5400 },
      { tag:'⚡ ONE LINE', text:"A window lets the sender keep the pipe full. Bigger window = faster — until the receiver's buffer overflows.", visual:`<div style="text-align:center"><div style="color:#2dd4bf;font-weight:900;font-size:17px;padding:18px 30px;background:rgba(45,212,191,.08);border:2px dashed rgba(45,212,191,.4);border-radius:14px;max-width:540px;margin:0 auto">Window = how many frames may be un-ACKed at once</div></div>`, readMs:5000 }
    ],
    crashExplain:[
      {h:'Why stop-and-wait is slow', t:'The sender idles for one full round trip after every single frame. On a 100 ms RTT link at 1000 frames/sec of data, the link is busy about 1% of the time.'},
      {h:'What a timer is for', t:'Each outstanding frame starts a retransmission timer. If its ACK does not arrive before the timer fires, the protocol assumes loss and reacts according to its strategy.'},
      {h:'Why Selective Repeat halves the window', t:'Out-of-order frames must not be confused with old duplicates. Limiting the window to half the sequence-number space makes "too old" and "arrived out of order" impossible to mix up.'}
    ],
    compare:{
      left:'Go-Back-N', right:'Selective Repeat',
      rows:[
        ['On loss','Resend the bad frame AND everything after it','Resend ONLY the lost frames'],
        ['Receiver','Accepts only the next in-order frame','Buffers out-of-order frames'],
        ['Bandwidth','Wasteful — retransmits good data too','Efficient — minimal retransmission'],
        ['Buffer need','Small at the receiver','Large at BOTH ends'],
        ['Complexity','Simple','Harder — needs per-frame timers']
      ],
      bars:[
        {label:'Bandwidth use', leftPct:35, rightPct:95, leftTxt:'Wasteful', rightTxt:'Efficient'},
        {label:'Speed on loss', leftPct:30, rightPct:90, leftTxt:'Slow', rightTxt:'Fast'},
        {label:'Receiver memory', leftPct:20, rightPct:100, leftTxt:'Small', rightTxt:'Huge'},
        {label:'Implementation', leftPct:90, rightPct:35, leftTxt:'Simple', rightTxt:'Complex'}
      ]
    },
    compareExplain:[
      {h:'The core difference', t:'Go-Back-N treats everything after the loss as suspect. Selective Repeat trusts that only one frame was lost and repairs just that.'},
      {h:'What that costs', t:'Selective Repeat needs the receiver to hold out-of-order frames in a buffer AND the sender to keep a timer per frame. That memory and complexity is the price of the saved bandwidth.'},
      {h:'Why both still exist', t:'Go-Back-N is used where receivers are cheap and simple — Bluetooth and many sensor links. Selective Repeat suits real file transfer where bandwidth is expensive.'}
    ],
    solve:{
      q:'With 3-bit sequence numbers, what is the maximum window size for (a) Go-Back-N and (b) Selective Repeat? How many sequence numbers exist in total?',
      steps:[
        {label:'STEP 1 — SEQUENCE SPACE', math:'m = 3 bits',                        note:'2^m possible sequence numbers'},
        {label:'STEP 2 — TOTAL NUMBERS', math:'2^3 = 8',                           note:'Sequence numbers 0 to 7'},
        {label:'STEP 3 — GO-BACK-N',    math:'W = 2^m − 1 = 8 − 1 = 7',           note:'Can use all but one'},
        {label:'STEP 4 — SELECTIVE REPEAT', math:'W = 2^(m−1) = 2^2 = 4',          note:'Half the space, always'},
        {label:'STEP 5 — WHY HALF',     math:'7 > 4',                              note:'Must distinguish old from new'},
        {label:'ANSWER',                math:'GBN = 7,  SR = 4,  out of 8 numbers', note:'8 sequence numbers exist'}
      ]
    },
    solveExplain:[
      {h:'Why Go-Back-N gives up exactly one', t:'If the window covered all 2^m numbers, an arriving ACK could not be told apart from a stale one. Losing one number guarantees a clear old/new boundary.'},
      {h:'Why Selective Repeat gives up half', t:'With a window of size 2^(m−1) and 2^m numbers, the oldest un-ACKed number and the newest in-window number are exactly 2^(m−1) apart — an unambiguous gap.'},
      {h:'The bit math', t:'2^3 = 8, so GB-N allows 7 and SR allows 4. Doubling m to 4 bits gives 15 and 8 respectively, which is why bigger sequence fields allow bigger windows.'},
      {h:'Where the real limit lives', t:'The receiver must buffer the window. If it advertises a receive window of 4 but only has storage for 2, the buffer overflows and frames are dropped regardless of the formula.'}
    ],
    life:[
      {ic:'📺',h:'YouTube streaming',t:'A packet is lost. The player keeps playing what it already downloaded instead of freezing, because retransmission is less painful than a stall.'},
      {ic:'📞',h:'Video calls',t:'Late packets are often thrown away rather than resent. A 300 ms old frame is useless — better to drop it and keep the call moving.'},
      {ic:'🎮',h:'Online games',t:'Position updates are resent aggressively. Falling behind means being shot, so games tolerate wasted bandwidth to stay current.'},
      {ic:'🔗',h:'Bluetooth',t:'Uses a small Go-Back-N style window. Bluetooth devices have almost no memory, so retransmitting everything is cheaper than buffering.'},
      {ic:'📡',h:'Satellite internet',t:'The RTT is enormous, so the window is huge. This is why satellite providers describe their service in terms of window size, not speed.'},
      {ic:'🖨️',h:'WiFi',t:'A weak signal plus interference causes constant loss. WiFi resends the failed frames while keeping newer traffic flowing.'}
    ],
    lifeExplain:[
      {h:'The pattern', t:'Bigger windows keep the link busy but need memory to hold un-ACKed frames. Device capability, not theory, decides how big you can go.'},
      {h:'Why games forgive waste', t:'Real-time data is worthless once stale, so retransmitting an old position update is nearly free — freshness matters more than saving bytes.'}
    ],
    history:[
      {yr:'1972',h:'ARPANET',t:'The original network used stop-and-wait with an 8-bit sequence number, because links were slow and memory was tiny.'},
      {yr:'1970s',h:'Satellite links',t:'Long-haul satellite systems revealed how badly stop-and-wait wasted expensive leased bandwidth, forcing windowed protocols into practice.'},
      {yr:'1980s',h:'HDLC and LAPB',t:'ISO and IBM standardised windowed protocols with numbered frames, timers and sliding-window flow control for WAN links.'},
      {yr:'1990s',h:'TCP sliding window',t:'TCP adopted a variable window driven by round-trip measurement, turning a fixed protocol idea into adaptive congestion control.'},
      {yr:'2000s',h:'Cable and DSL',t:'Home links with variable bandwidth made adaptive window sizing essential, since a fixed window either starved or overflowed.'},
      {yr:'2010s',h:'QUIC',t:'Google rebuilt transport on UDP and made loss recovery per-stream, so one lost packet no longer stalls every other stream in the connection.'}
    ],
    historyExplain:[
      {h:'A recurring pattern', t:'Every generation of link is faster, and every generation re-invents the same idea: keep more in flight, and adapt the window to the conditions.'},
      {h:'From fixed to adaptive', t:'HDLC used a fixed window because circuits were leased and predictable. TCP measures the actual RTT instead, because the public internet shares capacity it does not own.'}
    ],
    flash:[
      {q:'What does "window" mean?',a:'The number of frames the sender may transmit without receiving an acknowledgement.'},
      {q:'What is the max window for Go-Back-N?',a:'2^m − 1, where m is the number of sequence-number bits.'},
      {q:'What is the max window for Selective Repeat?',a:'2^(m−1). Exactly half the sequence-number space.'},
      {q:'Why is Stop-and-Wait just a window of 1?',a:'The sender may have exactly one un-ACKed frame at a time, which is the degenerate case of the same sliding-window idea.'},
      {q:'What happens when a timer expires?',a:'The sender assumes that frame was lost. Go-Back-N retransmits it and everything after; Selective Repeat retransmits only that frame.'},
      {q:'Why must Selective Repeat buffer frames?',a:'A later frame may arrive before an earlier one, so the receiver must hold it until the gap is filled, then deliver everything in order.'},
      {q:'What triggers a window to slide?',a:'The arrival of an acknowledgement, which frees the sequence number the frame occupied and makes one more slot legal.'},
      {q:'Why does the window have an upper limit at all?',a:'The receiver must store every un-ACKed frame. A window larger than its buffer causes overflow and drops, which is worse than a small window.'}
    ],
    flashExplain:[
      {h:'Fastest way to remember', t:'Go-Back-N throws away one number so it can recognise stale ACKs. Selective Repeat throws away half so it can recognise out-of-order arrivals.'},
      {h:'Most common exam slip', t:'Students write 2^m for Go-Back-N. It is always 2^m − 1.'}
    ],
    exam:[
      {q:'Explain the sliding window concept and why it improves throughput over stop-and-wait.',a:'The sender may keep up to W frames un-acknowledged at once instead of waiting after each one. Because many frames are in flight during the round-trip time, the link carries data continuously rather than alternating between a short burst of transmission and a long idle period. Throughput therefore approaches link capacity instead of being limited to one frame per round trip.'},
      {q:'Derive the maximum window size for Go-Back-N and Selective Repeat, explaining the restriction in each case.',a:'With m-bit sequence numbers there are 2^m distinct values. Go-Back-N may use 2^m − 1 because a single unused number guarantees that a newly arriving acknowledgement can never be confused with a stale one. Selective Repeat may use only 2^(m−1) because it must additionally distinguish a frame that arrived out of order from a duplicate of an old frame, and that separation is unambiguous only when the window covers at most half the sequence space.'},
      {q:'What is the role of the retransmission timer in a sliding-window protocol?',a:'Each un-acknowledged frame starts a timer. If the acknowledgement does not arrive before it expires, the sender concludes the frame was lost and retransmits according to its strategy. The timer duration must exceed the round-trip time, otherwise the sender resends frames that were merely delayed and wastes bandwidth.'},
      {q:'A 3-bit sequence number is used with Go-Back-N. Frame 3 is lost while frames 4 and 5 arrive correctly. Describe exactly what the sender retransmits and why.',a:'Go-Back-N discards every frame from the lost one onward, so frames 3, 4 and 5 are all retransmitted even though 4 and 5 were delivered correctly. This follows from the receiver discarding any frame arriving out of order, so it has no use for 4 and 5 until 3 arrives. Duplicate copies are detected by sequence number and discarded.'},
      {q:'Compare Go-Back-N and Selective Repeat with respect to buffer requirements, and justify when each is preferable.',a:'Go-Back-N needs only a small receiver buffer, since frames arriving out of order are discarded immediately, while Selective Repeat requires a receiver buffer at least as large as the window plus a timer per outstanding frame at the sender. Selective Repeat is preferable on expensive or long-distance links where retransmitting good data wastes costly bandwidth, whereas Go-Back-N is preferable for constrained devices such as Bluetooth sensors where memory is scarce and simplicity matters more.'}
    ],
    examExplain:[
      {h:'Always state the restriction reason', t:'The marks are not for writing 2^m − 1 but for explaining WHY one number is sacrificed. Tie the number to the ambiguity it removes.'},
      {h:'Show the space first', t:'Write "2^m sequence numbers exist" before quoting any formula. It earns the setup mark and prevents arithmetic slips.'},
      {h:'For compare questions', t:'Name the buffer or cost implication explicitly. Bandwidth and memory are the two axes examiners mark.'}
    ],
    eli5:{
      kid:'Imagine you are passing notes in class. Stop-and-wait means you pass one note and then wait for your friend to nod before passing the next. The whole row sits idle. A sliding window means you pass five notes before pausing — five notes are out there at once, and every nod lets you pass one more.',
      middle:'A sliding window lets a sender keep several frames in flight instead of waiting after each one. The window is the number of frames allowed to be un-acknowledged at any moment. Stop-and-wait is simply the case where the window equals one. The other two strategies differ in what happens when a frame is lost: Go-Back-N resends the lost frame and every frame after it, while Selective Repeat resends only the lost frame and buffers out-of-order arrivals at the receiver.',
      engg:'A sliding-window protocol permits W outstanding frames before blocking on acknowledgement, bounded by the receiver flow-control window. With m-bit sequence numbers the sender may use at most 2^m − 1 under Go-Back-N, because reserving a single number prevents an acknowledgement from being ambiguous between new and stale; Selective Repeat is further limited to 2^(m−1) so that a buffered out-of-order frame remains distinguishable from a duplicate. Each outstanding frame carries a retransmission timer, and its expiry triggers recovery according to the strategy. Because the receiver must retain every un-acknowledged frame, the protocol cannot safely outrun the receiver buffer, which is why advertised windows are bounded by available storage. Stop-and-wait, Go-Back-N and Selective Repeat are the three classical ARQ variants distinguished by this window size and loss response.'
    },
    eli5Explain:[
      {h:'The single idea underneath', t:'Never wait idle when you are allowed to keep working. The window is simply permission to be ahead of the acknowledgements.'},
      {h:'Why half the numbers in Selective Repeat', t:'Half the space gives the receiver an unmistakable gap between "too old to accept" and "arrived early, please hold".'}
    ]
  }

});

/* ---------- Unit II close-out: shared-medium access ---------- */
Object.assign(window.XC.VAATHIYAR, {

  'multiple-access': {
    crash:[
      { tag:'THE PROBLEM', text:"Wired links get their own dedicated cable, so nobody collides. Radio is SHARED. Every phone in range hears the same airwaves, so two people talking at once overlap into noise.", visual:`<div style="text-align:center"><div style="font-size:70px">📡</div><div style="color:#facc15;font-weight:900;font-size:18px;margin-top:12px">ONE SHARED CHANNEL</div><div style="display:flex;gap:26px;justify-content:center;margin-top:18px"><div><div style="font-size:34px">📱</div><div style="color:#94a3b8;font-size:10px">Phone A</div></div><div><div style="font-size:34px">📱</div><div style="color:#94a3b8;font-size:10px">Phone B</div></div><div><div style="font-size:34px">📱</div><div style="color:#94a3b8;font-size:10px">Phone C</div></div></div><div style="color:#f472b6;font-size:12px;margin-top:14px">Speak at the same time → COLLISION</div></div>`, readMs:5400 },
      { tag:'ALOHA', text:"Pure ALOHA says: transmit whenever you feel like it, then wait a fixed time for the ACK. If no ACK, assume a collision and resend. Shockingly simple — and shockingly bad.", visual:`<svg viewBox="0 0 420 130" style="width:100%;max-width:420px"><text x="10" y="20" font-size="11" fill="#64748b">ALOHA — send ANYTIME</text><rect x="10" y="30" width="400" height="18" rx="4" fill="#0f172a" stroke="#334155"/><rect x="40" y="32" width="70" height="14" fill="#2dd4bf"/><rect x="150" y="32" width="70" height="14" fill="#2dd4bf"/><rect x="260" y="32" width="70" height="14" fill="#2dd4bf"/><path d="M110 60 l40 20 l40 -20" fill="none" stroke="#f472b6" stroke-width="2"/><text x="215" y="86" text-anchor="middle" font-size="11" fill="#f472b6" font-weight="800">COLLISION</text><text x="10" y="112" font-size="11" fill="#94a3b8">Throughput = 18%</text></svg>`, readMs:5600 },
      { tag:'SLOTTED ALOHA', text:"Improvement: split time into fixed slots and only start at a slot boundary. Collisions drop from 18% to about 7% because two senders can no longer start mid-way through each other.", visual:`<svg viewBox="0 0 420 120" style="width:100%;max-width:420px"><text x="10" y="20" font-size="11" fill="#64748b">SLOTTED — send only on the beat</text>${Array.from({length:8},(_,i)=>{const hit=[0,2,5].includes(i),x=10+i*50;return `<rect x="${x}" y="32" width="46" height="26" rx="4" fill="${hit?'#2dd4bf':'#1e293b'}" stroke="#334155"/><text x="${x+23}" y="49" text-anchor="middle" font-size="9" fill="${hit?'#042f2e':'#64748b'}" font-weight="800">${hit?'SEND':'—'}</text>`}).join('')}<text x="210" y="82" text-anchor="middle" font-size="11" fill="#22c55e" font-weight="800">Throughput = 37%</text></svg>`, readMs:5600 },
      { tag:'CSMA', text:"Carrier Sense Multiple Access adds ONE rule: LISTEN first, transmit only if the channel is silent. Collisions now happen only when two stations sense silence at the same instant.", visual:`<div style="text-align:center"><div style="font-family:monospace;font-size:13px;color:#cbd5e1;line-height:2">1. SENSE the channel<br>2. If BUSY → wait<br>3. If IDLE → transmit</div><div style="color:#facc15;font-size:12px;margin-top:14px">still collides if two stations both sense IDLE</div></div>`, readMs:5600 },
      { tag:'CSMA/CD', text:"Ethernet adds collision DETECTION: transmit AND listen at once. If the signal on the wire disagrees with what was sent, a collision happened — abort immediately and send a jam signal instead of wasting the whole frame.", visual:`<svg viewBox="0 0 420 120" style="width:100%;max-width:420px"><text x="10" y="18" font-size="11" fill="#64748b">CSMA/CD — send AND listen</text><line x1="10" y1="66" x2="410" y2="66" stroke="#2dd4bf" stroke-width="3"/><rect x="60" y="52" width="90" height="28" rx="6" fill="#0f172a" stroke="#2dd4bf"/><text x="105" y="71" text-anchor="middle" font-size="10" fill="#2dd4bf" font-weight="800">TRANSMIT</text><path d="M200 40 l30 -14 l30 14 l30 -14" fill="none" stroke="#f472b6" stroke-width="2"><animate attributeName="opacity" dur="1.2s" repeatCount="indefinite" values="1;0.3;1"/></path><text x="300" y="40" font-size="11" fill="#f472b6" font-weight="800">mismatch → COLLISION</text><rect x="205" y="88" width="110" height="20" rx="6" fill="#f472b6"/><text x="260" y="102" text-anchor="middle" font-size="10" fill="#450a0a" font-weight="800">JAM → back off</text></svg>`, readMs:5800 },
      { tag:'⚡ ONE LINE', text:"Listen, then send, and check while sending. That is Ethernet in three words.", visual:`<div style="text-align:center"><div style="color:#2dd4bf;font-weight:900;font-size:17px;padding:18px 30px;background:rgba(45,212,191,.08);border:2px dashed rgba(45,212,191,.4);border-radius:14px;max-width:520px;margin:0 auto">Sense → Transmit → Detect → Jam → Back off</div></div>`, readMs:5000 }
    ],
    crashExplain:[
      {h:'Why pure ALOHA is bad', t:'A frame sent at a random instant collides with any frame that starts within one frame-time before or after it, so roughly 18% of transmissions fail and must be resent.'},
      {h:'What slotted ALOHA buys', t:'Restricting transmissions to slot boundaries doubles the success rate to about 37%, because the vulnerable period shrinks from two frame-times to one.'},
      {h:'Why CSMA still collides', t:'Propagation delay means a station can sense an idle channel while another station is still transmitting toward it, so two can begin together. CSMA/CD detects this and backs off.'}
    ],
    compare:{
      left:'Pure ALOHA', right:'CSMA/CD',
      rows:[
        ['Before sending','Transmit immediately','Sense the channel first'],
        ['Channel type','Shared radio','Shared wired bus'],
        ['Collision chance','High (18%)','Low — only on rare races'],
        ['During send','Does not listen','Listens AND transmits'],
        ['After collision','Random resend','Send jam, then binary back-off']
      ],
      bars:[
        {label:'Throughput', leftPct:18, rightPct:85, leftTxt:'18%', rightTxt:'Much higher'},
        {label:'Efficiency', leftPct:20, rightPct:90, leftTxt:'Poor', rightTxt:'Good'},
        {label:'Complexity', leftPct:95, rightPct:45, leftTxt:'Dead simple', rightTxt:'Moderate'},
        {label:'Collision rate', leftPct:90, rightPct:15, leftTxt:'Frequent', rightTxt:'Rare'}
      ]
    },
    compareExplain:[
      {h:'The core difference', t:'ALOHA is purely reactive — it sends and finds out. CSMA/CD is proactive — it listens first, and still listens while sending to catch the one case that sensing misses.'},
      {h:'Why wired Ethernet needs CD', t:'A wired bus propagates fast and short, so collisions are rare but real. Without detection a sender would keep pushing a frame already destroyed by another station.'},
      {h:'Why WiFi dropped CD', t:'A radio station cannot hear while transmitting — its own signal drowns out any collision. WiFi therefore uses CSMA/CA and avoids collisions by design instead of detecting them afterwards.'}
    ],
    solve:{
      q:'Pure ALOHA has a 20 ms frame time. A station transmits for 20 ms. What is the probability of a collision, and what is its maximum throughput?',
      steps:[
        {label:'STEP 1 — FRAME TIME',   math:'T = 20 ms',                       note:'Duration of one frame'},
        {label:'STEP 2 — VULNERABLE',   math:'2T = 40 ms',                      note:'Starts within T before or after'},
        {label:'STEP 3 — COLLISION P',  math:'2T / (T + 2T) = 2/3',            note:'Pure ALOHA collision probability'},
        {label:'STEP 4 — SUCCESS',      math:'1 − 2/3 = 1/3',                  note:'Chance of a clean send'},
        {label:'STEP 5 — THROUGHPUT',   math:'(1/3) × 100 = 18%',              note:'Fraction of capacity used'},
        {label:'ANSWER',                math:'P(collision) = 2/3,  max throughput = 18%', note:'Classic pure ALOHA result'}
      ]
    },
    solveExplain:[
      {h:'Why the vulnerable period is 2T', t:'A frame is at risk if another transmission begins anywhere in the interval one frame-time before its own start or one frame-time after, giving a total window of 2T.'},
      {h:'Why throughput is 18%', t:'Only one-third of transmissions succeed, and each success carries exactly one frame-time of data, so one-third of all channel time moves useful data. This is why pure ALOHA was abandoned early.'},
      {h:'What slotted ALOHA changes', t:'Restricting starts to slot boundaries removes the "before" half of the vulnerable window, so the probability falls to T/(T + T) = 1/2 and throughput rises to about 37%.'},
      {h:'Where CSMA fits', t:'CSMA removes most collisions before they happen by sensing the channel, leaving only the propagation-delay race for CD to clean up, which is why Ethernet reaches very high utilisation.'}
    ],
    life:[
      {ic:'📻',h:'Walkie-talkies',t:'Pure ALOHA behaviour. Press to talk whenever. Two people pressing together get the squelch, so you both stop and try again.'},
      {ic:'🌐',h:'Home Ethernet',t:'Old hubs were shared buses using CSMA/CD. Modern switches give every port its own collision domain, so collisions vanished.'},
      {ic:'📶',h:'WiFi',t:'Uses CSMA/CA instead of CD — it cannot hear itself transmit, so it waits out a random back-off to avoid colliding in the first place.'},
      {ic:'🛰️',h:'Satellite uplink',t:'Long propagation delay makes sensing unreliable, so satellites coordinate return times instead of listening to the channel.'},
      {ic:'🏙️',h:'Mobile networks',t:'Cellular base stations hand out scheduled time slots, which is slotted ALOHA scaled up to millions of devices.'},
      {ic:'🔊',h:'Bluetooth',t:'Frequency hopping moves between 79 tiny channels constantly, so a collision affects only one narrow slice of bandwidth.'}
    ],
    lifeExplain:[
      {h:'The pattern', t:'When everyone shares one channel, someone has to decide when to speak. Sensing works when you can hear; radios that cannot hear themselves must avoid collisions instead.'},
      {h:'Why switches killed collisions', t:'A switch gives each device a private wire segment. Once nothing is shared, the whole access problem disappears without changing a single frame format.'}
    ],
    history:[
      {yr:'1970',h:'Pure ALOHA at Hawaii',t:'Norman Abramson built the first ALOHA network at the University of Hawaii, accepting collisions and resending as the price of extreme simplicity.'},
      {yr:'1972',h:'Slotted ALOHA',t:'Roberts introduced time slots, roughly doubling throughput to 37% at the cost of requiring synchronised clocks.'},
      {yr:'1973',h:'Ethernet at Xerox PARC',t:'Metcalfe and Boggs designed CSMA/CD for a shared coaxial bus, choosing it because the network would be built before switches were affordable.'},
      {yr:'1980s',h:'CSMA/CA for WiFi',t:'IEEE 802.11 adopted collision avoidance with acknowledgement, because a radio cannot listen while transmitting and so cannot detect collisions at all.'},
      {yr:'1990s',h:'Switches arrive',t:'Layer-2 switching gave each station a dedicated segment and collapsed collision domains to single pairs of ports, making CSMA/CD effectively irrelevant on wired LANs.'},
      {yr:'2000s',h:'Mobile data scheduling',t:'Cellular networks extended slotted access into scheduled uplinks, allocating precise time windows so many devices share a cell with almost no contention.'}
    ],
    historyExplain:[
      {h:'A pattern worth noticing', t:'Each generation solved the same contention problem at a different layer: random retry, then time slots, then sensing, then dedicated channels, then scheduled grants.'},
      {h:'Why the history still matters', t:'Modern networks look collision-free, but the reasoning survives — collision avoidance in WiFi and scheduled access in 5G are direct descendants of ALOHA slots.'}
    ],
    flash:[
      {q:'What is the maximum throughput of pure ALOHA?',a:'About 18% of channel capacity, derived from a collision probability of 2/3.'},
      {q:'How does slotted ALOHA differ?',a:'Transmissions may begin only at slot boundaries, which halves the vulnerable period and raises throughput to about 37%.'},
      {q:'What does the CS in CSMA/CD stand for?',a:'Carrier Sense — the station listens to the channel before transmitting.'},
      {q:'Why can CSMA still produce a collision?',a:'Propagation delay means a station may sense an idle channel while another station is still transmitting toward it.'},
      {q:'What does CD add?',a:'Collision Detection — the station listens while transmitting and compares the actual signal with what it sent. A mismatch means a collision.'},
      {q:'What is a jam signal for?',a:'It is transmitted after detecting a collision so all other stations also stop, rather than continuing to add to the damaged signal.'},
      {q:'Why does WiFi use CSMA/CA instead of CSMA/CD?',a:'A radio cannot hear itself transmitting, so its own signal would mask any collision. It must therefore avoid collisions rather than detect them.'},
      {q:'Why do modern switched Ethernet networks have almost no collisions?',a:'Each port is its own collision domain, so no two stations ever contend for the same wire.'}
    ],
    flashExplain:[
      {h:'Fastest way to remember', t:'ALOHA sends and regrets. CSMA/CD listens first, then listens again while sending to catch the one race that listening first misses.'},
      {h:'Most common exam slip', t:'Students quote 37% when the question says PURE ALOHA. Pure is 18%; slotted is 37%.'}
    ],
    exam:[
      {q:'Explain pure ALOHA, slotted ALOHA and CSMA/CD, stating the maximum throughput of the first two.',a:'Pure ALOHA permits transmission at any instant and relies on acknowledgement to detect collisions, giving a vulnerable period of two frame-times and a maximum throughput of one eighth, about 18%. Slotted ALOHA restricts transmission to fixed time slots synchronised across the network, reducing the vulnerable period to one frame-time and raising throughput to about 37%. CSMA/CD adds carrier sensing before transmission and collision detection during transmission, so collisions occur only when two stations simultaneously sense an idle channel because of propagation delay, which on a short wired bus is a rare event.'},
      {q:'Why is the maximum throughput of pure ALOHA only 18%?',a:'A frame is vulnerable for one frame-time before its own transmission begins and one frame-time after it ends, a total of 2T. Over the interval from the start of a frame to one frame-time after it ends, a competing transmission can begin at 2T of the 3T available positions, giving a collision probability of 2/3. Only one third of transmissions therefore succeed, and since each success carries one frame-time of useful data, only one third of channel time is productive, giving a maximum throughput of 18%.'},
      {q:'Describe the Ethernet back-off procedure after a collision.',a:'On detecting a collision the station stops transmitting, sends a jam signal so all stations know the channel is busy, waits a random interval, and then attempts to retransmit. After k consecutive collisions the station selects randomly from the first k slots in an exponentially widening range, so after many failures it waits much longer. This prevents two stations that collided from synchronising again and repeatedly colliding. The range stops growing after a fixed limit so a station can never be permanently locked out.'},
      {q:'Why is CSMA/CA used in wireless networks instead of CSMA/CD?',a:'A wireless station cannot reliably detect a collision because its own transmission is far stronger than any incoming signal, so collision detection is physically impossible. Wireless systems therefore avoid collisions: a station senses the medium over a DIFS interval, draws a random back-off, and transmits only if the channel is still idle when its timer expires. It also relies on link-layer acknowledgements, because the receiver must confirm delivery since a sender cannot detect loss itself.'},
      {q:'Compare the role of ALOHA concepts in pure, slotted and modern cellular systems.',a:'Pure ALOHA randomises transmission time and tolerates collisions with retransmission, which is simple but wastes about 82% of the channel. Slotted ALOHA synchronises all transmissions to fixed boundaries, halving the vulnerable period and raising efficiency to about 37%, at the cost of requiring a common clock. Modern cellular networks generalise the slotted idea into scheduled uplinks, where the base station assigns each device a specific time-frequency grant, so contention is removed entirely and the 37% ceiling no longer applies because devices no longer compete for the same instants.'}
    ],
    examExplain:[
      {h:'Show the vulnerable period', t:'Write the 2T window explicitly before quoting any percentage. The arithmetic of 2/3 is where most marks live.'},
      {h:'Always separate pure from slotted', t:'If the question says PURE, the answer is 18%. Slotted is 37%. Mixing them up loses an easy mark.'},
      {h:'For wireless questions', t:'The key sentence is that a station cannot hear itself transmit, so detection is impossible and avoidance is required.'}
    ],
    eli5:{
      kid:'Imagine everyone in a room shares one telephone line. Pure ALOHA means you just start talking whenever you feel like it, and if someone else started talking too you both get garbled, hang up and try again. Slotted ALOHA is like a class where the teacher says "speak only when I clap" — you can no longer start speaking in the middle of someone else. CSMA/CD is even smarter: you listen first to check the line is free, and you keep listening while you talk so you notice if someone jumped in.',
      middle:'Random access methods let many devices share one channel. Pure ALOHA transmits whenever and resends after failing to receive an acknowledgement, wasting about 82% of capacity. Slotted ALOHA synchronises devices to fixed time boundaries, roughly doubling efficiency to 37%. CSMA adds carrier sensing, so a station transmits only when it detects an idle channel. Because propagation delay still allows two stations to sense idle simultaneously, CSMA/CD adds collision detection during transmission, a jam signal and an exponential random back-off so colliding stations do not resynchronise and collide again.',
      engg:'Random access protocols share a medium without central coordination. Pure ALOHA permits transmission at any time, producing a vulnerable period of 2T and a maximum throughput of 1/(2e) ≈ 0.184. Slotted ALOHA restricts transmission starts to synchronised slots of length T, giving a vulnerable period of T and a throughput of 1/e ≈ 0.368. CSMA/CD performs carrier sensing before transmission and compares the transmitted signal with the received signal during transmission; any discrepancy indicates a collision, after which the station transmits a jam signal and enters binary exponential back-off, choosing uniformly from 0 to 2^k − 1 after k consecutive collisions to decorrelate the retry. The minimum frame length must be at least twice the maximum propagation delay, so a sender is still transmitting when a collision could first become detectable. CSMA/CA replaces detection in wireless, where the transmitter cannot hear itself, using DIFS sensing, randomised back-off and link-layer acknowledgements.'
    },
    eli5Explain:[
      {h:'The single idea underneath', t:'When many people share one channel, someone must decide when to talk. Listen first if you can hear; avoid clashing if you cannot.'},
      {h:'Why the exponential back-off exists', t:'If two stations waited the same fixed time they would collide forever. Randomising over a range that grows with each failure finally separates them.'}
    ]
  }

});
console.log('Data loaded: VAATHIYAR Unit II =', Object.keys(window.XC.VAATHIYAR).length, 'topics total');