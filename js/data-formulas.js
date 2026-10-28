/* ============================================================
   DATA — FORMULAS
   Loaded after data-topics.js, before data-cheatcodes.js
   Exposes: window.XC.FORMULAS
   ============================================================ */
window.XC = window.XC || {};

const FORMULAS = [
  /* ---------- UNIT I ---------- */
  {
    id:'mesh-links', unit:'I', topicId:'topology', cat:'TOPOLOGY', page:'Page 8',
    title:'Full Mesh — Link Count',
    quote:'The number of connections can be calculated using n(n-1)/2.',
    formula:'n(n − 1) / 2',
    meaning:'Number of duplex links needed so every node reaches every other node',
    explanation:'In a full mesh, every node links to every other node. If you just multiply n × (n−1), each link gets counted twice — once from each end. So we divide by 2.',
    keyPoints:['Each node links to n−1 others','Links counted twice (A→B, B→A)','Divide by 2 to remove the double-count','Grows quadratically → expensive'],
    steps:[
      {title:'Pick n', math:'n = 5', desc:'Number of nodes'},
      {title:'Neighbours', math:'n − 1 = 4', desc:'Each node links to 4 others'},
      {title:'Multiply', math:'5 × 4 = 20', desc:'Every link counted twice'},
      {title:'Halve it', math:'20 ÷ 2 = 10', desc:'True link count'},
      {title:'Result', math:'10 links', desc:'For n = 5 nodes'}
    ],
    workedExample:{ q:'How many links for a full mesh of 5 nodes?', s:['n = 5','n − 1 = 4 neighbours per node','5 × 4 = 20 (each counted twice)','20 / 2 = 10','→ 10 duplex links'] },
    visual:'meshLinks', mini:'meshLinksMin'
  },
  {
    id:'star-links', unit:'I', topicId:'topology', cat:'TOPOLOGY', page:'Page 9',
    title:'Star — Dedicated Links',
    quote:'Each device has a dedicated point-to-point link only to a central controller.',
    formula:'Links = n',
    meaning:'One dedicated link per node to the central hub/switch',
    explanation:'In star topology, each node needs exactly one link — a dedicated path to the central hub. Unlike mesh, nodes never link to each other directly.',
    keyPoints:['1 link per node','n nodes → n links','Central hub is a single point of failure','Easy to add/remove nodes'],
    steps:[
      {title:'Count nodes', math:'n = 5', desc:'Workstations in the LAN'},
      {title:'Each needs one link', math:'1 per node', desc:'To the central switch'},
      {title:'Multiply', math:'5 × 1 = 5', desc:'All links terminate at hub'},
      {title:'Result', math:'5 links', desc:'For n = 5'}
    ],
    workedExample:{ q:'How many cables for 5 workstations in a star LAN?', s:['n = 5','Each workstation → 1 cable','5 × 1 = 5','→ 5 dedicated links to the switch'] },
    visual:'starLinks', mini:'starLinksMin'
  },
  {
    id:'bus-terminators', unit:'I', topicId:'topology', cat:'TOPOLOGY', page:'Page 9',
    title:'Bus — Terminators Required',
    quote:'Terminators are required for both ends of the main cable.',
    formula:'Terminators = 2',
    meaning:'One at each end of the backbone to absorb signal reflections',
    explanation:'Without terminators, signals bounce back from the cable ends and collide with new signals, corrupting data. Both ends need one terminator each.',
    keyPoints:['Absorbs signal at cable end','Prevents reflection','1 at each end → 2 total','Fixed count, does not scale'],
    steps:[
      {title:'Backbone', math:'1 shared cable', desc:'Every node taps in'},
      {title:'Left end', math:'+1 terminator', desc:'Absorbs left-side reflections'},
      {title:'Right end', math:'+1 terminator', desc:'Absorbs right-side reflections'},
      {title:'Total', math:'2 terminators', desc:'Always, regardless of node count'}
    ],
    workedExample:{ q:'How many terminators for a bus with 8 workstations?', s:['Node count irrelevant','Ends = 2 (left + right)','→ 2 terminators required'] },
    visual:'busTerm', mini:'busTermMin'
  },

  /* ---------- UNIT II ---------- */
  {
    id:'hamming-r', unit:'II', topicId:'hamming', cat:'ERROR CORRECTION', page:'Page 69',
    title:'Hamming — Redundancy Bits',
    quote:'2^r ≥ d + r + 1',
    formula:'2^r  ≥  d + r + 1',
    meaning:'Minimum parity bits r needed to protect d data bits and locate any single-bit error',
    explanation:'To detect AND locate a single-bit error in d data bits, you need enough parity bits r so the total code space (2^r) can address every possible error position plus the no-error case.',
    keyPoints:['r = parity bits, d = data bits','2^r = total parity patterns','Must cover d + r + 1 cases (data + parity + no-error)','Smallest r that satisfies wins'],
    steps:[
      {title:'Given d', math:'d = 4', desc:'Data bits to protect'},
      {title:'Try r = 2', math:'2² = 4  vs  4+2+1 = 7', desc:'4 ≥ 7 is FALSE'},
      {title:'Try r = 3', math:'2³ = 8  vs  4+3+1 = 8', desc:'8 ≥ 8 is TRUE'},
      {title:'Total bits', math:'d + r = 7', desc:'Final code word length'}
    ],
    workedExample:{ q:'How many parity bits for d = 4?', s:['Test r = 2: 4 ≥ 7 → fail','Test r = 3: 8 ≥ 8 → pass','→ r = 3, code word = 7 bits'] },
    visual:'hammingR', mini:'hammingRMin'
  },
  {
    id:'hamming-pos', unit:'II', topicId:'hamming', cat:'ERROR CORRECTION', page:'Page 71',
    title:'Hamming — Error Position',
    quote:'The decimal value of the parity bits determines the position of an error.',
    formula:'pos = r4·4 + r2·2 + r1·1',
    meaning:'Read the failed parity bits as a binary number to find the corrupted position',
    explanation:'After transmission, we recompute parity. The pattern of which parities failed — read as a binary number — equals the position of the corrupt bit.',
    keyPoints:['r1, r2, r4 = the three parity checks','Each check is 0 (pass) or 1 (fail)','r4r2r1 as binary → error position','Decimal 0 = no error'],
    steps:[
      {title:'Recompute parities', math:'r4=1, r2=0, r1=0', desc:'Only r4 fails'},
      {title:'Concatenate', math:'r4 r2 r1 = 100', desc:'Read as 3-bit binary'},
      {title:'Convert', math:'100₂ = 4₁₀', desc:'Binary → decimal'},
      {title:'Fix', math:'flip bit 4', desc:'Correct the error'}
    ],
    workedExample:{ q:'r4r2r1 = 100 — where is the error?', s:['Read r4 r2 r1 as binary','100₂','= 1×4 + 0×2 + 0×1','= 4','→ flip bit 4'] },
    visual:'hammingPos', mini:'hammingPosMin'
  },
  {
    id:'pure-aloha', unit:'II', topicId:'multiple-access', cat:'ALOHA', page:'Page 52',
    title:'Pure ALOHA — Throughput',
    quote:'The throughput for pure ALOHA is S = G × e^(−2G). Maximum S_max = 0.184 when G = 1/2.',
    formula:'S  =  G × e^(−2G)',
    meaning:'Fraction of frames that survive collisions when stations transmit at total rate G',
    explanation:'S rises as load G increases, but so do collisions. Peak occurs at G = 0.5 where S ≈ 18.4% — the well-known ALOHA efficiency limit.',
    keyPoints:['S = throughput, G = offered load','Peak at G = 0.5','S_max = 0.184 (18.4%)','Beyond peak, more load reduces throughput'],
    steps:[
      {title:'Formula', math:'S = G · e^(−2G)', desc:'Exponential falloff'},
      {title:'Try G = 0.5', math:'S = 0.5 · e^(−1)', desc:'e^−1 ≈ 0.368'},
      {title:'Compute', math:'S ≈ 0.5 × 0.368 = 0.184', desc:'18.4% success'},
      {title:'Interpret', math:'18.4% max', desc:'1 in ~5 frames survives'}
    ],
    workedExample:{ q:'Peak throughput of pure ALOHA?', s:['S = G · e^(−2G)','Take derivative, set to 0','G = 0.5','S = 0.5 × e^(−1)','S ≈ 0.184 → 18.4%'] },
    visual:'pureAloha', mini:'pureAlohaMin'
  },
  {
    id:'vuln-time', unit:'II', topicId:'multiple-access', cat:'ALOHA', page:'Page 52',
    title:'ALOHA — Vulnerable Time',
    quote:'Pure ALOHA vulnerable time = 2 × Tfr. Slotted ALOHA vulnerable time = Tfr.',
    formula:'T_vuln = 2 × T_fr  (Pure)\nT_vuln = T_fr  (Slotted)',
    meaning:'Time window during which another transmission can cause a collision',
    explanation:'Pure ALOHA allows stations to send at any moment — so a frame can collide with one starting up to one T_fr before OR one T_fr after. Slotted halves this by forcing sends to slot boundaries.',
    keyPoints:['Pure: vulnerable = 2 × T_fr','Slotted: vulnerable = T_fr','Halving vulnerability doubles throughput','T_fr = frame transmission time'],
    steps:[
      {title:'Frame in flight', math:'length = T_fr', desc:'Sending the frame'},
      {title:'Before window', math:'+ T_fr', desc:'A frame starting before can overlap'},
      {title:'During window', math:'+ T_fr', desc:'A frame starting during can overlap'},
      {title:'Total', math:'T_vuln = 2 × T_fr', desc:'Pure ALOHA window'}
    ],
    workedExample:{ q:'200-bit frame @ 200 kbps — what is vulnerable time?', s:['T_fr = 200 / 200,000 = 1 ms','T_vuln = 2 × 1 ms','→ 2 ms (pure ALOHA)','→ 1 ms (slotted ALOHA)'] },
    visual:'vulnTime', mini:'vulnTimeMin'
  },
  {
    id:'min-frame', unit:'II', topicId:'multiple-access', cat:'CSMA/CD', page:'Page 59',
    title:'CSMA/CD — Minimum Frame Size',
    quote:'The frame transmission time Tfr must be at least two times the maximum propagation time Tp.',
    formula:'T_fr  ≥  2 × T_p',
    meaning:'Frame must be long enough that the sender is still transmitting when a collision echo returns',
    explanation:'The sender can only abort on collision if it is still transmitting when the echo arrives. Worst case, the far-away station sends after T_p, and the echo takes another T_p to come back — so T_fr ≥ 2 × T_p.',
    keyPoints:['T_p = one-way propagation time','Round trip = 2 × T_p','Frame time must exceed this','Ensures collision is always detected'],
    steps:[
      {title:'Far station delay', math:'T_p', desc:'Signal takes T_p to reach end'},
      {title:'Echo return', math:'+ T_p', desc:'Collision travels back'},
      {title:'Round-trip', math:'2 × T_p', desc:'Worst-case collision time'},
      {title:'Requirement', math:'T_fr ≥ 2 × T_p', desc:'Sender still transmitting'}
    ],
    workedExample:{ q:'10 Mbps, T_p = 25.6 μs — minimum frame size?', s:['T_fr ≥ 2 × 25.6 μs = 51.2 μs','bits = 10 Mbps × 51.2 μs','= 512 bits','= 64 bytes (standard Ethernet)'] },
    visual:'minFrame', mini:'minFrameMin'
  },
  {
    id:'gbn-window', unit:'II', topicId:'sliding-window', cat:'ARQ', page:'Page 44',
    title:'Go-Back-N — Send Window',
    quote:'The send window is an imaginary box of size 2^m − 1.',
    formula:'W_send = 2^m − 1',
    meaning:'Maximum number of outstanding (unacknowledged) frames the sender may have',
    explanation:'With m bits for sequence numbers, we can express 2^m values. Go-Back-N reserves one value (0) as the "current expected" slot, so the sender can only have 2^m − 1 frames in flight.',
    keyPoints:['m = sequence field bits','Range: 0 to 2^m − 1','Window size = 2^m − 1','1 slot reserved → no ambiguity'],
    steps:[
      {title:'Field size', math:'m = 4', desc:'Bits for sequence number'},
      {title:'Total values', math:'2^m = 16', desc:'0 to 15'},
      {title:'Reserve one', math:'16 − 1 = 15', desc:'Prevents wraparound ambiguity'},
      {title:'Window', math:'W = 15', desc:'Max outstanding frames'}
    ],
    workedExample:{ q:'Window size for m = 4?', s:['2^m = 16','W = 16 − 1 = 15','→ 15 outstanding frames allowed'] },
    visual:'gbnWin', mini:'gbnWinMin'
  },
  {
    id:'sr-window', unit:'II', topicId:'sliding-window', cat:'ARQ', page:'Page 48',
    title:'Selective Repeat — Window Size',
    quote:'The size of the sender and receiver window must be at most one-half of 2^m.',
    formula:'W_send = W_recv = 2^(m−1)',
    meaning:'Both send and receive windows halve to prevent old/new frames colliding',
    explanation:'Selective Repeat lets frames arrive out of order, so we need to distinguish "old" from "new" frames with the same sequence number. Using only half the sequence space for each window guarantees no overlap.',
    keyPoints:['Both windows same size','W = 2^(m−1)','Half of total sequence space','Allows out-of-order buffering'],
    steps:[
      {title:'Field size', math:'m = 4', desc:'Bits for sequence'},
      {title:'Total values', math:'2^m = 16', desc:'0 to 15'},
      {title:'Split in half', math:'16 / 2 = 8', desc:'Send + receive each get half'},
      {title:'Window', math:'W = 8', desc:'Both sides'}
    ],
    workedExample:{ q:'Selective Repeat window for m = 4?', s:['2^m = 16','W = 16 / 2 = 8','→ 8 outstanding frames, both sides'] },
    visual:'srWin', mini:'srWinMin'
  },
  {
    id:'parity-rule', unit:'II', topicId:'error-detection', cat:'PARITY', page:'Page 66',
    title:'Simple Parity — Rule',
    quote:'1 is added to the block if it contains odd number of 1s, and 0 is added if it contains even number of 1s.',
    formula:'parity = 1 if count(1s) is odd\nparity = 0 if count(1s) is even',
    meaning:'Extra bit makes total number of 1s always even',
    explanation:'Append one parity bit so the receiver can check: if total 1s count is odd after receiving, an odd number of bits flipped — error detected.',
    keyPoints:['1 bit appended','Even parity: total 1s even','Odd parity: total 1s odd','Detects odd errors, misses even'],
    steps:[
      {title:'Count 1s', math:'100011 → 3 ones', desc:'In the data'},
      {title:'Is it odd?', math:'3 is odd', desc:'Count check'},
      {title:'Add parity', math:'parity = 1', desc:'Makes total even'},
      {title:'Send', math:'100011 1', desc:'7 bits total, 4 ones'}
    ],
    workedExample:{ q:'What parity bit for 100011 (even parity)?', s:['Data = 100011','Count 1s = 3 (odd)','Add 1 to make even','→ parity bit = 1','→ 1000111'] },
    visual:'parityRule', mini:'parityRuleMin'
  },
  {
    id:'checksum-rule', unit:'II', topicId:'error-detection', cat:'CHECKSUM', page:'Page 67',
    title:'Checksum — 1\'s Complement',
    quote:'The segments are added using 1\'s complement arithmetic to get the sum. The sum is complemented to get the checksum.',
    formula:'S = Σ segments  (1\'s complement)',
    meaning:'Add all data chunks, complement the sum, append as checksum',
    explanation:'Sender adds all m-bit segments using 1\'s complement (end-around carry), complements the result, and sends it. Receiver repeats the sum — if the result is all 1s, data is intact.',
    keyPoints:['Split data into m-bit chunks','Add using 1\'s complement','End-around carry wraps back','Complement → append'],
    steps:[
      {title:'Split', math:'4 segments of 8 bits', desc:'k=4, m=8'},
      {title:'Add #1', math:'10011001 + 11100010', desc:'End-around carry'},
      {title:'Add more', math:'+ 00100100 + 10000100', desc:'All segments'},
      {title:'Complement', math:'~11111111 = 00000000', desc:'Or nonzero checksum'}
    ],
    workedExample:{ q:'Checksum of 4 segments (8-bit)?', s:['Sum in 1\'s complement','= 11011010 after complement','Append to data','Receiver sums all → all 1s = OK'] },
    visual:'checksumRule', mini:'checksumRuleMin'
  },
  {
    id:'crc-rule', unit:'II', topicId:'error-detection', cat:'CRC', page:'Page 68',
    title:'CRC — Polynomial Division',
    quote:'The data unit is divided by a predetermined binary number. The remainder is the CRC.',
    formula:'data · 2^n  ÷  generator  →  remainder = CRC',
    meaning:'Append n zeros to data, divide by generator polynomial; remainder is CRC',
    explanation:'CRC treats data as a polynomial, appends n zeros (n = generator degree), and divides by the generator using XOR. The remainder replaces the appended zeros as the checksum.',
    keyPoints:['n = degree of generator','Append n zeros to data','Binary division with XOR','Remainder = CRC (n bits)'],
    steps:[
      {title:'Generator', math:'1001 (degree 3)', desc:'4-bit polynomial'},
      {title:'Append', math:'1010 → 1010000', desc:'Add 3 zeros'},
      {title:'Divide', math:'1010000 ÷ 1001', desc:'Binary long division'},
      {title:'Remainder', math:'011', desc:'The CRC to append'}
    ],
    workedExample:{ q:'CRC of 1010 with generator 1001?', s:['n = 3 → append 000','Dividend = 1010000','Divide by 1001 (XOR)','Remainder = 011','Send 1010 011'] },
    visual:'crcRule', mini:'crcRuleMin'
  },
  {
    id:'dijkstra-relax', unit:'III', topicId:'dijkstra', cat:'ROUTING', page:'Page 84',
    title:'Dijkstra — Relaxation',
    quote:'If a node can be reached from more than one route then select the route with the shortest cumulative cost.',
    formula:'D(v)  =  min( D(v),  D(u) + w(u,v) )',
    meaning:'Update a neighbour\'s distance if going through the newly permanent node u is shorter',
    explanation:'Whenever we finalize a node u, we examine every neighbour v. If the path through u gives a shorter distance than v\'s current best, we update v. This is called "relaxing" the edge (u,v).',
    keyPoints:['u = newly permanent node','v = its neighbour','w(u,v) = edge weight','Take minimum of old vs new'],
    steps:[
      {title:'Finalize u',math:'u = A, D(A)=0',desc:'A becomes permanent'},
      {title:'Look at neighbour v',math:'v = B, w(A,B)=2',desc:'Edge weight 2'},
      {title:'Compute candidate',math:'D(A) + 2 = 2',desc:'Path through A'},
      {title:'Compare',math:'min(∞, 2) = 2',desc:'Update D(B) → 2'}
    ],
    workedExample:{ q:'A→B weight 2, D(B)=∞. After relaxing via A?', s:['D(A) = 0','candidate = 0 + 2 = 2','min(∞, 2) = 2','→ D(B) becomes 2 via A'] },
    visual:'dijkstraRelax', mini:'dijkstraRelaxMin'
  },
  {
    id:'dv-update', unit:'III', topicId:'distance-vector', cat:'ROUTING', page:'Page 87',
    title:'Distance Vector — Update Rule',
    quote:'The receiving node needs to add the cost between itself and the sending node to each value in the second column.',
    formula:'D_x(y)  =  min_v { c(x,v) + D_v(y) }',
    meaning:'x\'s distance to y is the best over all neighbours v of (link to v) + (v\'s distance to y)',
    explanation:'When x receives a table from neighbour v, x adds the link cost c(x,v) to every entry, then compares with x\'s current best. The minimum wins. This is Bellman-Ford in disguise.',
    keyPoints:['c(x,v) = link cost x to v','D_v(y) = v\'s cost to y','Take min over all neighbours','Iterate until stable'],
    steps:[
      {title:'Receive table',math:'v = C sends {B:4, D:∞}',desc:'From neighbour C'},
      {title:'Add link cost',math:'c(A,C) = 3',desc:'Cost to reach C'},
      {title:'Compute',math:'3 + 4 = 7 for B',desc:'Path A→C→B'},
      {title:'Compare with own',math:'min(2, 7) = 2',desc:'Old route through B was better'}
    ],
    workedExample:{ q:'A knows B=2 directly. C says B=4. c(A,C)=3. Update?', s:['candidate via C = 3 + 4 = 7','old best = 2','min(2, 7) = 2','→ keep old route'] },
    visual:'dvUpdate', mini:'dvUpdateMin'
  },
  {
    id:'hier-levels', unit:'III', topicId:'hierarchical', cat:'ROUTING', page:'Page 97',
    title:'Hierarchical — Optimal Levels',
    quote:'Kamoun and Kleinrock discovered that the optimal number of levels for an N router network is ln N.',
    formula:'optimal levels = ln N\nentries per router ≈ e · ln N',
    meaning:'Best nesting depth that minimizes total routing table size',
    explanation:'For an N-router flat network, each router needs N entries. Nesting reduces it: too few levels → big tables; too many → high overhead. Kamoun & Kleinrock showed the sweet spot is ln N levels.',
    keyPoints:['N = total routers','Flat = N entries per router','Optimal levels = ln N','Total ≈ e · ln N entries'],
    steps:[
      {title:'Flat network',math:'720 routers → 720 entries',desc:'Baseline'},
      {title:'2 levels',math:'24 regions of 30 → 53 entries',desc:'30 local + 23 remote'},
      {title:'3 levels',math:'8 clusters × 9 regions × 10',desc:'25 entries'},
      {title:'Optimal',math:'ln 720 ≈ 6.6',desc:'Sweet spot around 6–7 levels'}
    ],
    workedExample:{ q:'Entries/router for 720-router network with 3 levels?', s:['10 local + 8 cluster + 7 distant','= 25 entries/router','vs 720 flat','→ 28× smaller table'] },
    visual:'hierLevels', mini:'hierLevelsMin'
  },
  {
    id:'leaky-bucket', unit:'III', topicId:'congestion', cat:'TRAFFIC SHAPING', page:'Page 100',
    title:'Leaky Bucket — Constant Rate',
    quote:'The leaky bucket enforces a constant output rate (average rate) regardless of the burstiness of the input.',
    formula:'output rate  =  r  (constant)\nif bucket full → drop packet',
    meaning:'Shape bursty input into a smooth, constant-rate output',
    explanation:'Packets enter a finite bucket. They leave at a fixed rate r (like water leaking through a hole). If the bucket fills, further packets are discarded. Output is perfectly smooth.',
    keyPoints:['Constant output rate r','Bucket has finite capacity','Overflow → packets dropped','Smooths bursts → reduces congestion'],
    steps:[
      {title:'Packets arrive',math:'bursty input',desc:'Bursts of variable size'},
      {title:'Bucket buffers',math:'capacity C',desc:'Holds up to C packets'},
      {title:'Leak at rate r',math:'1 packet per tick',desc:'Constant output'},
      {title:'Overflow',math:'drop extra',desc:'If C exceeded, packets lost'}
    ],
    workedExample:{ q:'Bucket of 4 packets, leak rate 1/tick. What if 10 packets arrive in one burst?', s:['First 4 buffered','Next 6 → bucket full → dropped','Output = 1 packet per tick','→ smooth stream of 4'] },
    visual:'leakyBucket', mini:'leakyBucketMin'
  },
  {
    id:'token-bucket', unit:'III', topicId:'congestion', cat:'TRAFFIC SHAPING', page:'Page 101',
    title:'Token Bucket — Allow Bursts',
    quote:'In the TB algorithm, the bucket holds tokens. To transmit a packet, the host must capture and destroy one token.',
    formula:'token rate = ρ   ·   bucket capacity = C\nburst = up to C bytes',
    meaning:'Allow short bursts of up to C, with long-term average limited by ρ',
    explanation:'Tokens accumulate at rate ρ up to capacity C. To send a packet of size b, you must collect b tokens. Idle periods bank tokens, enabling bursts — unlike Leaky Bucket.',
    keyPoints:['Tokens accumulate at rate ρ','Bucket capacity C','Burst ≤ C','Long-term average ≤ ρ'],
    steps:[
      {title:'Idle period',math:'tokens build up',desc:'Up to C tokens'},
      {title:'Burst arrives',math:'spend C tokens',desc:'Can send C bytes at once'},
      {title:'Sustain',math:'rate ρ',desc:'Long-term average'},
      {title:'Burst done',math:'back to ρ',desc:'Tokens depleted'}
    ],
    workedExample:{ q:'C = 8 KB, ρ = 1 KB/s. After 5 s idle, how big a burst?', s:['Tokens saved = 5 × 1 = 5 KB','< C = 8 KB','Burst = 5 KB','→ burst allowed, then back to 1 KB/s'] },
    visual:'tokenBucket', mini:'tokenBucketMin'
  },
  {
    id:'dv-infinity', unit:'III', topicId:'distance-vector', cat:'ROUTING', page:'Page 89',
    title:'Defining Infinity',
    quote:'Most implementations of the distance vector protocol define the distance between each node to be 1 and define 16 as infinity.',
    formula:'∞  ≡  16 hops\n(so max network diameter = 15)',
    meaning:'Cap the metric so count-to-infinity terminates quickly',
    explanation:'Real infinity is impractical (increments take too long). RIP defines 16 as ∞, so routes cannot exceed 15 hops. Stability is reached in a few updates instead of hundreds.',
    keyPoints:['∞ = 16 for RIP','Max diameter = 15 hops','Bounds count-to-infinity time','Trade-off: cannot use RIP in large networks'],
    steps:[
      {title:'Real infinity',math:'∞',desc:'Unreachable'},
      {title:'Small cap',math:'∞ := 100',desc:'First fix'},
      {title:'RIP choice',math:'∞ := 16',desc:'Standard implementation'},
      {title:'Consequence',math:'max hops = 15',desc:'Scale limit'}
    ],
    workedExample:{ q:'What happens if a network needs 20 hops?', s:['RIP defines 16 as ∞','20 > 15 → unreachable','→ RIP cannot route it','Need OSPF / BGP instead'] },
    visual:'dvInfinity', mini:'dvInfinityMin'
  },

  /* ---------- UNIT IV ---------- */
  {
    id:'tcp-window-f', unit:'IV', topicId:'tcp-window', cat:'TCP', page:'Page 156',
    title:'TCP Window — Effective Size',
    quote:'The window size at one end is determined by the lesser of two values: receiver window or congestion window.',
    formula:'W_eff  =  min( rwnd,  cwnd )',
    meaning:'Sender may have at most this many unacknowledged bytes in flight',
    explanation:'rwnd is advertised by the receiver based on its buffer; cwnd is controlled by the network\'s congestion signal. The sender must obey the smaller of the two.',
    keyPoints:['rwnd = receiver buffer','cwnd = congestion window','Take minimum','Prevents receiver overflow AND network congestion'],
    steps:[
      {title:'Receiver says',math:'rwnd = 8 KB',desc:'Buffer has room'},
      {title:'Network says',math:'cwnd = 4 KB',desc:'Congestion limit'},
      {title:'Take min',math:'min(8, 4) = 4',desc:'Smaller wins'},
      {title:'Send',math:'≤ 4 KB in flight',desc:'Until ACKs arrive'}
    ],
    workedExample:{ q:'rwnd=8KB, cwnd=4KB → effective window?', s:['Take min(8, 4)','= 4 KB','Sender may have 4 KB unacked','→ window closes as ACKs return'] },
    visual:'fTcpWindow', mini:'fTcpWindowMin'
  },
  {
    id:'tcp-throughput', unit:'IV', topicId:'tcp-window', cat:'TCP', page:'Page 154',
    title:'TCP Throughput',
    quote:'Throughput is bounded by window size and round-trip time.',
    formula:'Throughput  =  Window  /  RTT',
    meaning:'Upper bound on TCP goodput given window and latency',
    explanation:'A larger window means more data in flight. A larger RTT means more waiting. The ratio gives the theoretical throughput ceiling.',
    keyPoints:['W = window size (bytes)','RTT = round-trip time','Bigger W → more throughput','Bigger RTT → less throughput'],
    steps:[
      {title:'Window',math:'W = 64 KB',desc:'Bytes in flight'},
      {title:'RTT',math:'RTT = 100 ms',desc:'Round-trip delay'},
      {title:'Divide',math:'64 KB / 0.1 s',desc:'Per second'},
      {title:'Result',math:'640 KB/s',desc:'≈ 5 Mbps ceiling'}
    ],
    workedExample:{ q:'W = 64 KB, RTT = 100 ms → throughput?', s:['64 KB = 65536 bytes','÷ 0.1 s = 655,360 B/s','≈ 640 KB/s','≈ 5 Mbps'] },
    visual:'fThroughput', mini:'fThroughputMin'
  },
  {
    id:'slow-start', unit:'IV', topicId:'tcp-congestion', cat:'TCP', page:'Page 170',
    title:'Slow Start — Exponential Ramp',
    quote:'Slow start effectively increases the congestion window exponentially.',
    formula:'cwnd(t)  =  2^t   (until ssthresh)',
    meaning:'Congestion window doubles each RTT until threshold',
    explanation:'Starting from cwnd = 1, each ACK increments cwnd so it doubles every RTT. On reaching ssthresh, TCP switches to linear increase.',
    keyPoints:['Starts at cwnd = 1','Doubles each RTT','Stops at ssthresh','Exponential despite the name'],
    steps:[
      {title:'Start',math:'cwnd = 1',desc:'One segment in flight'},
      {title:'RTT 1',math:'cwnd = 2',desc:'ACK arrives'},
      {title:'RTT 2',math:'cwnd = 4',desc:'Doubles again'},
      {title:'RTT 3',math:'cwnd = 8',desc:'Continue until ssthresh'}
    ],
    workedExample:{ q:'cwnd after 4 RTTs starting from 1?', s:['RTT 0: 1','RTT 1: 2','RTT 2: 4','RTT 3: 8','RTT 4: 16'] },
    visual:'fSlowStart', mini:'fSlowStartMin'
  },
  {
    id:'aimd-f', unit:'IV', topicId:'tcp-congestion', cat:'TCP', page:'Page 167',
    title:'AIMD — Additive / Multiplicative',
    quote:'For congestion control, transport protocol uses an AIMD control law.',
    formula:'Increase:  cwnd ← cwnd + 1  per RTT\nDecrease:  cwnd ← cwnd / 2   on loss',
    meaning:'Gently probe for more bandwidth, back off sharply when congested',
    explanation:'Linear growth explores capacity without flooding. Multiplicative halving on loss clears congestion quickly. Result: a stable sawtooth.',
    keyPoints:['+1 per RTT (linear)','÷2 on loss (multiplicative)','Creates sawtooth pattern','Converges to fair share'],
    steps:[
      {title:'Start',math:'cwnd = 16',desc:'Current limit'},
      {title:'RTT 1',math:'17',desc:'Additive +1'},
      {title:'RTT 2',math:'18',desc:'Additive +1'},
      {title:'Loss',math:'18 / 2 = 9',desc:'Multiplicative ÷2'}
    ],
    workedExample:{ q:'cwnd=20, packet lost → new cwnd?', s:['On loss: ÷2','20 / 2 = 10','→ cwnd = 10'] },
    visual:'fAimd', mini:'fAimdMin'
  },
  {
    id:'udp-length', unit:'IV', topicId:'udp', cat:'UDP', page:'Page 181',
    title:'UDP Length Field',
    quote:'UDP length field = 8 bytes of header + data bytes.',
    formula:'UDP Length  =  8  +  data bytes',
    meaning:'Total size of the UDP datagram including header',
    explanation:'The 16-bit length field covers the entire datagram. Maximum data is 65,535 − 8 − 20 IP header = 65,507 bytes.',
    keyPoints:['Header = 8 bytes','Data = variable','16-bit total length','Max data = 65,507 bytes'],
    steps:[
      {title:'Header',math:'8 bytes',desc:'Fixed'},
      {title:'Data',math:'N bytes',desc:'Payload'},
      {title:'Sum',math:'8 + N',desc:'Length field value'},
      {title:'Bound',math:'≤ 65,535',desc:'16-bit limit'}
    ],
    workedExample:{ q:'UDP carries 100 bytes of data — what is the Length field?', s:['Header = 8','Data = 100','8 + 100 = 108','→ Length field = 108'] },
    visual:'fUdpLength', mini:'fUdpLengthMin'
  },
  {
    id:'tcp-hlen', unit:'IV', topicId:'tcp-segment', cat:'TCP', page:'Page 140',
    title:'TCP Header Length (HLEN)',
    quote:'The length of the header can be between 20 and 60 bytes. The value of this field can be between 5 and 15.',
    formula:'HLEN  =  header_bytes / 4',
    meaning:'HLEN is the number of 4-byte words in the TCP header',
    explanation:'Because the header may contain options, its length varies. HLEN is stored as the count of 32-bit words (so 5 → 20 bytes, 15 → 60 bytes).',
    keyPoints:['HLEN = header_bytes / 4','Minimum HLEN = 5 (20 bytes)','Maximum HLEN = 15 (60 bytes)','Options = 0 to 40 bytes'],
    steps:[
      {title:'Fixed part',math:'20 bytes',desc:'Always present'},
      {title:'Options',math:'0 – 40 bytes',desc:'Variable'},
      {title:'Total',math:'20 – 60 bytes',desc:'Header length'},
      {title:'Encode',math:'÷ 4 → 5 … 15',desc:'HLEN field value'}
    ],
    workedExample:{ q:'TCP header includes 12 bytes of options. What is HLEN?', s:['20 + 12 = 32 bytes','32 / 4 = 8','→ HLEN = 8'] },
    visual:'fTcpHeader', mini:'fTcpHeaderMin'
  },

  /* ---------- UNIT V ---------- */
  {
    id:'dns-levels', unit:'V', topicId:'dns', cat:'DNS', page:'Page 288',
    title:'DNS — Hierarchy Levels',
    quote:'The tree can have only 128 levels: level 0 (root) to level 127.',
    formula:'levels  ≤  128\nroot = level 0',
    meaning:'Maximum depth of the DNS inverted-tree name space',
    explanation:'DNS is a hierarchical tree with the root at the top (level 0) and up to 128 levels total. Each node has a label of ≤ 63 characters.',
    keyPoints:['Root = level 0','Max 128 levels (0–127)','Label ≤ 63 characters','Full domain name ≤ 255 chars'],
    steps:[
      {title:'Root',math:'level 0',desc:'Empty string "."'},
      {title:'TLD',math:'level 1',desc:'.com / .edu'},
      {title:'Domain',math:'level 2',desc:'example.com'},
      {title:'Bound',math:'≤ 128',desc:'Maximum depth'}
    ],
    workedExample:{ q:'What is the maximum DNS depth?', s:['Levels 0 to 127','= 128 levels total','→ max depth = 128'] },
    visual:'fDnsLevels', mini:'fDnsLevelsMin'
  },
  {
    id:'http-req', unit:'V', topicId:'www-http', cat:'HTTP', page:'Page 285',
    title:'HTTP — Request Line Format',
    quote:'HTTP version 1.1 specifies a persistent connection by default.',
    formula:'METHOD  /path  HTTP/1.1\nGET /index.html HTTP/1.1',
    meaning:'The first line of an HTTP request states method, path, and version',
    explanation:'An HTTP request starts with a request line: METHOD (GET, POST, PUT, DELETE) followed by the resource path, then the protocol version. Headers follow on subsequent lines.',
    keyPoints:['Method = action (GET/POST/…)','Path = resource location','Version = HTTP/1.0 or 1.1','1.1 defaults to persistent connections'],
    steps:[
      {title:'Method',math:'GET',desc:'Read a resource'},
      {title:'Path',math:'/index.html',desc:'What to fetch'},
      {title:'Version',math:'HTTP/1.1',desc:'Persistent by default'},
      {title:'Full line',math:'GET /index.html HTTP/1.1',desc:'Request line'}
    ],
    workedExample:{ q:'Write the request line for fetching /about on HTTP/1.1', s:['Method: GET','Path: /about','Version: HTTP/1.1','→ GET /about HTTP/1.1'] },
    visual:'fHttpReq', mini:'fHttpReqMin'
  },
  {
    id:'ftp-ports', unit:'V', topicId:'ftp', cat:'FTP', page:'Page 249',
    title:'FTP — Control vs Data Ports',
    quote:'FTP uses two TCP connections.',
    formula:'CONTROL  =  port 21\nDATA     =  port 20',
    meaning:'Control channel carries commands; data channel carries the file',
    explanation:'Splitting into two connections keeps the control channel responsive — you can send commands (like ABOR to abort) while a large file is streaming on the data channel.',
    keyPoints:['Control: 21 (persistent)','Data: 20 (opened per transfer)','Control carries USER/PASS/RETR','Data carries actual file bytes'],
    steps:[
      {title:'Control',math:'port 21',desc:'Open at login, stays'},
      {title:'Command',math:'RETR file',desc:'Ask for file'},
      {title:'Data',math:'port 20',desc:'Opened for transfer'},
      {title:'Close',math:'data → 20',desc:'Per-transfer lifecycle'}
    ],
    workedExample:{ q:'Which port handles the FTP control channel?', s:['Control = 21','Data = 20','Commands use 21','→ Answer: 21'] },
    visual:'fFtpPorts', mini:'fFtpPortsMin'
  },
  {
    id:'smtp-port', unit:'V', topicId:'smtp', cat:'SMTP', page:'Page 249',
    title:'SMTP — Submission Port',
    quote:'SMTP - Simple Mail Transfer Protocol - For mail transfer.',
    formula:'SMTP  =  port 25\nSubmission (auth) = port 587',
    meaning:'Outbound email uses port 25; authenticated submission uses 587',
    explanation:'Classic SMTP relays on port 25. Modern email clients submit authenticated mail on port 587 (STARTTLS). Retrieval happens via POP3 (110) or IMAP (143).',
    keyPoints:['SMTP relay = 25','Authenticated submission = 587','POP3 = 110 (pull)','IMAP = 143 (pull, kept in sync)'],
    steps:[
      {title:'Client submit',math:'→ :587',desc:'Authenticated'},
      {title:'Server relay',math:'→ :25',desc:'Server-to-server'},
      {title:'Recipient store',math:'inbox',desc:'Saved'},
      {title:'Client pull',math:'POP3 :110',desc:'Or IMAP :143'}
    ],
    workedExample:{ q:'Which port for authenticated mail submission?', s:['Plain relay = 25','Auth submission = 587','→ Answer: 587'] },
    visual:'fSmtpPort', mini:'fSmtpPortMin'
  },
  {
    id:'telnet-port', unit:'V', topicId:'telnet', cat:'TELNET', page:'Page 263',
    title:'TELNET — Port + NVT',
    quote:'TELNET enables the establishment of a connection to a remote system in such a way that the local terminal appears to be a terminal at the remote system.',
    formula:'TELNET  =  port 23\nNVT     =  7-bit ASCII (universal)',
    meaning:'Remote login on port 23 using a universal character set',
    explanation:'TELNET uses TCP port 23. Both client and server convert to/from NVT — a 7-bit ASCII character set — so any two systems can interoperate regardless of native encoding.',
    keyPoints:['TCP port 23','NVT = Network Virtual Terminal','NVT = 7-bit ASCII','Platform-independent'],
    steps:[
      {title:'Connect',math:'→ :23',desc:'Open TCP session'},
      {title:'Encode',math:'→ NVT',desc:'Local chars → universal'},
      {title:'Transmit',math:'7-bit ASCII',desc:'Across the network'},
      {title:'Decode',math:'NVT → native',desc:'Server maps to own charset'}
    ],
    workedExample:{ q:'What port does TELNET use?', s:['TELNET = port 23','NVT = 7-bit ASCII','→ Answer: 23'] },
    visual:'fTelnetPort', mini:'fTelnetPortMin'
  },
  {
    id:'rtp-header', unit:'V', topicId:'rtp', cat:'RTP', page:'Page 257',
    title:'RTP — Header Size',
    quote:'The RTP format contains several features.',
    formula:'RTP header  ≥  12 bytes\n(3 × 32-bit words + extensions)',
    meaning:'Fixed 12-byte base header, may extend for mixing',
    explanation:'The RTP base header is three 32-bit words (12 bytes): version+flags, sequence number+timestamp, and SSRC. Optional contributing sources and extensions may follow.',
    keyPoints:['Base header = 12 bytes','Contains seq#, timestamp, SSRC','CSRC list optional','No retransmissions'],
    steps:[
      {title:'Word 1',math:'4 bytes',desc:'Version, flags, count'},
      {title:'Word 2',math:'4 bytes',desc:'Sequence + timestamp'},
      {title:'Word 3',math:'4 bytes',desc:'SSRC (stream ID)'},
      {title:'Total',math:'≥ 12 bytes',desc:'Plus optional CSRC'}
    ],
    workedExample:{ q:'Minimum RTP header size?', s:['3 × 32-bit words','3 × 4 = 12 bytes','→ Answer: 12 bytes'] },
    visual:'fRtpHeader', mini:'fRtpHeaderMin'
  }
];

window.XC.FORMULAS = FORMULAS;

