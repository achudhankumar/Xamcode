/* ============================================================
   DATA — CHEATCODES
   Loaded after data-formulas.js, before data-vaathiyar.js
   Exposes: window.XC.CHEATCODES
   ============================================================ */
window.XC = window.XC || {};

const CHEATCODES = {
  /* ---------- UNIT I ---------- */
  'intro': {
    why: 'Two computers needed to share files. So we linked them.',
    like: 'Two friends talking on a string phone.',
    wrong: 'A network needs many computers.',
    right: 'Even TWO devices with one cable is a network.',
    see: ['🏠 Home WiFi', '🏢 Office LAN', '📱 Hotspot', '☁️ Internet'],
    oneLine: 'Two or more devices + a link = a network.'
  },
  'uses': {
    why: 'We wanted to share files, printers, and ideas without walking.',
    like: 'WhatsApp group for the office — everyone gets the same info.',
    wrong: 'Networks are only for the internet.',
    right: 'Networks also run printers, cameras, ATMs, ticket machines.',
    see: ['📧 Email', '🖨️ Shared printer', '🏧 ATM', '📺 Smart TV'],
    oneLine: 'Share resources, send messages, run the world.'
  },
  'dataflow': {
    why: 'Data can go one way, both ways in turns, or both ways at once.',
    like: 'Walkie-talkie (turns) vs phone call (both at once).',
    wrong: 'All networks are two-way at the same time.',
    right: 'Some are one-way (keyboard) or take turns (walkie-talkie).',
    see: ['⌨️ Keyboard', '📻 Walkie-talkie', '📞 Phone call', '📺 TV remote'],
    oneLine: 'Simplex: one way. Half: take turns. Full: both at once.'
  },
  'topology': {
    why: 'Different ways to lay cables give different speed and cost.',
    like: 'Road layouts — some have one main road, some have many.',
    wrong: 'Mesh is always the best.',
    right: 'Mesh is costly. Star is cheaper and used everywhere.',
    see: ['🏢 Office LAN (star)', '📡 Old cable TV (bus)', '🔄 Data centres (mesh)', '🏫 Campus (hybrid)'],
    oneLine: 'Layout of cables: mesh, star, bus, ring, hybrid.'
  },
  'media': {
    why: 'Data needs a physical path to travel.',
    like: 'Water needs pipes. Data needs cables or air.',
    wrong: 'All media are equally fast.',
    right: 'Fiber is fastest. Copper is cheaper. Wireless is easiest.',
    see: ['🔌 Ethernet cable', '📡 WiFi', '🛰️ Satellite', '💡 Fiber to home'],
    oneLine: 'Cables or air — the path your data takes.'
  },

  /* ---------- UNIT II ---------- */
  'dll-services': {
    why: 'Raw bits on wire are messy. The DLL cleans them up.',
    like: 'A postman who sorts letters into clean packets.',
    wrong: 'The DLL routes packets across the internet.',
    right: 'The DLL only moves frames between TWO nearby devices.',
    see: ['📶 WiFi frames', '🔌 Ethernet frames', '📞 DSL', '📡 Bluetooth'],
    oneLine: 'Turns messy bits into clean frames for one hop.'
  },
  'framing': {
    why: 'Receiver needs to know where one packet ends and next starts.',
    like: 'Packing boxes with labels — so each box is separate.',
    wrong: 'Any byte can mark the end of a frame.',
    right: 'Only special FLAG bytes do. Data cannot contain FLAGs.',
    see: ['📶 WiFi', '🔌 Ethernet', '📞 Serial links', '🛰️ Satellite'],
    oneLine: 'Wrap bits into frames. Add a FLAG to show where each ends.'
  },
  'sliding-window': {
    why: 'Waiting for each ACK is slow. Send many, then check.',
    like: 'Posting 10 letters at once instead of one-by-one.',
    wrong: 'Sender can send endless packets without waiting.',
    right: 'Sender can only have N packets in flight (window size).',
    see: ['🌐 TCP', '📡 Satellite links', '☁️ File downloads', '📶 WiFi'],
    oneLine: 'Send a window of packets, slide forward as ACKs arrive.'
  },
  'hamming': {
    why: 'Old radios broke bits. Hamming made a code to fix them.',
    like: 'Autocorrect — but for 1s and 0s.',
    wrong: 'It fixes any error.',
    right: 'It fixes only 1-bit errors.',
    see: ['💾 SSD', '📀 CD', '📡 Satellite', '🧬 DNA storage'],
    oneLine: 'Parity bits that find AND fix the broken bit.'
  },
  'error-detection': {
    why: 'Data gets damaged on the wire. We need a way to know.',
    like: 'A receipt — compare totals and see if anything changed.',
    wrong: 'Every error is caught.',
    right: 'Only the errors the checksum can catch.',
    see: ['🌐 Internet packets', '💳 Card payments', '📦 File downloads', '🔐 HTTPS'],
    oneLine: 'Add extra bits so the receiver can spot damage.'
  },
  'multiple-access': {
    why: 'Many devices share one cable. They need rules to talk.',
    like: 'Classroom — raise your hand before speaking.',
    wrong: 'Collisions cannot happen.',
    right: 'Collisions happen. We detect and retry.',
    see: ['📶 WiFi', '🔌 Ethernet', '📱 4G/5G', '📡 Satellite uplink'],
    oneLine: 'Listen before talking, back off if two talk at once.'
  },

  /* ---------- UNIT III ---------- */
  'nl-issues': {
    why: 'Routers must decide where to send each packet.',
    like: 'A traffic police deciding which road is fastest.',
    wrong: 'Network layer needs a full path set up every time.',
    right: 'Datagram mode sends each packet independently, no setup.',
    see: ['🌐 Internet', '🏢 Enterprise WAN', '📡 ISP routing', '📱 Mobile network'],
    oneLine: 'Pick the best route packet by packet.'
  },
  'dijkstra': {
    why: 'Google Maps needs the fastest route. Dijkstra found a way.',
    like: 'Pick the closest unvisited city. Mark it done. Repeat.',
    wrong: 'It explores all paths.',
    right: 'It throws away any path that is longer than current best.',
    see: ['🗺️ Google Maps', '🌐 OSPF routing', '🎮 Game AI', '🚗 Waze'],
    oneLine: 'Keep picking the closest unvisited node until done.'
  },
  'distance-vector': {
    why: 'Routers need to know the best path without seeing the whole map.',
    like: 'Ask your neighbours for directions, then pass it on.',
    wrong: 'Bad news spreads fast.',
    right: 'Bad news spreads SLOWLY — the count-to-infinity problem.',
    see: ['🌐 RIP protocol', '📡 Old networks', '🏘️ Small LANs'],
    oneLine: 'Each router tells neighbours its distances. Take the best.'
  },
  'link-state': {
    why: 'Every router needs the full map, not just rumours.',
    like: 'Everyone shares their own street map. Merge them all.',
    wrong: 'It floods the whole network non-stop.',
    right: 'Floods once, then everyone runs Dijkstra locally.',
    see: ['🌐 OSPF', '🏢 Enterprise networks', '☁️ Data centres'],
    oneLine: 'Everyone shares their links → each runs Dijkstra.'
  },
  'hierarchical': {
    why: 'Big networks have too many routes for one table.',
    like: 'A city map — you do not memorise every street.',
    wrong: 'Flat routing works for any size network.',
    right: 'Flat routing breaks past a few thousand nodes.',
    see: ['🌐 Internet backbone', '🏢 Corporate WAN', '📡 ISP routing', '☁️ Cloud data centres'],
    oneLine: 'Group routers into regions. Save table space.'
  },
  'congestion': {
    why: 'Too many packets → network slows to a crawl.',
    like: 'Too many cars on a highway. Traffic jam.',
    wrong: 'Adding more buffers solves it.',
    right: 'More buffers make it WORSE — packets sit and rot.',
    see: ['🎬 YouTube', '🎮 Online games', '📞 Video calls', '☁️ Cloud apps'],
    oneLine: 'Slow the sender before the network collapses.'
  },

  /* ---------- UNIT IV ---------- */
  'transport-services': {
    why: 'Apps need to talk to apps, not just computers.',
    like: 'Two people (apps) calling, not two buildings (hosts).',
    wrong: 'The network layer already handles apps.',
    right: 'Network layer = host-to-host. Transport = process-to-process.',
    see: ['🌐 Browsers', '📧 Mail apps', '💬 Chat', '🎮 Games'],
    oneLine: 'Process-to-process delivery using ports.'
  },
  'tcp-segment': {
    why: 'TCP needs a header to carry control info for every chunk.',
    like: 'An envelope with sender, receiver, sequence number, flags.',
    wrong: 'TCP header size is fixed.',
    right: 'TCP header is 20 bytes base, up to 60 with options.',
    see: ['🌐 Every website', '📥 Downloads', '☁️ Cloud sync', '📧 Email'],
    oneLine: '20 to 60-byte header + payload = one TCP segment.'
  },
  'tcp-handshake': {
    why: 'Two computers must agree before sending real data.',
    like: 'Phone call: "Hello?" — "Hi, I hear you." — "Okay, let us talk."',
    wrong: 'It is safe — old messages cannot trick it.',
    right: 'Old duplicates CAN trick it. That is why we use 3 steps.',
    see: ['🌐 Every website', '📧 Email', '💬 WhatsApp', '🎮 Games'],
    oneLine: 'SYN → SYN+ACK → ACK. Then talk.'
  },
  'tcp-window': {
    why: 'Sender must not drown the receiver.',
    like: 'A tap that slows down when the bucket is nearly full.',
    wrong: 'The receiver alone decides the window.',
    right: 'The SMALLER of receiver + network limits wins.',
    see: ['🌐 TCP apps', '📥 Downloads', '☁️ File sync'],
    oneLine: 'Window = min(rwnd, cwnd). Smaller one wins.'
  },
  'tcp-congestion': {
    why: 'Sending too fast breaks the network. Slow down early.',
    like: 'Speed up slowly. Slam brakes when trouble.',
    wrong: 'Speed up when there is no loss.',
    right: 'Speed up gently, then cut in HALF on loss.',
    see: ['🎬 Netflix', '📥 Downloads', '☁️ Cloud storage', '📞 Zoom'],
    oneLine: '+1 per RTT. Halve on loss. Repeat.'
  },
  'udp': {
    why: 'Sometimes speed beats reliability.',
    like: 'Live TV — no point resending missed frames.',
    wrong: 'UDP is bad because it is unreliable.',
    right: 'UDP is GOOD when a late packet is worse than a lost one.',
    see: ['🎮 Games', '📞 VoIP', '📺 Live video', '🌐 DNS'],
    oneLine: 'Fire and forget. Fast, no guarantees.'
  },

  /* ---------- UNIT V ---------- */
  'dns': {
    why: 'Humans remember names. Computers use numbers.',
    like: 'Phone book — name → number.',
    wrong: 'One server holds every name.',
    right: 'It is a tree — root → TLD → domain → host.',
    see: ['🌐 Any website', '📱 Apps', '📧 Email', '☁️ Cloud'],
    oneLine: 'Translate names like google.com into IP addresses.'
  },
  'www-http': {
    why: 'We needed a way to share documents across the world.',
    like: 'Order food: you ask (request), waiter brings it (response).',
    wrong: 'HTTP remembers your last request.',
    right: 'HTTP is stateless — cookies remember you.',
    see: ['🌐 Browsers', '📱 Apps', '🛒 Shopping', '☁️ APIs'],
    oneLine: 'Client asks, server answers. Port 80 / 443.'
  },
  'ftp': {
    why: 'Big files need a reliable, resumable transfer.',
    like: 'Two phone lines — one to talk, one to send the parcel.',
    wrong: 'FTP uses one connection.',
    right: 'FTP uses TWO — control (21) and data (20).',
    see: ['🏢 Office file servers', '🖥️ Website uploads', '💾 Backups'],
    oneLine: 'Command on 21. File bytes on 20.'
  },
  'smtp': {
    why: 'Email must move from sender to receiver, even if offline.',
    like: 'Post office — your letter is passed between offices.',
    wrong: 'SMTP reads your email too.',
    right: 'SMTP SENDS only. POP3/IMAP receive.',
    see: ['📧 Gmail', '📨 Outlook', '📮 Any mail app'],
    oneLine: 'SMTP pushes mail (port 25). POP3/IMAP pull it.'
  },
  'telnet': {
    why: 'Before SSH, we needed a way to log in remotely.',
    like: 'A universal remote — works with any TV.',
    wrong: 'TELNET is secure.',
    right: 'TELNET sends plain text. Never use over the internet.',
    see: ['🔧 Old routers', '📡 Device config', '💻 Local labs'],
    oneLine: 'Remote login on port 23. Uses NVT (7-bit ASCII).'
  },
  'rtp': {
    why: 'Audio and video need timing, not perfection.',
    like: 'Live cricket — a late ball is a missed ball.',
    wrong: 'RTP resends lost packets.',
    right: 'RTP never resends. Receiver buffers to smooth jitter.',
    see: ['📞 VoIP', '📺 IPTV', '🎥 Video calls', '🎙️ Podcasts'],
    oneLine: 'Real-time media over UDP. Sequence + timestamp.'
  }
};

window.XC.CHEATCODES = CHEATCODES;

console.log('Data loaded: CHEATCODES =', Object.keys(CHEATCODES).length, 'entries');