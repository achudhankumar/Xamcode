/* ============================================================
   DATA — VAATHIYAR MODE
   Loaded after data-cheatcodes.js, before data-visuals.js
   Exposes: window.XC.VAATHIYAR, window.XC.getVaathiyar()
   ============================================================ */
window.XC = window.XC || {};

const VAATHIYAR = {
  /* ---------- UNIT I ---------- */
  'intro': {
    crash:[
      { tag:'INTRO', text:"Vanakkam, students. Today we start with the very base — What is a Network? Indha word-a pala thadava kettu irupinga, but meaning theriyuma?", visual:`<div style="text-align:center"><div style="font-size:80px;animation:pulse 2s ease-in-out infinite">🌐</div><div style="color:#2dd4bf;font-weight:900;font-size:22px;margin-top:16px">WHAT IS A NETWORK</div><div style="color:#6b7280;font-size:13px;margin-top:8px">The very first concept</div></div>`, readMs:5200 },
      { tag:'SIMPLE DEFINITION', text:"Simple-a sollanum na — two or more devices connected by a link, so they can share data. Adhu dhaan network.", visual:`<svg viewBox="0 0 400 140" style="width:100%;max-width:400px"><rect x="40" y="50" width="80" height="50" rx="8" fill="#111a2e" stroke="#facc15" stroke-width="2"/><text x="80" y="80" text-anchor="middle" font-size="11" fill="#facc15" font-weight="800">LAPTOP</text><rect x="280" y="50" width="80" height="50" rx="8" fill="#111a2e" stroke="#22c55e" stroke-width="2"/><text x="320" y="80" text-anchor="middle" font-size="11" fill="#22c55e" font-weight="800">PRINTER</text><line x1="120" y1="75" x2="280" y2="75" stroke="#2dd4bf" stroke-width="3"/><circle r="6" fill="#facc15"><animateMotion dur="1.8s" repeatCount="indefinite" path="M 140 75 L 260 75"/></circle><text x="200" y="115" text-anchor="middle" font-size="12" fill="#cbd5e1" font-weight="700">📎 A LINK connects them</text></svg>`, readMs:5000 },
      { tag:'EVERYDAY', text:"Your home WiFi — laptop, mobile, TV, printer. Ellam oru network. Same concept, different scale.", visual:`<div style="display:flex;gap:20px;justify-content:center;align-items:center;flex-wrap:wrap"><div style="text-align:center"><div style="font-size:48px">💻</div><div style="color:#cbd5e1;font-size:10px">Laptop</div></div><div style="text-align:center"><div style="font-size:48px">📱</div><div style="color:#cbd5e1;font-size:10px">Mobile</div></div><div style="text-align:center"><div style="font-size:48px">📺</div><div style="color:#cbd5e1;font-size:10px">TV</div></div><div style="text-align:center"><div style="font-size:48px">🖨️</div><div style="color:#cbd5e1;font-size:10px">Printer</div></div><div style="text-align:center"><div style="font-size:60px">📡</div><div style="color:#2dd4bf;font-weight:800;font-size:10px">ROUTER</div></div></div>`, readMs:5000 },
      { tag:'WHY IT MATTERS', text:"Indha concept purinjaa, adhukku mela irukkira ellaa topic-um easy aagum. Network illa-na — internet illa, WhatsApp illa, YouTube illa.", visual:`<div style="text-align:center;display:flex;gap:30px;justify-content:center;flex-wrap:wrap"><div><div style="font-size:56px">📧</div><div style="color:#cbd5e1;font-size:11px;margin-top:8px">Email</div></div><div><div style="font-size:56px">📺</div><div style="color:#cbd5e1;font-size:11px;margin-top:8px">YouTube</div></div><div><div style="font-size:56px">💬</div><div style="color:#cbd5e1;font-size:11px;margin-top:8px">WhatsApp</div></div><div><div style="font-size:56px">🎮</div><div style="color:#cbd5e1;font-size:11px;margin-top:8px">Games</div></div></div>`, readMs:5400 },
      { tag:'⚡ ONE LINE', text:"So one line la — network means devices connected to share data. Simple. Vera level base concept.", visual:`<div style="text-align:center"><div style="font-size:80px">🎯</div><div style="color:#2dd4bf;font-weight:900;font-size:18px;margin-top:20px;padding:20px 32px;background:rgba(45,212,191,.08);border:2px dashed rgba(45,212,191,.4);border-radius:16px;line-height:1.5;max-width:520px">Devices + Links = Network</div></div>`, readMs:4800 }
    ],
    crashExplain:[
      {h:'Why we invented it', t:'Sharing files needed walking with floppy disks. Networks made sharing instant.'},
      {h:'Real-world anchor', t:'Your home WiFi is a network. Every office LAN is a network. The Internet is a network of networks.'},
      {h:'Common trap', t:'Students think network needs many computers. Even 2 devices count.'}
    ],
    compare:{
      left:'Network', right:'Distributed System',
      rows:[
        ['Definition','Devices connected to share data','Independent computers look like ONE system'],
        ['Example','Home WiFi, Office LAN','World Wide Web'],
        ['Middleware','Not needed','Needed — sits on top of OS'],
        ['User view','Sees separate machines','Sees one coherent system']
      ],
      bars:[
        {label:'Complexity', leftPct:35, rightPct:95, leftTxt:'Low', rightTxt:'High'},
        {label:'Transparency', leftPct:20, rightPct:100, leftTxt:'Visible', rightTxt:'Hidden'},
        {label:'Common use', leftPct:100, rightPct:40, leftTxt:'Everywhere', rightTxt:'Specialised'},
        {label:'Setup cost', leftPct:30, rightPct:85, leftTxt:'₹', rightTxt:'₹₹₹'}
      ]
    },
    compareExplain:[
      {h:'Key difference', t:'A network is what you see — separate computers. A distributed system is what users THINK they see — one big machine.'},
      {h:'Why it matters', t:'Exams ask this distinction. Remember: middleware is the glue that makes a distributed system.'},
      {h:'Real example', t:'The Web runs ON TOP of the Internet. The Internet is a network; the Web is a distributed system.'}
    ],
    solve:{
      q:'A network has 5 nodes connected in a full mesh. How many links are needed?',
      steps:[
        {label:'STEP 1 — FORMULA',    math:'Links = n(n−1)/2',                note:'Full mesh formula'},
        {label:'STEP 2 — GIVEN',      math:'n = 5 nodes',                     note:'Each node connects to all others'},
        {label:'STEP 3 — SUBSTITUTE', math:'Links = 5 × 4 / 2',               note:'Insert n = 5'},
        {label:'STEP 4 — CALCULATE',  math:'Links = 20 / 2 = 10',             note:'Simple arithmetic'},
        {label:'ANSWER',              math:'10 links',                        note:'For a 5-node full mesh'}
      ]
    },
    solveExplain:[
      {h:'What is n?', t:'n is the number of nodes in the network. Here n = 5.'},
      {h:'Why divide by 2?', t:'If you just multiply 5 × 4 = 20, each link is counted twice (A→B and B→A). Divide by 2 to get the true count.'},
      {h:'Why this formula?', t:'Every node links to n−1 others. Total = n(n−1). Divide by 2 for double-counting.'},
      {h:'Why units matter?', t:'n must be a count (integer). Fractional nodes make no sense.'},
      {h:'How values change answer?', t:'Double n → 4× the links. Grows quadratically.'}
    ],
    life:[
      {ic:'🏠', h:'Home WiFi', t:'Laptop, mobile, TV, printer all connected to one router.'},
      {ic:'🏢', h:'Office LAN', t:'Every desk computer connects to the office switch.'},
      {ic:'🏧', h:'ATM Network', t:'Your bank ATM talks to a central server.'},
      {ic:'📱', h:'Mobile Data', t:'Your phone talks to cell towers — a wireless network.'},
      {ic:'🎮', h:'Online Gaming', t:'Your console connects to game servers and other players.'},
      {ic:'🛰️', h:'GPS', t:'Satellites form a network to locate your position.'}
    ],
    lifeExplain:[
      {h:'Same concept, everywhere', t:'Every modern device is part of a network. Understanding the base concept unlocks all of them.'},
      {h:'Scale doesn\'t change the idea', t:'Two laptops or a billion devices — the concept is identical.'}
    ],
    history:[
      {yr:'1969', h:'ARPANET Born', t:'First network — 4 universities connected. The seed of the Internet.'},
      {yr:'1972', h:'First Email', t:'Ray Tomlinson sent the first email. The @ symbol was chosen.'},
      {yr:'1983', h:'TCP/IP Standard', t:'Vint Cerf and Bob Kahn — the protocol that runs the modern Internet.'},
      {yr:'1989', h:'World Wide Web', t:'Tim Berners-Lee invented the Web at CERN.'},
      {yr:'1995', h:'Public Internet', t:'India got its first public internet connection from VSNL.'},
      {yr:'Today', h:'5G + IoT', t:'Billions of devices connected. Smart homes, cars, wearables.'}
    ],
    historyExplain:[
      {h:'Why 1969 matters', t:'Before ARPANET, computers were isolated. The idea of "connected computers" was revolutionary.'},
      {h:'India connection', t:'VSNL brought the internet to India in 1995. Before that, only a few institutions had access.'},
      {h:'The pattern', t:'Every decade brought more devices online. Now the network includes everything.'}
    ],
    flash:[
      {q:'What is a network?', a:'Two or more devices connected by links to share data.'},
      {q:'Minimum devices needed?', a:'Two. One cannot form a network.'},
      {q:'What is a node?', a:'Any device that can send or receive data on the network.'},
      {q:'What is a link?', a:'The communication path between two nodes.'},
      {q:'Is the Internet a network?', a:'Yes — a network of networks.'},
      {q:'What is a distributed system?', a:'Independent computers that look like one system to the user.'},
      {q:'What is middleware?', a:'Software layer above the OS that makes distributed systems work.'},
      {q:'Real example of distributed system?', a:'The World Wide Web.'}
    ],
    flashExplain:[
      {h:'Active recall', t:'Say the answer out loud before flipping. If wrong, revisit.'},
      {h:'Spaced repetition', t:'Review cards after 1 day, 3 days, 7 days — that is how memory sticks.'}
    ],
    exam:[
      {q:'Define a computer network. Give two examples.', a:'A collection of interconnected devices sharing data. Examples: home WiFi, office LAN.'},
      {q:'Difference between a network and a distributed system?', a:'In a network users see separate machines. In a distributed system users see one coherent system. Middleware bridges the gap.'},
      {q:'What is a node and a link?', a:'Node = a device on the network. Link = the physical or wireless path connecting two nodes.'},
      {q:'What is the Internet?', a:'A network of networks — hundreds of thousands of interconnected networks worldwide.'},
      {q:'What is middleware? Give one example.', a:'Software between OS and application that hides distribution. Example: web browser + HTTP.'}
    ],
    examExplain:[
      {h:'Exam pattern', t:'Definitions = 2 marks. Comparisons = 5 marks. Applications = 3 marks.'},
      {h:'Key trap', t:'Many students mix up network vs distributed system. Remember: middleware is the deciding factor.'},
      {h:'Marks strategy', t:'Lead with the definition. Then one example. Then one line on significance.'}
    ],
    eli5:{
      kid:'Beta, imagine two friends with toy telephones connected by a string. They can talk. That is a network.',
      middle:'A network is two or more devices connected so they can share data. The connection can be a cable or wireless. Even two laptops connected by a cable are a network.',
      engg:'A computer network is a set of autonomous computers interconnected by a single technology. Two computers are interconnected if they can exchange information. The connection medium may be copper, fiber, microwave, infrared, or satellite. The Internet is the largest example — a network of networks.'
    },
    eli5Explain:[
      {h:'Why three levels?', t:'Same idea, three audiences. Brain builds understanding faster when you see the concept at multiple depths.'},
      {h:'How to use', t:'Read the kid version first — it seeds intuition. Then the middle for exam answer. Then the engineering version for depth.'}
    ]
  },

  'uses': {
    crash:[
      { tag:'INTRO', text:"Vanakkam, students. Next topic — Uses of Computer Networks. Intha topic la, networks enna ellaa vishayathula use aaguthu nu paakalaam.", visual:`<div style="text-align:center"><div style="font-size:80px;animation:pulse 2s ease-in-out infinite">🌍</div><div style="color:#2dd4bf;font-weight:900;font-size:22px;margin-top:16px">USES OF NETWORKS</div><div style="color:#6b7280;font-size:13px;margin-top:8px">Where they help us daily</div></div>`, readMs:5200 },
      { tag:'BUSINESS', text:"Business la — printer sharing, email, video calls, cloud storage. Ellaa company-um network use panraanga.", visual:`<div style="display:flex;gap:24px;justify-content:center;flex-wrap:wrap"><div style="text-align:center"><div style="font-size:56px">🖨️</div><div style="color:#cbd5e1;font-size:11px;margin-top:6px">Shared printer</div></div><div style="text-align:center"><div style="font-size:56px">📧</div><div style="color:#cbd5e1;font-size:11px;margin-top:6px">Email</div></div><div style="text-align:center"><div style="font-size:56px">📞</div><div style="color:#cbd5e1;font-size:11px;margin-top:6px">VoIP</div></div><div style="text-align:center"><div style="font-size:56px">☁️</div><div style="color:#cbd5e1;font-size:11px;margin-top:6px">Cloud</div></div></div>`, readMs:5000 },
      { tag:'HOME', text:"Home la — Netflix, YouTube, online shopping, smart home devices. Ellaa-um network-a depend aaguthu.", visual:`<div style="display:flex;gap:24px;justify-content:center;flex-wrap:wrap"><div style="text-align:center"><div style="font-size:56px">🎬</div><div style="color:#cbd5e1;font-size:11px;margin-top:6px">Netflix</div></div><div style="text-align:center"><div style="font-size:56px">🛒</div><div style="color:#cbd5e1;font-size:11px;margin-top:6px">Shopping</div></div><div style="text-align:center"><div style="font-size:56px">🏠</div><div style="color:#cbd5e1;font-size:11px;margin-top:6px">Smart home</div></div><div style="text-align:center"><div style="font-size:56px">🎮</div><div style="color:#cbd5e1;font-size:11px;margin-top:6px">Online games</div></div></div>`, readMs:5000 },
      { tag:'MOBILE', text:"Mobile la — WhatsApp, GPS, mobile payments (GPay, PhonePe), NFC tap-to-pay. Ellaa-um wireless network.", visual:`<div style="display:flex;gap:24px;justify-content:center;flex-wrap:wrap"><div style="text-align:center"><div style="font-size:56px">💬</div><div style="color:#cbd5e1;font-size:11px;margin-top:6px">Chat</div></div><div style="text-align:center"><div style="font-size:56px">🗺️</div><div style="color:#cbd5e1;font-size:11px;margin-top:6px">GPS</div></div><div style="text-align:center"><div style="font-size:56px">💳</div><div style="color:#cbd5e1;font-size:11px;margin-top:6px">UPI payment</div></div><div style="text-align:center"><div style="font-size:56px">📡</div><div style="color:#cbd5e1;font-size:11px;margin-top:6px">NFC</div></div></div>`, readMs:5000 },
      { tag:'⚠️ SOCIAL ISSUES', text:"Good kooda irukku, bad kooda irukku. Phishing, botnets, privacy issues. Adhu pathi theriyanum.", visual:`<div style="text-align:center"><div style="display:flex;gap:30px;justify-content:center"><div><div style="font-size:56px">✅</div><div style="color:#22c55e;font-weight:800;margin-top:8px;font-size:12px">GOOD</div><div style="color:#cbd5e1;font-size:11px;margin-top:4px">Sharing · Learning<br>Connection</div></div><div><div style="font-size:56px">⚠️</div><div style="color:#ef4444;font-weight:800;margin-top:8px;font-size:12px">BAD</div><div style="color:#cbd5e1;font-size:11px;margin-top:4px">Phishing · Botnets<br>Privacy loss</div></div></div></div>`, readMs:5400 },
      { tag:'⚡ ONE LINE', text:"So one line la — networks are everywhere. Business, home, mobile, social. Ellaa life-um network-a depend aaguthu.", visual:`<div style="text-align:center"><div style="font-size:80px">🎯</div><div style="color:#2dd4bf;font-weight:900;font-size:18px;margin-top:20px;padding:20px 32px;background:rgba(45,212,191,.08);border:2px dashed rgba(45,212,191,.4);border-radius:16px;line-height:1.5;max-width:520px">Networks run modern life</div></div>`, readMs:4800 }
    ],
    crashExplain:[
      {h:'Why study uses?', t:'Understanding where networks apply helps you appreciate the design decisions behind them.'},
      {h:'Real anchor', t:'Today you used at least 10 networks — WhatsApp, GPay, Maps, YouTube, and more.'},
      {h:'Common trap', t:'Students think networks are only for the internet. They also run printers, ATMs, CCTV, and factory machines.'}
    ],
    compare:{
      left:'Business Uses', right:'Home Uses',
      rows:[
        ['Primary purpose','Resource sharing + productivity','Entertainment + convenience'],
        ['Example apps','Email, VoIP, ERP, CRM','Netflix, YouTube, gaming'],
        ['Users','Employees (many)','Family (few)'],
        ['Reliability need','Very high — 99.9% uptime','Comfort level']
      ],
      bars:[
        {label:'Users', leftPct:100, rightPct:30, leftTxt:'Many', rightTxt:'Few'},
        {label:'Uptime need', leftPct:100, rightPct:40, leftTxt:'99.9%', rightTxt:'Comfort'},
        {label:'Security', leftPct:100, rightPct:50, leftTxt:'Critical', rightTxt:'Medium'},
        {label:'Cost', leftPct:95, rightPct:35, leftTxt:'High', rightTxt:'Low'}
      ]
    },
    compareExplain:[
      {h:'Same tech, different needs', t:'Business and home both use the same networks, but priorities differ.'},
      {h:'Why it matters', t:'Exams often ask "compare business vs home network uses". Focus on purpose, users, and reliability.'},
      {h:'Pattern', t:'Business = many users + high reliability. Home = fewer users + convenience-focused.'}
    ],
    solve:{
      q:'A company of 100 employees switches to VoIP. If each call needs 64 kbps and 20 calls happen at once, what total bandwidth is needed?',
      steps:[
        {label:'STEP 1 — FORMULA',    math:'Total BW = per-call BW × concurrent calls', note:'Simple multiplication'},
        {label:'STEP 2 — GIVEN',      math:'64 kbps per call, 20 calls',                note:'Concurrent calls'},
        {label:'STEP 3 — SUBSTITUTE', math:'Total = 64 × 20',                          note:'Insert values'},
        {label:'STEP 4 — CALCULATE',  math:'Total = 1280 kbps',                        note:'Simple math'},
        {label:'ANSWER',              math:'1.28 Mbps',                                note:'Bandwidth required'}
      ]
    },
    solveExplain:[
      {h:'What is concurrent calls?', t:'How many calls happen at the same time. Not the total per day.'},
      {h:'Why per-call BW?', t:'Each VoIP call is compressed to a small bandwidth — usually 32 to 128 kbps.'},
      {h:'Real-world number', t:'Office internet plans are chosen based on this calculation. Small offices need 5–10 Mbps.'},
      {h:'Why units matter?', t:'Keep all units same. If mixing kbps and Mbps, convert first.'},
      {h:'How values change?', t:'Double calls → double bandwidth. Grows linearly.'}
    ],
    life:[
      {ic:'📧', h:'Office Email', t:'Every office uses email servers — a business network application.'},
      {ic:'🖨️', h:'Shared Printer', t:'One printer, ten computers — classic resource sharing.'},
      {ic:'📺', h:'Netflix', t:'Streaming video to millions — home entertainment at scale.'},
      {ic:'💳', h:'UPI Payments', t:'GPay / PhonePe use mobile networks for instant payments.'},
      {ic:'📞', h:'WhatsApp Call', t:'VoIP over internet — voice packets over network.'},
      {ic:'🎮', h:'Online Gaming', t:'Real-time data exchange between players worldwide.'}
    ],
    lifeExplain:[
      {h:'Ubiquity', t:'Almost everything you did today used a network. That is the point of this topic.'},
      {h:'Diversity', t:'From a printer to a video call — very different uses, same underlying networks.'}
    ],
    history:[
      {yr:'1970s', h:'Business Networks', t:'Banks and offices start using internal networks.'},
      {yr:'1980s', h:'Email boom', t:'Email becomes standard in companies worldwide.'},
      {yr:'1990s', h:'Home Internet', t:'Dial-up brings the internet to homes.'},
      {yr:'2000s', h:'Broadband + WiFi', t:'Always-on internet. Home networks become common.'},
      {yr:'2010s', h:'Mobile-first', t:'Smartphones make network access universal.'},
      {yr:'Today', h:'IoT Everywhere', t:'Smart homes, cars, wearables — all connected.'}
    ],
    historyExplain:[
      {h:'Pattern', t:'Each decade expanded the user base — from banks to homes to pockets.'},
      {h:'Trend', t:'More devices, more data, more uses. Exponential growth.'},
      {h:'India story', t:'India jumped straight to mobile — 4G before broadband reached many towns.'}
    ],
    flash:[
      {q:'Three main use categories?', a:'Business, Home, Mobile.'},
      {q:'Give a business use example.', a:'Email or resource sharing (printers, files).'},
      {q:'Give a home use example.', a:'Streaming Netflix, online shopping.'},
      {q:'What is VoIP?', a:'Voice over IP — telephone calls over internet.'},
      {q:'What is NFC used for?', a:'Tap-to-pay mobile payments.'},
      {q:'What is phishing?', a:'A social engineering attack to steal credentials.'},
      {q:'What is a botnet?', a:'A network of compromised devices controlled by an attacker.'},
      {q:'Main social issue with networks?', a:'Privacy loss and security risks.'}
    ],
    flashExplain:[
      {h:'Why these cards', t:'Each card targets one category or one risk. Memorize the categories first.'},
      {h:'How to use', t:'Say the answer out loud before flipping. Retest in 24 hours.'}
    ],
    exam:[
      {q:'Explain four uses of computer networks.', a:'Business — resource sharing, email, VoIP. Home — entertainment, shopping. Mobile — GPS, payments. Social — messaging, content.'},
      {q:'What is VoIP? How does it work?', a:'Voice over Internet Protocol. Voice is digitized, packetized, and sent over IP networks instead of traditional phone lines.'},
      {q:'What is phishing? Give one prevention method.', a:'Phishing is a social engineering attack to steal credentials. Prevention: verify sender, use 2FA, never click unknown links.'},
      {q:'Explain business vs home network uses.', a:'Business: many users, high reliability, resource sharing. Home: fewer users, entertainment-focused, lower cost.'},
      {q:'What is m-commerce? Give two examples.', a:'Mobile commerce — buying goods via mobile apps. Examples: UPI payments, Amazon app orders.'}
    ],
    examExplain:[
      {h:'Exam pattern', t:'Usually asks for 3–4 uses with examples. Structure answer by category.'},
      {h:'Common trap', t:'Students list uses without examples. Always add one — it earns extra marks.'},
      {h:'Marks strategy', t:'Categorize first (business/home/mobile/social), then give one example per category.'}
    ],
    eli5:{
      kid:'Beta, imagine you share your chocolate with friends — that is a network. Or you call grandma — that is a network too.',
      middle:'Computer networks are used in business (email, printers), home (streaming, shopping), mobile (GPS, payments), and social (chat, content sharing).',
      engg:'Computer networks are applied in four broad categories: business applications (resource sharing, client-server, VoIP, e-commerce), home applications (P2P, streaming, online shopping), mobile applications (texting, GPS, m-commerce, NFC), and social applications (content sharing, instant messaging), each with distinct reliability, security, and usability requirements.'
    },
    eli5Explain:[
      {h:'Why three levels', t:'Kid version gives intuition. Middle gives exam answer. Engineering gives depth.'},
      {h:'How to use', t:'Read all three. It builds layered understanding in 60 seconds.'}
    ]
  },

  'dataflow': {
    crash:[
      { tag:'INTRO', text:"Vanakkam, students. Next — Data Flow. Communication direction patthi paakalaam. Three types — simplex, half-duplex, full-duplex.", visual:`<div style="text-align:center"><div style="font-size:80px;animation:pulse 2s ease-in-out infinite">↔️</div><div style="color:#2dd4bf;font-weight:900;font-size:22px;margin-top:16px">DATA FLOW</div><div style="color:#6b7280;font-size:13px;margin-top:8px">Direction of data movement</div></div>`, readMs:5200 },
      { tag:'SIMPLEX', text:"Simplex — one way only. Keyboard and monitor. Nee keyboard la type pannaa, computer screen la kaattum. Reverse illa.", visual:`<svg viewBox="0 0 400 120" style="width:100%;max-width:400px"><rect x="40" y="35" width="80" height="50" rx="8" fill="#111a2e" stroke="#facc15" stroke-width="2"/><text x="80" y="65" text-anchor="middle" font-size="11" fill="#facc15" font-weight="800">KEYBOARD</text><rect x="280" y="35" width="80" height="50" rx="8" fill="#111a2e" stroke="#22c55e" stroke-width="2"/><text x="320" y="65" text-anchor="middle" font-size="11" fill="#22c55e" font-weight="800">COMPUTER</text><line x1="120" y1="60" x2="280" y2="60" stroke="#2dd4bf" stroke-width="3"/><polygon points="280,60 268,54 268,66" fill="#2dd4bf"/><circle r="6" fill="#facc15"><animateMotion dur="1.6s" repeatCount="indefinite" path="M 140 60 L 260 60"/></circle><text x="200" y="95" text-anchor="middle" font-size="11" fill="#cbd5e1" font-weight="700">ONE WAY →</text></svg>`, readMs:5000 },
      { tag:'HALF-DUPLEX', text:"Half-duplex — both directions, but one at a time. Walkie-talkie pola. Press to talk, release to listen.", visual:`<svg viewBox="0 0 400 120" style="width:100%;max-width:400px"><rect x="40" y="35" width="80" height="50" rx="8" fill="#111a2e" stroke="#facc15" stroke-width="2"/><text x="80" y="65" text-anchor="middle" font-size="11" fill="#facc15" font-weight="800">WALKIE A</text><rect x="280" y="35" width="80" height="50" rx="8" fill="#111a2e" stroke="#22c55e" stroke-width="2"/><text x="320" y="65" text-anchor="middle" font-size="11" fill="#22c55e" font-weight="800">WALKIE B</text><line x1="120" y1="50" x2="280" y2="50" stroke="#2dd4bf" stroke-width="2" stroke-dasharray="4 3"/><line x1="280" y1="70" x2="120" y2="70" stroke="#a78bfa" stroke-width="2" stroke-dasharray="4 3"/><text x="200" y="30" text-anchor="middle" font-size="10" fill="#2dd4bf" font-weight="800">A → B</text><text x="200" y="95" text-anchor="middle" font-size="10" fill="#a78bfa" font-weight="800">B → A</text></svg>`, readMs:5200 },
      { tag:'FULL-DUPLEX', text:"Full-duplex — both directions at the same time. Phone call pola. Rendu per-um onna pesalaam, onna kelkalaam.", visual:`<svg viewBox="0 0 400 120" style="width:100%;max-width:400px"><rect x="40" y="35" width="80" height="50" rx="8" fill="#111a2e" stroke="#facc15" stroke-width="2"/><text x="80" y="65" text-anchor="middle" font-size="11" fill="#facc15" font-weight="800">PERSON A</text><rect x="280" y="35" width="80" height="50" rx="8" fill="#111a2e" stroke="#22c55e" stroke-width="2"/><text x="320" y="65" text-anchor="middle" font-size="11" fill="#22c55e" font-weight="800">PERSON B</text><line x1="120" y1="50" x2="280" y2="50" stroke="#2dd4bf" stroke-width="2.5"/><line x1="280" y1="70" x2="120" y2="70" stroke="#a78bfa" stroke-width="2.5"/><circle r="4" fill="#2dd4bf"><animateMotion dur="1.4s" repeatCount="indefinite" path="M 140 50 L 260 50"/></circle><circle r="4" fill="#a78bfa"><animateMotion dur="1.4s" repeatCount="indefinite" path="M 260 70 L 140 70"/></circle></svg>`, readMs:5200 },
      { tag:'⚡ ONE LINE', text:"So one line la — simplex one-way, half-duplex take turns, full-duplex both at once. Simple.", visual:`<div style="text-align:center"><div style="font-size:80px">🎯</div><div style="color:#2dd4bf;font-weight:900;font-size:16px;margin-top:20px;padding:20px 32px;background:rgba(45,212,191,.08);border:2px dashed rgba(45,212,191,.4);border-radius:16px;line-height:1.6;max-width:520px">Simplex: 1-way<br>Half-duplex: take turns<br>Full-duplex: both at once</div></div>`, readMs:5200 }
    ],
    crashExplain:[
      {h:'Why this matters', t:'Direction of communication decides the hardware needed and the cost. Full-duplex is more expensive but faster.'},
      {h:'Real anchor', t:'Keyboard (simplex), walkie-talkie (half-duplex), phone call (full-duplex).'},
      {h:'Common trap', t:'Students think half-duplex is slower than full-duplex. Not always — it depends on usage.'}
    ],
    compare:{
      left:'Half-Duplex', right:'Full-Duplex',
      rows:[
        ['Direction','Both ways — one at a time','Both ways — simultaneous'],
        ['Example','Walkie-talkie, CB radio','Telephone, video call'],
        ['Capacity used','Shared — turn-based','Doubled — parallel'],
        ['Cost','Lower','Higher']
      ],
      bars:[
        {label:'Speed', leftPct:50, rightPct:100, leftTxt:'Shared', rightTxt:'Parallel'},
        {label:'Cost', leftPct:35, rightPct:85, leftTxt:'₹', rightTxt:'₹₹₹'},
        {label:'Latency', leftPct:70, rightPct:25, leftTxt:'Higher', rightTxt:'Lower'},
        {label:'Common use', leftPct:55, rightPct:100, leftTxt:'Radio', rightTxt:'Phone'}
      ]
    },
    compareExplain:[
      {h:'When to pick', t:'Half-duplex for cost-sensitive shared media. Full-duplex when both sides need to talk at once.'},
      {h:'Why full is costlier', t:'Requires separate paths or frequency bands for each direction.'},
      {h:'Real trade', t:'Telephone uses full-duplex. Old radios used half-duplex. Modern WiFi is full-duplex per frame.'}
    ],
    solve:{
      q:'A link transmits 1000 bits per second. If using half-duplex, what is the effective throughput when both sides talk equally?',
      steps:[
        {label:'STEP 1 — FORMULA',    math:'Effective = Total / 2',  note:'Half the time per direction'},
        {label:'STEP 2 — GIVEN',      math:'Total = 1000 bps',        note:'Link capacity'},
        {label:'STEP 3 — SUBSTITUTE', math:'Effective = 1000 / 2',    note:'Both directions equally'},
        {label:'STEP 4 — CALCULATE',  math:'Effective = 500 bps',     note:'Each direction'},
        {label:'ANSWER',              math:'500 bps per direction',   note:'Half-duplex throughput'}
      ]
    },
    solveExplain:[
      {h:'Why divide by 2?', t:'In half-duplex, only one side talks at a time. If both share equally, each gets half.'},
      {h:'Real-world example', t:'A 100 Mbps WiFi half-duplex link gives ~50 Mbps to each direction on average.'},
      {h:'Why units matter', t:'Always state per-direction or total. Mixing them causes confusion.'},
      {h:'Full-duplex comparison', t:'Full-duplex would give 1000 bps each way — twice the throughput.'},
      {h:'How values change', t:'Double link → double per-direction throughput.'}
    ],
    life:[
      {ic:'⌨️', h:'Keyboard', t:'Simplex — sends keystrokes to computer. No reverse flow.'},
      {ic:'📺', h:'TV Remote', t:'Simplex — sends IR signals to TV. TV does not reply.'},
      {ic:'📻', h:'Walkie-Talkie', t:'Half-duplex — press to talk, release to listen.'},
      {ic:'📞', h:'Phone Call', t:'Full-duplex — both can talk and hear simultaneously.'},
      {ic:'🎥', h:'Video Call', t:'Full-duplex — camera and mic work both ways.'},
      {ic:'🎮', h:'Online Game', t:'Full-duplex — your input and server updates flow together.'}
    ],
    lifeExplain:[
      {h:'Pattern', t:'Simple devices = simplex. Push-to-talk = half. Real-time conversation = full.'},
      {h:'Cost vs speed', t:'Full-duplex is fastest but costly. Match the mode to your use case.'}
    ],
    history:[
      {yr:'1837', h:'Telegraph', t:'Simplex — one-way communication over wires.'},
      {yr:'1876', h:'Telephone', t:'Full-duplex — voice both directions at once. Revolution.'},
      {yr:'1940s', h:'Walkie-Talkie', t:'Half-duplex radio for military use.'},
      {yr:'1970s', h:'Ethernet', t:'Half-duplex originally. Later moved to full-duplex with switches.'},
      {yr:'1990s', h:'Full-Duplex Modems', t:'Home internet became simultaneous up/down.'},
      {yr:'Today', h:'Full-Duplex WiFi', t:'Modern WiFi is full-duplex per frame.'}
    ],
    historyExplain:[
      {h:'Pattern', t:'Communication started simple (simplex), evolved to bidirectional (full-duplex).'},
      {h:'Why it changed', t:'Users wanted natural conversation. Full-duplex mimics face-to-face.'},
      {h:'Modern trend', t:'Almost all new technologies default to full-duplex.'}
    ],
    flash:[
      {q:'Simplex — define.', a:'One-way communication only.'},
      {q:'Give a simplex example.', a:'Keyboard to computer, TV remote.'},
      {q:'Half-duplex — define.', a:'Both directions but not at the same time.'},
      {q:'Give a half-duplex example.', a:'Walkie-talkie, CB radio.'},
      {q:'Full-duplex — define.', a:'Both directions simultaneously.'},
      {q:'Give a full-duplex example.', a:'Telephone, video call.'},
      {q:'Which is fastest?', a:'Full-duplex — parallel transmission.'},
      {q:'Which is cheapest?', a:'Simplex — only one direction hardware.'}
    ],
    flashExplain:[
      {h:'Mnemonic', t:'S = single, H = half-turn, F = full parallel.'},
      {h:'Exam tip', t:'Exams ask "identify the mode for X device". Practice the examples.'}
    ],
    exam:[
      {q:'Differentiate simplex, half-duplex, full-duplex with examples.', a:'Simplex: one-way (keyboard). Half-duplex: two-way take turns (walkie-talkie). Full-duplex: two-way simultaneously (phone).'},
      {q:'Why is full-duplex preferred for voice calls?', a:'Because both parties can talk and listen at the same time. Natural, no waiting.'},
      {q:'Which mode is used in traditional Ethernet?', a:'Half-duplex originally. Modern switched Ethernet uses full-duplex.'},
      {q:'Explain simplex with a real example.', a:'Simplex is one-way. Example: keyboard to computer, or TV remote to TV.'},
      {q:'What are the criteria for choosing the mode?', a:'Direction needed, cost, hardware, application requirement (real-time vs batch).'}
    ],
    examExplain:[
      {h:'Exam pattern', t:'Usually a comparison table with examples. Memorize one example per mode.'},
      {h:'Marks strategy', t:'Write the definition. Then draw a small diagram. Then give one example.'},
      {h:'Common trap', t:'Do not confuse half-duplex with simplex. Half-duplex has BOTH directions, just not at once.'}
    ],
    eli5:{
      kid:'Beta, three ways to talk. Simplex — only you talk. Half-duplex — you talk, then I talk, one at a time. Full-duplex — we both talk and listen at the same time.',
      middle:'Communication can be simplex (one-way like keyboard), half-duplex (take turns like walkie-talkie), or full-duplex (both at once like telephone). The choice depends on the application.',
      engg:'Data flow between two devices can be simplex (unidirectional), half-duplex (bidirectional non-simultaneous), or full-duplex (bidirectional simultaneous). Full-duplex offers the highest throughput but needs dedicated channels in each direction; simplex is cheapest but least flexible.'
    },
    eli5Explain:[
      {h:'Why three levels', t:'Same concept three ways. Builds layered understanding.'},
      {h:'Exam use', t:'The middle version is a perfect 2-mark answer. The engineering version is a 5-mark answer.'}
    ]
  },

  'topology': {
    crash:[
      { tag:'INTRO', text:"Vanakkam, students. Next topic — Physical Topology. Network-ah epdi arrange panraanga nu paakalaam. Mesh, star, bus, ring.", visual:`<div style="text-align:center"><div style="font-size:80px;animation:pulse 2s ease-in-out infinite">🔗</div><div style="color:#2dd4bf;font-weight:900;font-size:22px;margin-top:16px">PHYSICAL TOPOLOGY</div><div style="color:#6b7280;font-size:13px;margin-top:8px">How devices are wired together</div></div>`, readMs:5200 },
      { tag:'MESH', text:"Mesh — every node connects to every other node. Fastest, most reliable, but expensive. Vera level redundancy.", visual:`<svg viewBox="0 0 300 200" style="width:100%;max-width:300px"><line x1="150" y1="30" x2="270" y2="110" stroke="#2dd4bf" stroke-width="1.5"/><line x1="270" y1="110" x2="150" y2="170" stroke="#2dd4bf" stroke-width="1.5"/><line x1="150" y1="170" x2="30" y2="110" stroke="#2dd4bf" stroke-width="1.5"/><line x1="30" y1="110" x2="150" y2="30" stroke="#2dd4bf" stroke-width="1.5"/><line x1="150" y1="30" x2="150" y2="170" stroke="#2dd4bf" stroke-width="1.5"/><line x1="30" y1="110" x2="270" y2="110" stroke="#2dd4bf" stroke-width="1.5"/><circle cx="150" cy="30" r="16" fill="#111a2e" stroke="#2dd4bf" stroke-width="2"/><text x="150" y="35" text-anchor="middle" font-size="10" fill="#fff" font-weight="800">N1</text><circle cx="270" cy="110" r="16" fill="#111a2e" stroke="#2dd4bf" stroke-width="2"/><text x="270" y="115" text-anchor="middle" font-size="10" fill="#fff" font-weight="800">N2</text><circle cx="150" cy="170" r="16" fill="#111a2e" stroke="#2dd4bf" stroke-width="2"/><text x="150" y="175" text-anchor="middle" font-size="10" fill="#fff" font-weight="800">N3</text><circle cx="30" cy="110" r="16" fill="#111a2e" stroke="#2dd4bf" stroke-width="2"/><text x="30" y="115" text-anchor="middle" font-size="10" fill="#fff" font-weight="800">N4</text></svg>`, readMs:5000 },
      { tag:'STAR', text:"Star — all nodes connect to one central hub. Easy to manage, but if the hub fails, everything fails. Office la idhu common.", visual:`<svg viewBox="0 0 300 200" style="width:100%;max-width:300px"><line x1="150" y1="100" x2="50" y2="40" stroke="#2dd4bf" stroke-width="2"/><line x1="150" y1="100" x2="250" y2="40" stroke="#2dd4bf" stroke-width="2"/><line x1="150" y1="100" x2="50" y2="160" stroke="#2dd4bf" stroke-width="2"/><line x1="150" y1="100" x2="250" y2="160" stroke="#2dd4bf" stroke-width="2"/><rect x="120" y="82" width="60" height="36" rx="18" fill="#22c55e"/><text x="150" y="105" text-anchor="middle" font-size="11" fill="#000" font-weight="900">HUB</text><circle cx="50" cy="40" r="14" fill="#111a2e" stroke="#2dd4bf" stroke-width="2"/><text x="50" y="45" text-anchor="middle" font-size="9" fill="#fff">A</text><circle cx="250" cy="40" r="14" fill="#111a2e" stroke="#2dd4bf" stroke-width="2"/><text x="250" y="45" text-anchor="middle" font-size="9" fill="#fff">B</text><circle cx="50" cy="160" r="14" fill="#111a2e" stroke="#2dd4bf" stroke-width="2"/><text x="50" y="165" text-anchor="middle" font-size="9" fill="#fff">C</text><circle cx="250" cy="160" r="14" fill="#111a2e" stroke="#2dd4bf" stroke-width="2"/><text x="250" y="165" text-anchor="middle" font-size="9" fill="#fff">D</text></svg>`, readMs:5000 },
      { tag:'BUS', text:"Bus — one backbone cable. Ellaa node-um adha attach aagum. Cheap but backbone break aanaa ellaa-um down.", visual:`<svg viewBox="0 0 400 140" style="width:100%;max-width:400px"><line x1="30" y1="80" x2="370" y2="80" stroke="#2dd4bf" stroke-width="4"/><rect x="20" y="72" width="12" height="16" fill="#ef4444"/><rect x="368" y="72" width="12" height="16" fill="#ef4444"/><text x="26" y="102" text-anchor="middle" font-size="8" fill="#ef4444" font-weight="800">TERM</text><text x="374" y="102" text-anchor="middle" font-size="8" fill="#ef4444" font-weight="800">TERM</text><circle cx="100" cy="80" r="10" fill="#facc15"/><circle cx="200" cy="80" r="10" fill="#facc15"/><circle cx="300" cy="80" r="10" fill="#facc15"/><line x1="100" y1="70" x2="100" y2="45" stroke="#2dd4bf" stroke-width="1.5"/><rect x="85" y="25" width="30" height="20" rx="3" fill="#111a2e" stroke="#2dd4bf"/><line x1="200" y1="70" x2="200" y2="45" stroke="#2dd4bf" stroke-width="1.5"/><rect x="185" y="25" width="30" height="20" rx="3" fill="#111a2e" stroke="#2dd4bf"/><line x1="300" y1="70" x2="300" y2="45" stroke="#2dd4bf" stroke-width="1.5"/><rect x="285" y="25" width="30" height="20" rx="3" fill="#111a2e" stroke="#2dd4bf"/></svg>`, readMs:5000 },
      { tag:'RING', text:"Ring — closed loop. Data goes around in one direction. One break aanaa whole network down.", visual:`<svg viewBox="0 0 300 200" style="width:100%;max-width:300px"><circle cx="150" cy="100" r="70" fill="none" stroke="#2dd4bf" stroke-width="2.5"/><circle cx="150" cy="30" r="14" fill="#111a2e" stroke="#2dd4bf" stroke-width="2"/><text x="150" y="35" text-anchor="middle" font-size="9" fill="#fff">N1</text><circle cx="220" cy="100" r="14" fill="#111a2e" stroke="#2dd4bf" stroke-width="2"/><text x="220" y="105" text-anchor="middle" font-size="9" fill="#fff">N2</text><circle cx="150" cy="170" r="14" fill="#111a2e" stroke="#2dd4bf" stroke-width="2"/><text x="150" y="175" text-anchor="middle" font-size="9" fill="#fff">N3</text><circle cx="80" cy="100" r="14" fill="#111a2e" stroke="#2dd4bf" stroke-width="2"/><text x="80" y="105" text-anchor="middle" font-size="9" fill="#fff">N4</text><circle r="6" fill="#facc15"><animateMotion dur="3s" repeatCount="indefinite" path="M 150 30 A 70 70 0 1 1 149.9 30"/></circle></svg>`, readMs:5000 },
      { tag:'⚡ ONE LINE', text:"So one line la — mesh (expensive, redundant), star (common, SPOF), bus (cheap), ring (loop). Hybrid combines them.", visual:`<div style="text-align:center"><div style="font-size:80px">🎯</div><div style="color:#2dd4bf;font-weight:900;font-size:16px;margin-top:20px;padding:20px 32px;background:rgba(45,212,191,.08);border:2px dashed rgba(45,212,191,.4);border-radius:16px;line-height:1.6;max-width:520px">Mesh · Star · Bus · Ring · Hybrid</div></div>`, readMs:5200 }
    ],
    crashExplain:[
      {h:'Why topology matters', t:'The physical layout decides cost, speed, redundancy, and how easy it is to troubleshoot.'},
      {h:'Real anchor', t:'Office uses star. Old cable TV used bus. Data centres use mesh. Campus uses hybrid.'},
      {h:'Common trap', t:'Students think topology = cable type. Topology is about arrangement, not cable.'}
    ],
    compare:{
      left:'Star', right:'Mesh',
      rows:[
        ['Links for n nodes','n','n(n−1)/2'],
        ['Cost','Low','High'],
        ['Redundancy','None — hub is SPOF','Very high'],
        ['Troubleshooting','Easy','Complex'],
        ['Common use','LANs, offices','Data centres, WAN backbones']
      ],
      bars:[
        {label:'Cost', leftPct:25, rightPct:100, leftTxt:'Low', rightTxt:'High'},
        {label:'Redundancy', leftPct:15, rightPct:100, leftTxt:'None', rightTxt:'Max'},
        {label:'Links (n=6)', leftPct:35, rightPct:100, leftTxt:'6', rightTxt:'15'},
        {label:'Complexity', leftPct:25, rightPct:95, leftTxt:'Easy', rightTxt:'Hard'}
      ]
    },
    compareExplain:[
      {h:'Choose by need', t:'Cost-sensitive + small network → star. High reliability + money → mesh.'},
      {h:'Why star is everywhere', t:'Cheap, easy to add nodes, easy to find faults. Used in every office LAN.'},
      {h:'Why mesh is for backbone', t:'Multiple paths mean no single failure breaks the network.'}
    ],
    solve:{
      q:'A full mesh has 8 nodes. How many links are needed?',
      steps:[
        {label:'STEP 1 — FORMULA',    math:'Links = n(n−1)/2',  note:'Full mesh formula'},
        {label:'STEP 2 — GIVEN',      math:'n = 8',             note:'8 nodes'},
        {label:'STEP 3 — SUBSTITUTE', math:'Links = 8 × 7 / 2', note:'Insert n=8'},
        {label:'STEP 4 — CALCULATE',  math:'Links = 56 / 2 = 28', note:'Arithmetic'},
        {label:'ANSWER',              math:'28 links',          note:'For 8-node full mesh'}
      ]
    },
    solveExplain:[
      {h:'What is n?', t:'Number of nodes. Here n = 8.'},
      {h:'Why divide by 2?', t:'Each link counted twice. A→B and B→A are the same physical link.'},
      {h:'Growth rate', t:'O(n²). Doubling nodes → 4× links. Explains high cost.'},
      {h:'Why formula works', t:'Each node links to n−1 others. Total n(n−1). Divide by 2 to remove double-counting.'},
      {h:'Practical limit', t:'Full mesh is used only for small networks or backbones.'}
    ],
    life:[
      {ic:'🏢', h:'Office LAN', t:'Star topology with a central switch.'},
      {ic:'📡', h:'Data Centre', t:'Mesh topology between core switches for redundancy.'},
      {ic:'📺', h:'Old Cable TV', t:'Bus topology — one coaxial cable for all homes.'},
      {ic:'🏫', h:'Campus Network', t:'Hybrid — star + bus branches.'},
      {ic:'🎮', h:'LAN Party', t:'Star — all PCs connect to one switch.'},
      {ic:'☁️', h:'Cloud Backbone', t:'Mesh — multiple paths for high availability.'}
    ],
    lifeExplain:[
      {h:'Where each type lives', t:'Star for offices. Bus for old cable TV. Mesh for data centres. Hybrid for campuses.'},
      {h:'Why mix', t:'Cost + reliability tradeoffs. Rarely one topology alone.'}
    ],
    history:[
      {yr:'1960s', h:'Bus Topology', t:'Early Ethernet used bus. Simple and cheap.'},
      {yr:'1970s', h:'Ring Topology', t:'IBM Token Ring — reliable and ordered.'},
      {yr:'1980s', h:'Star Rise', t:'Central hubs became cheap. Star became dominant.'},
      {yr:'1990s', h:'Switched Star', t:'Switch replaced hub. Dedicated bandwidth per node.'},
      {yr:'2000s', h:'Mesh Backbones', t:'ISPs built mesh backbones for reliability.'},
      {yr:'Today', h:'Hybrid Everywhere', t:'Real networks combine 2–3 topologies.'}
    ],
    historyExplain:[
      {h:'Pattern', t:'Started simple (bus), evolved to reliable (mesh) and easy (star).'},
      {h:'Why star won', t:'Cheap, easy to expand, easy to troubleshoot. Office-friendly.'},
      {h:'Modern truth', t:'Real networks are hybrid. Pure topology exists only in textbooks.'}
    ],
    flash:[
      {q:'Mesh formula for links?', a:'n(n−1)/2'},
      {q:'Star topology SPOF?', a:'The central hub or switch.'},
      {q:'Bus cable ends need?', a:'Terminators at both ends.'},
      {q:'Ring data direction?', a:'Typically one direction (unidirectional).'},
      {q:'Most common LAN topology?', a:'Star.'},
      {q:'Cheapest topology?', a:'Bus (single cable).'},
      {q:'Most redundant topology?', a:'Full mesh.'},
      {q:'What is hybrid topology?', a:'A combination of two or more basic topologies.'}
    ],
    flashExplain:[
      {h:'Mnemonic', t:'MSBR — Mesh Star Bus Ring. Add H for Hybrid.'},
      {h:'Exam tip', t:'Know the formula for mesh + one example per topology.'}
    ],
    exam:[
      {q:'Compare mesh, star, bus, and ring topologies.', a:'Mesh: n(n−1)/2 links, high cost, high redundancy. Star: n links, SPOF at hub. Bus: 1 backbone, cheap, break = all down. Ring: closed loop, break = all down.'},
      {q:'How many links for a full mesh of 5 nodes?', a:'5 × 4 / 2 = 10 links.'},
      {q:'What happens if the central hub fails in star?', a:'The entire network goes down — hub is single point of failure.'},
      {q:'Why are terminators needed in bus topology?', a:'To absorb signal reflections at cable ends, preventing collisions.'},
      {q:'Give one real-world example of each topology.', a:'Mesh: data centres. Star: office LAN. Bus: legacy cable TV. Ring: IBM Token Ring.'}
    ],
    examExplain:[
      {h:'Exam pattern', t:'Usually a table comparing 4 topologies. Prepare a 5-row table.'},
      {h:'Marks strategy', t:'Cost, redundancy, formula, one example per topology. That covers all typical questions.'},
      {h:'Common trap', t:'Do not write "star is best" without reason. Always justify with cost/redundancy.'}
    ],
    eli5:{
      kid:'Beta, four ways to connect friends with ropes. Mesh — everyone holds ropes to everyone. Star — everyone holds one rope to the teacher. Bus — one long rope, everyone holds it. Ring — rope makes a circle.',
      middle:'Network topologies describe how devices are wired. Mesh is fully connected (expensive). Star uses a central hub (common in offices). Bus uses one shared cable (cheap). Ring connects in a loop (rare today).',
      engg:'Physical topologies define the geometric arrangement of links and nodes. Full mesh uses n(n−1)/2 duplex links for maximum redundancy. Star uses n links to a central hub — simple but hub-dependent. Bus uses a single backbone with terminators. Ring forms a closed loop with repeaters. Hybrid topologies combine two or more to balance cost and reliability.'
    },
    eli5Explain:[
      {h:'Why visualise', t:'Topologies are easiest to understand as pictures. Draw each before exams.'},
      {h:'Exam shortcut', t:'Sketch + 2-line compare = full marks on topology questions.'}
    ]
  },

  'media': {
    crash: [
      { tag:'INTRO', text:"Vanakkam, students. Today we are going to learn about Transmission Media. Simple-a sollanum na — data travel panna enna use aaguthu-nu paakalaam.", visual:`<div style="text-align:center"><div style="font-size:80px;animation:pulse 2s ease-in-out infinite">📡</div><div style="color:#2dd4bf;font-weight:900;font-size:22px;margin-top:16px">TRANSMISSION MEDIA</div><div style="color:#6b7280;font-size:13px;margin-top:8px">The path your data takes</div></div>`, readMs:5200 },
      { tag:'REAL LIFE', text:"Imagine pannunga — you want to send a letter to your friend. You can walk to their house and give it directly. That walking path is basically a cable, students.", visual:`<svg viewBox="0 0 400 160" style="width:100%;max-width:400px"><line x1="60" y1="80" x2="340" y2="80" stroke="#2dd4bf" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="80" r="18" fill="#111a2e" stroke="#facc15" stroke-width="2"/><text x="60" y="86" text-anchor="middle" font-size="12" fill="#facc15" font-weight="800">A</text><circle cx="340" cy="80" r="18" fill="#111a2e" stroke="#22c55e" stroke-width="2"/><text x="340" y="86" text-anchor="middle" font-size="12" fill="#22c55e" font-weight="800">B</text><circle r="6" fill="#facc15"><animateMotion dur="1.8s" repeatCount="indefinite" path="M 80 80 L 320 80"/></circle><text x="200" y="130" text-anchor="middle" font-size="13" fill="#cbd5e1" font-weight="700">📦 Physical cable</text></svg>`, readMs:5000 },
      { tag:'REAL LIFE', text:"Or — you can just shout the message across. That shout travels through the air. Adhu-dhaan wireless, students. No cable needed.", visual:`<svg viewBox="0 0 400 160" style="width:100%;max-width:400px"><circle cx="60" cy="80" r="18" fill="#111a2e" stroke="#facc15" stroke-width="2"/><text x="60" y="86" text-anchor="middle" font-size="12" fill="#facc15" font-weight="800">A</text><circle cx="340" cy="80" r="18" fill="#111a2e" stroke="#22c55e" stroke-width="2"/><text x="340" y="86" text-anchor="middle" font-size="12" fill="#22c55e" font-weight="800">B</text><circle cx="200" cy="80" r="24" fill="none" stroke="#a78bfa" stroke-width="2"><animate attributeName="r" values="24;90;24" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="2.4s" repeatCount="indefinite"/></circle><text x="200" y="130" text-anchor="middle" font-size="13" fill="#cbd5e1" font-weight="700">📶 Wireless signal</text></svg>`, readMs:5000 },
      { tag:'EVERYDAY', text:"Real life la idhu dhaan — WiFi wireless, LAN cable wired. Rendu-um already use panraanga, but different situations ku different choice.", visual:`<div style="display:flex;gap:60px;justify-content:center;flex-wrap:wrap"><div style="text-align:center"><div style="font-size:72px">📶</div><div style="color:#a78bfa;font-weight:900;margin-top:14px;font-size:15px">WIRELESS</div><div style="color:#6b7280;font-size:11px">WiFi · Radio · Infrared</div></div><div style="text-align:center"><div style="font-size:72px">🔌</div><div style="color:#2dd4bf;font-weight:900;margin-top:14px;font-size:15px">WIRED</div><div style="color:#6b7280;font-size:11px">Copper · Fiber</div></div></div>`, readMs:5000 },
      { tag:'⚠️ CAREFUL', text:"Idhu important, students — ellaa media-um same speed illa. Fiber is the fastest. Copper is cheaper. Wireless is the easiest to set up.", visual:`<div style="display:flex;gap:20px;justify-content:center;align-items:flex-end"><div style="text-align:center"><div style="height:180px;width:50px;background:linear-gradient(180deg,#22c55e,#166534);border-radius:8px 8px 0 0"></div><div style="margin-top:10px;color:#22c55e;font-weight:900;font-size:13px">FIBER</div><div style="color:#6b7280;font-size:10px">Fastest</div></div><div style="text-align:center"><div style="height:120px;width:50px;background:linear-gradient(180deg,#facc15,#a16207);border-radius:8px 8px 0 0"></div><div style="margin-top:10px;color:#facc15;font-weight:900;font-size:13px">COPPER</div><div style="color:#6b7280;font-size:10px">Cheaper</div></div><div style="text-align:center"><div style="height:80px;width:50px;background:linear-gradient(180deg,#a78bfa,#6d28d9);border-radius:8px 8px 0 0"></div><div style="margin-top:10px;color:#a78bfa;font-weight:900;font-size:13px">WIRELESS</div><div style="color:#6b7280;font-size:10px">Easiest</div></div></div>`, readMs:5600 },
      { tag:'⚡ ONE LINE', text:"So one line la — cables or air, adhu dhaan the path your data takes. Simple. Semma clarify aaguthula? Now let's see it in action.", visual:`<div style="text-align:center"><div style="font-size:80px">🎯</div><div style="color:#2dd4bf;font-weight:900;font-size:18px;margin-top:20px;padding:20px 32px;background:rgba(45,212,191,.08);border:2px dashed rgba(45,212,191,.4);border-radius:16px;line-height:1.5;max-width:520px">Cables or air —<br>the path your data takes.</div></div>`, readMs:5200 }
    ],
    crashExplain:[
      {h:'Why this topic matters', t:'Every network you use — WiFi, mobile, internet — runs on some transmission medium.'},
      {h:'Real-world anchor', t:'Your WiFi uses radio. Your LAN cable uses copper. Your TV cable uses coax.'},
      {h:'Common trap', t:'Students think "wireless = slow, wired = fast". Not true — 4G wireless beats copper.'}
    ],
    compare:{
      left:'Twisted-Pair', right:'Fiber-Optic',
      rows:[['Cost','Cheap','Expensive'],['Speed','10–1000 Mbps','10+ Gbps'],['Distance','100 m before repeater','50 km before repeater'],['EMI','Picks up noise','Immune to noise'],['Used in','LANs, telephones','Backbones, ISP']],
      bars:[
        {label:'Speed',    leftPct:30,  rightPct:100, leftTxt:'1 Gbps', rightTxt:'10 Gbps'},
        {label:'Distance', leftPct:15,  rightPct:100, leftTxt:'100 m',  rightTxt:'50 km'},
        {label:'Cost',     leftPct:20,  rightPct:90,  leftTxt:'₹',      rightTxt:'₹₹₹₹'},
        {label:'EMI Safe', leftPct:25,  rightPct:100, leftTxt:'Low',    rightTxt:'Perfect'}
      ]
    },
    compareExplain:[
      {h:'When to pick twisted-pair', t:'Short distance (under 100 m), tight budget, LAN. Every office uses it.'},
      {h:'When to pick fiber', t:'Long distance, high speed, EMI-heavy. Every ISP and data centre uses it.'},
      {h:'Why the difference?', t:'Copper carries electricity — affected by noise. Fiber carries light — unaffected.'}
    ],
    solve:{
      q:'A network sends 200-bit frames at 2 Kb/s. Find the one-way transmission time.',
      steps:[
        {label:'STEP 1 — FORMULA',    math:'T = B / R',                       note:'Start with the formula'},
        {label:'STEP 2 — GIVEN',      math:'B = 200 bits,  R = 2000 bits/s',  note:'Convert 2 Kb/s → 2000 b/s'},
        {label:'STEP 3 — SUBSTITUTE', math:'T = 200 / 2000',                  note:'Insert values'},
        {label:'STEP 4 — CALCULATE',  math:'T = 0.1',                         note:'Simple division'},
        {label:'ANSWER',              math:'T = 0.1 s = 100 ms',              note:'Time to send one frame'}
      ]
    },
    solveExplain:[
      {h:'What is T?', t:'Transmission time — how long to push one frame onto the wire. Unit: seconds.'},
      {h:'What is B?', t:'Frame size in bits. Here B = 200 bits.'},
      {h:'What is R?', t:'Link speed in bits per second. Here R = 2000 b/s.'},
      {h:'Why this formula?', t:'T = B / R because time = amount of data ÷ flow speed.'},
      {h:'Why units matter?', t:'Mix Kb/s with bits → answer off by 1000×. Always convert.'},
      {h:'How values change answer?', t:'Double B → double T. Double R → half T.'}
    ],
    life:[
      {ic:'📺', h:'TV Remote', t:'Uses infrared — short range, cannot pass walls.'},
      {ic:'📶', h:'WiFi Router', t:'Uses radio waves in 2.4 or 5 GHz. Wireless medium.'},
      {ic:'🏧', h:'ATM Machine', t:'Uses fiber or copper cables to reach bank servers.'},
      {ic:'📱', h:'Mobile 5G', t:'Uses microwave radio waves. High bandwidth wireless.'},
      {ic:'🏢', h:'Office LAN', t:'Uses twisted-pair copper (Cat 6). Cheap, easy.'},
      {ic:'🛰️', h:'Satellite TV', t:'Uses microwave uplink/downlink to satellites.'}
    ],
    lifeExplain:[
      {h:'Why we mix media', t:'No single medium is best for every situation. Cost, distance, mobility, speed decide.'},
      {h:'The pattern', t:'Short + cheap → copper. Long + fast → fiber. Mobile → wireless.'}
    ],
    history:[
      {yr:'1837', h:'Telegraph', t:'Samuel Morse — first electrical long-distance communication.'},
      {yr:'1876', h:'Telephone', t:'Alexander Graham Bell — voice over copper twisted-pair.'},
      {yr:'1880s', h:'Coaxial Cable', t:'Oliver Heaviside invented coax. Better bandwidth.'},
      {yr:'1955', h:'Fiber Optics', t:'Narinder Singh Kapany — father of fiber optics.'},
      {yr:'1970s', h:'Corning Glass', t:'First low-loss optical fiber. Revolutionized long-distance.'},
      {yr:'Today', h:'Fibre to Home', t:'FTTH in India — Jio, Airtel. 1 Gbps to homes.'}
    ],
    historyExplain:[
      {h:'Why study history?', t:'Every tech exists because someone solved a problem. The why makes the what stick.'},
      {h:'The trend', t:'Copper → coax → fiber → wireless. Each generation solved a limit.'},
      {h:'Proud fact', t:'Fiber optics demonstrated by an Indian — Narinder Singh Kapany.'}
    ],
    flash:[
      {q:'What is a transmission medium?', a:'Physical path that carries data from sender to receiver.'},
      {q:'Two classes of media?', a:'Guided (wired) and Unguided (wireless).'},
      {q:'Which medium is fastest?', a:'Fiber-optic — carries light, huge bandwidth.'},
      {q:'Which medium is immune to EMI?', a:'Fiber-optic. Carries light, not electricity.'},
      {q:'Twisted-pair connector?', a:'RJ45.'},
      {q:'Coaxial connector?', a:'BNC.'},
      {q:'Infrared limitation?', a:'Cannot pass walls. Short range only.'},
      {q:'Cheapest medium?', a:'Twisted-pair copper.'}
    ],
    flashExplain:[
      {h:'How to use', t:'Read the question. Say the answer out loud. Then flip. Wrong? Repeat after 10 cards.'},
      {h:'Why it works', t:'Spaced repetition + active recall — most proven study method.'}
    ],
    exam:[
      {q:'Define transmission medium. Give two examples of each class.', a:'Physical path for data. Guided: twisted-pair, coaxial, fiber. Unguided: radio, microwave, infrared.'},
      {q:'Compare twisted-pair and fiber-optic on cost, speed, EMI.', a:'Twisted-pair: cheap, 100 Mbps–1 Gbps, suffers EMI. Fiber: costly, 10+ Gbps, immune.'},
      {q:'Why does fiber allow 50 km without a repeater?', a:'Light suffers very low attenuation in glass. Copper loses signal faster.'},
      {q:'Explain why infrared cannot pass through walls.', a:'Very high frequency. Solid objects block it. Line-of-sight only.'},
      {q:'What is FTTH? Why is it important?', a:'Fiber to the Home. Direct fiber into homes. Enables 1 Gbps internet.'}
    ],
    examExplain:[
      {h:'Exam pattern', t:'Most questions ask definition + comparison + application. Master those three.'},
      {h:'Marks strategy', t:'Definitions = 2 marks. Comparisons = 5. Applications = 3. Focus first on definitions.'},
      {h:'Common mistake', t:'Too much writing on definitions. Keep them 1–2 lines.'}
    ],
    eli5:{
      kid:'Beta, imagine you send a toy to your friend. You can walk and give it — that is a cable. Or shout — that is wireless.',
      middle:'Transmission media are paths that carry signals. Guided uses a conductor — twisted-pair, coax, fiber. Unguided uses waves — radio, microwave, infrared.',
      engg:'Transmission media are classified into guided (twisted-pair, coaxial, fiber) and unguided (radio, microwave, infrared). Selection based on bandwidth, attenuation, EMI immunity, and cost. Fiber offers highest bandwidth (10+ Gbps) and 50 km reach without regeneration.'
    },
    eli5Explain:[
      {h:'Why three levels?', t:'Same concept, three audiences. Brain grasps better when you see it at multiple depths.'},
      {h:'How to use', t:'Start at kid. Then middle. Then engineering. Build understanding step by step.'}
    ]
  }
};

window.XC.VAATHIYAR = VAATHIYAR;

function getVaathiyar(topicId){
  return (window.XC.VAATHIYAR || {})[topicId] || null;
}

console.log('Data loaded: VAATHIYAR =', Object.keys(VAATHIYAR).length, 'topics');