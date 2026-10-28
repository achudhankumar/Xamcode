/* ============================================================
   DATA — VAATHIYAR MODE · UNIT III (NETWORK LAYER)
   ============================================================
   Merges into the shared VAATHIYAR map, so getVaathiyar() resolves
   these without any other change.

   Every entry carries the same 16 sub-modes as Units I and II, plus
   the matching *Explain blocks.
   ============================================================ */
window.XC = window.XC || {};

Object.assign(window.XC.VAATHIYAR, {

  'nl-issues': {
    crash:[
      { tag:'THE JOB', text:"The Data Link layer moves a frame across ONE link. The Network layer must move a packet from the SOURCE all the way to the DESTINATION, possibly across a dozen different networks.", visual:`<svg viewBox="0 0 420 110" style="width:100%;max-width:420px"><circle cx="36" cy="58" r="18" fill="#2dd4bf"/><text x="36" y="63" text-anchor="middle" font-size="11" fill="#042f2e" font-weight="800">A</text>${Array.from({length:4},(_,i)=>`<circle cx="${108+i*66}" cy="58" r="14" fill="#1e293b" stroke="#334155"/><text x="${108+i*66}" y="63" text-anchor="middle" font-size="9" fill="#64748b">R${i+1}</text>`).join('')}<circle cx="388" cy="58" r="18" fill="#f472b6"/><text x="388" y="63" text-anchor="middle" font-size="11" fill="#450a0a" font-weight="800">B</text><text x="200" y="22" text-anchor="middle" font-size="11" fill="#facc15" font-weight="800">ONE PACKET · MANY HOPS · MANY OWNERS</text></svg>`, readMs:5400 },
      { tag:'THE FIVE PROBLEMS', text:"Every packet must be answered with five questions: addressing, routing, forwarding, fragmentation, and internetworking between networks that disagree.", visual:`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:440px;margin:0 auto;font-size:11px"><div style="padding:9px;border-radius:10px;background:rgba(45,212,191,.10);border:1px solid #2dd4bf;color:#2dd4bf;font-weight:800">1 · ADDRESSING<span style="display:block;color:#94a3b8;font-weight:400;font-size:10px">Logical + physical</span></div><div style="padding:9px;border-radius:10px;background:rgba(250,204,21,.10);border:1px solid #facc15;color:#facc15;font-weight:800">2 · ROUTING<span style="display:block;color:#94a3b8;font-weight:400;font-size:10px">Choose the path</span></div><div style="padding:9px;border-radius:10px;background:rgba(244,114,182,.10);border:1px solid #f472b6;color:#f472b6;font-weight:800">3 · FORWARDING<span style="display:block;color:#94a3b8;font-weight:400;font-size:10px">Act on the table</span></div><div style="padding:9px;border-radius:10px;background:rgba(34,197,94,.10);border:1px solid #22c55e;color:#22c55e;font-weight:800">4 · FRAGMENTATION<span style="display:block;color:#94a3b8;font-weight:400;font-size:10px">Split big packets</span></div><div style="padding:9px;border-radius:10px;background:rgba(167,139,250,.10);border:1px solid #a78bfa;color:#a78bfa;font-weight:800">5 · INTERNETWORKING<span style="display:block;color:#94a3b8;font-weight:400;font-size:10px">Join unlike networks</span></div></div>`, readMs:5800 },
      { tag:'LOGICAL vs PHYSICAL', text:"A MAC address only means something on the local link — routers change it at every hop. An IP address identifies the HOST and stays the same end to end, which is how the destination can be found across the internet.", visual:`<div style="text-align:center;font-family:monospace;font-size:12px;color:#cbd5e1;line-height:2.1">Hop 1 &nbsp; src MAC → router MAC<br>Hop 2 &nbsp; router MAC → router MAC<br>Hop 3 &nbsp; router MAC → dst MAC<br><span style="color:#2dd4bf">IP: src → dst &nbsp; (never changes)</span></div>`, readMs:5800 },
      { tag:'MTU & FRAGMENTATION', text:"Different links allow different maximum packet sizes. When a packet is too big for the next link, the router either SPLITS it (IPv4) or tells the sender to use smaller packets (IPv6).", visual:`<svg viewBox="0 0 420 105" style="width:100%;max-width:420px"><rect x="10" y="28" width="175" height="26" rx="5" fill="#22c55e"/><text x="97" y="45" text-anchor="middle" font-size="10" fill="#052e16" font-weight="800">1500 B (Ethernet)</text><path d="M190 41 l38 0" stroke="#facc15" stroke-width="2"/><text x="209" y="34" text-anchor="middle" font-size="10" fill="#facc15" font-weight="800">too big</text><rect x="233" y="28" width="177" height="26" rx="5" fill="#1e293b" stroke="#334155"/><text x="321" y="45" text-anchor="middle" font-size="10" fill="#94a3b8">576 B (dial-up)</text><text x="210" y="82" text-anchor="middle" font-size="11" fill="#f472b6" font-weight="800">IPv4 fragments &nbsp;|&nbsp; IPv6 refuses</text></svg>`, readMs:5800 },
      { tag:'⚡ ONE LINE', text:"Routing decides the path. Forwarding just walks the table, one hop at a time.", visual:`<div style="text-align:center"><div style="color:#2dd4bf;font-weight:900;font-size:16px;padding:16px 26px;background:rgba(45,212,191,.08);border:2px dashed rgba(45,212,191,.4);border-radius:14px;max-width:520px;margin:0 auto">Routing = planning the trip. Forwarding = reading the sign at each junction.</div></div>`, readMs:5000 }
    ],
    crashExplain:[
      {h:'Why two kinds of address', t:'A MAC address is only meaningful on the segment where it appears, so routers rewrite it constantly. An IP address names the end host and must survive every hop, which is what makes internetworking possible.'},
      {h:'Why fragmentation is controversial', t:'Splitting a packet forces every downstream router to reassemble it, adding delay and memory cost, and a single lost fragment destroys the whole packet. IPv6 removed router fragmentation entirely.'},
      {h:'Why routing and forwarding are separate', t:'Routing is the slow, control-plane decision made by protocols. Forwarding is the fast, data-plane action taken per packet from a precomputed table.'}
    ],
    compare:{
      left:'Data Link layer', right:'Network layer',
      rows:[
        ['Scope','One single link','End to end, across many links'],
        ['Unit sent','Frame','Packet / datagram'],
        ['Addressing','Physical (MAC)','Logical (IP)'],
        ['Address changes','Every hop','Never changes'],
        ['Error control','Per link, mandatory','End to end, optional']
      ],
      bars:[
        {label:'Hop count awareness', leftPct:10, rightPct:100, leftTxt:'Blind', rightTxt:'Knows the path'},
        {label:'Congestion role', leftPct:15, rightPct:95, leftTxt:'None', rightTxt:'Central'},
        {label:'Routing decisions', leftPct:5, rightPct:100, leftTxt:'None', rightTxt:'Its whole job'},
        {label:'Speed', leftPct:95, rightPct:70, leftTxt:'Hardware only', rightTxt:'Software'}
      ]
    },
    compareExplain:[
      {h:'The core difference', t:'The Data Link layer moves one hop and trusts the next layer to handle the rest. The Network layer maintains the whole journey and is the only layer that knows a path exists.'},
      {h:'Why MAC changes but IP does not', t:'Each link has its own local naming, so the MAC is rewritten as the packet crosses each router. The IP must remain constant, otherwise the destination host could not recognise a packet addressed to it.'},
      {h:'Why congestion is a network-layer problem', t:'A router is the first device that can see many flows competing for one outgoing link, so it is the natural place to detect and signal congestion.'}
    ],
    solve:{
      q:'A 4000-byte packet arrives at a router whose outgoing link has an MTU of 1500 bytes. If IPv4 adds a 20-byte header per fragment, how many fragments result?',
      steps:[
        {label:'STEP 1 — PAYLOAD PER LINK', math:'1500 − 20 = 1480 bytes',          note:'MTU minus IPv4 header'},
        {label:'STEP 2 — PAYLOAD AVAILABLE', math:'4000 − 20 = 3980 bytes',      note:'Original data plus its header'},
        {label:'STEP 3 — FRAGMENTS',     math:'4000 / 1480 = 2.70',               note:'Round up to the next whole'},
        {label:'STEP 4 — COUNT',          math:'3 fragments',                      note:'2 full + 1 remainder'},
        {label:'STEP 5 — OVERHEAD ADDED', math:'3 × 20 = 60 bytes of header',     note:'IPv6 would add zero here'},
        {label:'ANSWER',                  math:'3 fragments, 60 bytes extra',     note:'Routers reassemble at the destination'}
      ]
    },
    solveExplain:[
      {h:'Why subtract 20 each time', t:'Each fragment carries its own full IP header, so the data that fits in one fragment is the MTU minus that header, not the MTU itself.'},
      {h:'Why round up', t:'The last fragment holds only 4000 − 2960 = 1040 bytes of data but still occupies a whole header, which is why three fragments cost 60 header bytes in total.'},
      {h:'What IPv6 would do instead', t:'IPv6 routers never fragment. The router sends an ICMPv6 Packet Too Big message telling the source to use smaller packets, and the source does the splitting.'},
      {h:'The reassembly risk', t:'The destination must hold every fragment until they all arrive. Lose one fragment of three and the entire original packet is discarded, so fragmentation amplifies the effect of any single loss.'}
    ],
    life:[
      {ic:'🌍',h:'The internet itself',t:'Every packet crossing the internet is a network-layer packet. MAC addresses never leave the local link; IP addresses are the only thing that survives the journey.'},
      {ic:'📦',h:'Online shopping',t:'A 4000-byte request that meets a smaller MTU on the way to a payment server is what makes a slow checkout hang on "sending".'},
      {ic:'📱',h:'Mobile data',t:'When your phone moves from a 4G cell to a slower one, the path changes mid-connection and IP addresses must stay valid throughout.'},
      {ic:'🏠',h:'Home routers',t:'The box in your hall decides which of your devices is on WiFi versus which is using mobile data, purely from IP addresses.'},
      {ic:'🎮',h:'Online gaming',t:'Your position updates carry an IP address that must reach the server even though your device changes networks mid-match.'},
      {ic:'📞',h:'Video calls',t:'A call that switches from WiFi to cellular keeps the same IP identity, which is why the call continues rather than dropping.'}
    ],
    lifeExplain:[
      {h:'The pattern', t:'Any time a packet crosses more than one network, something must keep track of the whole journey. That something is the network layer.'},
      {h:'Why fragmentation feels like a bug', t:'A slow link in the middle of a fast connection is the usual cause. The user experiences it as "the website is broken" rather than "the MTU did not match".'}
    ],
    history:[
      {yr:'1971',h:'ARPANET NCP',t:'The first network layer simply connected hosts on one network; routing between separate networks did not yet exist.'},
      {yr:'1974',h:'Cerf and Kahn',t:'The internetworking paper described packet switching across interconnected networks, making the network layer a real layer rather than part of the link.'},
      {yr:'1981',h:'IPv4 standardised',t:'A 32-bit address space with a maximum transmission unit and fragmentation behaviour that is still the basis of the web today.'},
      {yr:'1980s',h:'Subnetting',t:'Private address ranges let large organisations run many internal networks behind one public address, stretching IPv4 considerably.'},
      {yr:'1995',h:'CIDR',t:'Classless routing replaced fixed class A, B and C blocks with variable-length prefixes, halting the waste that was exhausting IPv4.'},
      {yr:'2010s',h:'IPv6 rollout',t:'A 128-bit address space finally ended the scarcity, and its designers removed router fragmentation entirely to fix a long-standing source of fragility.'}
    ],
    historyExplain:[
      {h:'A pattern worth noticing', t:'Every version of the network layer was driven by address exhaustion. IPv4 doubled its address space with NAT, then with CIDR, then again with IPv6.'},
      {h:'Why fragmentation was removed', t:'It was the last major piece of the network layer that could harm the network it was built to serve, so IPv6 moved the responsibility back to the sender where it can be made smarter.'}
    ],
    flash:[
      {q:'What is the job of the network layer?',a:'Move a packet from the source host to the destination host across many separate networks.'},
      {q:'How many bits is an IPv4 address?',a:'32 bits, conventionally written as four dotted decimal octets.'},
      {q:'Why does the MAC address change at every hop?',a:'A MAC address only identifies a device on one local segment, so each router rewrites it as the packet leaves for the next link.'},
      {q:'What is the MTU?',a:'The maximum packet size a link can carry. Ethernet is 1500 bytes; a smaller link forces fragmentation.'},
      {q:'How does IPv4 handle a too-large packet?',a:'The router splits it into fragments, each with its own header, and the destination reassembles them.'},
      {q:'How does IPv6 handle a too-large packet?',a:'The router never fragments. It returns an ICMPv6 Packet Too Big message and the source splits the packet instead.'},
      {q:'What is the difference between routing and forwarding?',a:'Routing is the slow control-plane computation that builds the table; forwarding is the fast per-packet lookup that acts on it.'},
      {q:'Why is fragmentation considered harmful?',a:'Every router along the path must reassemble and buffer, and losing one fragment discards the whole packet.'}
    ],
    flashExplain:[
      {h:'Fastest way to remember', t:'Link layer = your street. Network layer = the whole city. A MAC gets you to the next junction; an IP gets you across the country.'},
      {h:'Most common exam slip', t:'Confusing logical and physical addressing. MAC changes every hop; IP never changes until NAT rewrites it.'}
    ],
    exam:[
      {q:'Explain the five design issues of the network layer and why each arises.',a:'Addressing arises because packets must be directed between millions of hosts, requiring a hierarchical logical address alongside the flat hardware address of the link layer. Routing arises because there are many possible paths between two hosts and one must be chosen. Forwarding arises because routing must be practical at line speed, so routers precompute decisions into a table rather than running an algorithm per packet. Fragmentation arises because different links support different maximum transmission units, so a packet too large for the next link must be split. Internetworking arises because the network layer must connect networks using different technologies and address schemes into one addressable system.'},
      {q:'Differentiate logical and physical addressing, with an example of each changing during transmission.',a:'A physical address such as a 48-bit MAC identifies an interface on one local link and is meaningful only there, so it changes at every router. A logical address such as a 32-bit IPv4 address identifies the end host and must remain constant across the entire journey so the destination can recognise a packet intended for it. In a packet from host A to host B through two routers, the MAC addresses are A to router 1, router 1 to router 2, and router 2 to B, while the source and destination IP addresses remain identical at every hop.'},
      {q:'What is the MTU and why does it cause fragmentation? Show with an example.',a:'The maximum transmission unit is the largest packet a link will accept in one frame without fragmentation, which is 1500 bytes for standard Ethernet. When a router receives a packet larger than the outgoing MTU it cannot forward it intact. If the packet is 4000 bytes and the outgoing MTU is 1500 bytes with a 20-byte IPv4 header, each fragment carries 1480 bytes of data, so the packet is split into three fragments. This adds 40 bytes of extra header overhead and requires the destination to buffer all fragments before delivering the packet.'},
      {q:'Explain the difference between the control plane and the data plane in a router.',a:'The control plane runs routing protocols to compute which paths exist, filling and maintaining the forwarding table. It is computationally heavy and runs at low frequency. The data plane receives arriving packets, looks up the destination address in the forwarding table, and forwards the packet to the next hop in nanoseconds. Separating them lets the control plane be sophisticated and slow while the data plane stays fast, and it is the basis of software-defined networking where the two run on separate machines.'}
    ],
    examExplain:[
      {h:'Answer the five issues in order', t:'Addressing, routing, forwarding, fragmentation, internetworking. Examiners mark in that sequence.'},
      {h:'Always give a hop-by-hop example', t:'For the physical-versus-logical question, listing the MAC pair at each hop earns the marks, not just the definition.'},
      {h:'Do not skip the overhead arithmetic', t:'In MTU questions, state how many bytes each header costs. That is usually where the final marks are.'}
    ],
    eli5:{
      kid:'Imagine you are posting a parcel to a friend in another city. A street address alone would not help, because postmen only deliver on their own street. So you add a city and postcode — that is the logical address, and it stays the same the whole journey. Meanwhile the postman changes at every sorting office, exactly like a MAC address changing at every router. The big sorting office decides which road your parcel takes next, and that list of decisions is the routing table.',
      middle:'The network layer moves a packet from the source host all the way to the destination host across many different networks. It introduces logical addressing such as an IP address, which identifies the host and stays constant across the entire journey, unlike the MAC address of the link layer which is rewritten at every router. Because many paths may connect two hosts, routing protocols compute which path to use, and forwarding applies that decision quickly at each router. Since different links allow different maximum packet sizes, the MTU may require a packet to be fragmented in IPv4 or rejected and reported in IPv6.',
      engg:'The network layer provides host-to-host delivery across interconnected heterogeneous networks. Logical addresses are hierarchical and remain stable end-to-end, while link-layer addresses are scoped to a single segment and are rewritten per hop. The forwarding table maps longest-prefix destination prefixes to next hops and outgoing interfaces; the control plane populates this table using routing protocols, while the data plane performs per-packet lookups at line rate. Path MTU discovery allows a source to learn the smallest MTU along a path, as IPv4 routers fragment datagrams when the DF bit is clear, whereas IPv6 routers never fragment and instead return ICMPv6 Packet Too Big. Fragmentation is discouraged because it multiplies header overhead and requires complete buffering at the destination, so any lost fragment discards the entire datagram.'
    },
    eli5Explain:[
      {h:'The single idea underneath', t:'The link layer knows your street. The network layer knows the postcode. Only one of those survives the journey.'},
      {h:'Why IPv6 trusts the sender', t:'A source knows its own bandwidth and can split sensibly. A middle router sees one fragment of a conversation and splits blindly.'}
    ]
  },

  'dijkstra': {
    crash:[
      { tag:'THE PROBLEM', text:"A router knows the cost of each outgoing link. Which path from A to F is cheapest overall? You cannot just look one hop ahead — you have to compare whole routes.", visual:`<svg viewBox="0 0 420 140" style="width:100%;max-width:420px"><g stroke="#334155" stroke-width="2">${[[40,110,130,40],[40,110,130,110],[130,40,230,40],[130,110,230,110],[230,40,330,40],[230,110,330,110],[130,40,230,110]].map(l=>`<line x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}"/>`).join('')}</g>${[[40,110],[130,40],[130,110],[230,40],[230,110],[330,40],[330,110]].map((n,i)=>`<circle cx="${n[0]}" cy="${n[1]}" r="17" fill="#1e293b" stroke="#2dd4bf"/><text x="${n[0]}" y="${n[1]+5}" text-anchor="middle" font-size="11" fill="#2dd4bf" font-weight="800">${'ABCDEFG'[i]}</text>`).join('')}<text x="210" y="132" text-anchor="middle" font-size="11" fill="#facc15" font-weight="800">Which route from A to G is cheapest?</text></svg>`, readMs:5400 },
      { tag:'THE GREEDY MOVE', text:"Dijkstra picks the CLOSEST unvisited node and finalises it. Once a node is finalised, its distance will never change again — that is the whole trick.", visual:`<div style="text-align:center;font-family:monospace;font-size:13px;color:#cbd5e1;line-height:2.2">finalise the node with the<br><span style="color:#facc15">SMALLEST tentative distance</span><br>repeat until all are final</div>`, readMs:5400 },
      { tag:'THE ALGORITHM', text:"Set every distance to infinity except the source at zero. Mark the source visited. Then repeatedly: pick the smallest unvisited distance, and relax every edge leaving it — meaning add the edge cost to the neighbour's distance and keep the smaller result.", visual:`<svg viewBox="0 0 420 130" style="width:100%;max-width:420px"><rect x="12" y="26" width="396" height="20" rx="4" fill="#0f172a" stroke="#334155"/><text x="22" y="40" font-size="10" fill="#64748b">A  B  C  D  E  F  G</text><rect x="12" y="54" width="396" height="20" rx="4" fill="#0f172a" stroke="#334155"/><text x="22" y="68" font-size="10" fill="#94a3b8">0  4  2  7  5  9  ∞</text><text x="210" y="98" text-anchor="middle" font-size="11" fill="#2dd4bf" font-weight="800">finalise A → relax its edges</text><text x="210" y="118" text-anchor="middle" font-size="11" fill="#f472b6" font-weight="800">B=4  C=2  D=7</text></svg>`, readMs:5800 },
      { tag:'WHY IT WORKS', text:"Because all costs are NON-NEGATIVE, the cheapest unsettled node can never be improved later by going through something further away. That single assumption is why Dijkstra is correct.", visual:`<div style="text-align:center"><div style="color:#f472b6;font-weight:900;font-size:16px;padding:16px 26px;background:rgba(244,114,182,.08);border:2px dashed rgba(244,114,182,.4);border-radius:14px;max-width:520px;margin:0 auto">No negative edges → greedy is safe</div><div style="color:#94a3b8;font-size:11px;margin-top:12px">One negative edge and Dijkstra breaks entirely</div></div>`, readMs:5600 },
      { tag:'⚡ ONE LINE', text:"Always expand the nearest known node. Never expand a far one hoping to find a shortcut.", visual:`<div style="text-align:center"><div style="color:#2dd4bf;font-weight:900;font-size:16px;padding:16px 26px;background:rgba(45,212,191,.08);border:2px dashed rgba(45,212,191,.4);border-radius:14px;max-width:520px;margin:0 auto">Nearest first. Always. That is the entire algorithm.</div></div>`, readMs:5000 }
    ],
    crashExplain:[
      {h:'What "finalised" means', t:'A visited node has had the shortest possible distance proven and can never change again, so it is safe to skip it in every later iteration.'},
      {h:'What "relaxing" means', t:'For edge u→v with cost c, try distance[u] + c. If that beats the current distance[v], replace it. This is the only place distances improve.'},
      {h:'Why negative costs break it', t:'A far node reached via a path with negative edges could later become genuinely cheaper than the settled node, invalidating the greedy choice. Bellman-Ford exists for that case.'}
    ],
    compare:{
      left:'Dijkstra', right:'Bellman-Ford',
      rows:[
        ['Core idea','Greedy — expand nearest','Dynamic programming — relax all'],
        ['Negative edges','Breaks completely','Handles them correctly'],
        ['Time complexity','O(V²) or O(E log V)','O(V × E)'],
        ['Update rule','Only from the settled node','Relax every edge, V−1 times']
      ],
      bars:[
        {label:'Speed', leftPct:95, rightPct:45, leftTxt:'Very fast', rightTxt:'Slower'},
        {label:'Negative edges', leftPct:5, rightPct:100, leftTxt:'Fails', rightTxt:'Safe'},
        {label:'Early exit', leftPct:90, rightPct:15, leftTxt:'Yes, once settled', rightTxt:'No'},
        {label:'Implementation', leftPct:80, rightPct:55, leftTxt:'Simple', rightTxt:'Loops'}
      ]
    },
    compareExplain:[
      {h:'The core difference', t:'Dijkstra commits to a node as soon as it is cheapest and never revisits that decision. Bellman-Ford keeps improving every estimate repeatedly and can even detect negative cycles.'},
      {h:'When to choose which', t:'Use Dijkstra for weighted networks with no negative edges, which covers ordinary link-cost routing. Use Bellman-Ford only when negative costs can genuinely occur, such as certain cost adjustments in shortest-path models.'},
      {h:'The practical speed gap', t:'Dijkstra with a priority queue is O(E log V) and stops as soon as the target is settled, whereas Bellman-Ford always runs V−1 full passes over every edge regardless of the answer.'}
    ],
    solve:{
      q:'Using Dijkstra on A(0) → B(4), A → C(2), B → C(1), B → D(5), C → D(8), C → E(10), D → E(2), E → F(3). Find the shortest distance from A to F.',
      steps:[
        {label:'STEP 1 — INITIALISE', math:'A=0, all others = ∞',            note:'Only the source is known'},
        {label:'STEP 2 — SETTLE A',    math:'relax: B=4, C=2, D=7',          note:'Direct edges from A'},
        {label:'STEP 3 — SETTLE C',    math:'C=2 is smallest → D=10 (no), E=12', note:'8>7 and 10<∞ so E improves'},
        {label:'STEP 4 — SETTLE B',    math:'B=4 → C=5 (worse), D=9 (worse)',note:'Neither improves'},
        {label:'STEP 5 — SETTLE D',    math:'D=7 → E=9 (better than 12)',    note:'Edge D→E costs 2'},
        {label:'STEP 6 — SETTLE E',    math:'E=9 → F=12',                    note:'Edge E→F costs 3'},
        {label:'ANSWER',                math:'shortest A→F = 12 via A→C→D→E→F', note:'Path length 2+5+2+3'}
      ]
    },
    solveExplain:[
      {h:'Why C is settled before B', t:'The algorithm picks the smallest tentative distance, which is C at 2, not B at 4. This single ordering decision is what separates Dijkstra from a naive walk.'},
      {h:'Why relaxing from B changes nothing', t:'Reaching C through B costs 4 + 1 = 5, which is worse than the 2 already found, and D through B costs 4 + 5 = 9, worse than 7. A settled neighbour has already been beaten.'},
      {h:'The final path', t:'A→C costs 2, C→D costs 5 giving 7, D→E costs 2 giving 9, and E→F costs 3 giving 12. The longer-looking route A→B→C→D→E→F costs 15 and is correctly rejected.'},
      {h:'What the parent pointers give', t:'Recording which neighbour produced each improvement reconstructs the path itself, not just the distance. Without storing parents you would know 12 is optimal but not which route achieves it.'}
    ],
    life:[
      {ic:'🗺️',h:'Google Maps',t:'Road networks are weighted graphs. Dijkstra variants power the route planner, with weights being travel time rather than distance.'},
      {ic:'🚦',h:'Traffic networks',t:'OSPF uses a Dijkstra-style shortest-path computation so every router in an area agrees on the same forwarding table.'},
      {ic:'✈️',h:'Airline routes',t:'Hub-and-spoke networks pick optimal connections between airports using shortest-path search over flight times.'},
      {ic:'📦',h:'Delivery logistics',t:'Depots and delivery vans form a graph, and minimising total travel cost is a shortest-path problem.'},
      {ic:'🎮',h:'Game pathfinding',t:'A* is Dijkstra with a heuristic added, which is the same idea but guided toward the goal instead of exploring blindly.'},
      {ic:'🚇',h:'Metro planning',t:'Interchange stations and lines form a weighted graph used to plan routes and estimate journey time.'}
    ],
    lifeExplain:[
      {h:'The pattern', t:'Anywhere you can describe places as nodes and journeys between them as costs, shortest-path search is the tool — and cost is rarely distance.'},
      {h:'Why A* is Dijkstra plus a hint', t:'If you already know roughly which direction the goal lies, exploring the most promising node first finishes far sooner than exploring everything.'}
    ],
    history:[
      {yr:'1956',h:'Edsger Dijkstra',t:'Dijkstra designed the algorithm while working on a mathematical problem about the shortest route through a network with non-negative weights.'},
      {yr:'1959',h:'Bellman-Ford',t:'Richard Bellman and Robert Floyd published methods that tolerate negative weights, and Floyd later added path reconstruction for all-pairs answers.'},
      {yr:'1968',h:'ARPANET routing',t:'The first internet routers used a distributed shortest-path calculation, since no central table existed for a network nobody owned.'},
      {yr:'1981',h:'OSPF specified',t:'The Internet Engineering Task Force standardised a link-state protocol whose core computation is a shortest-path algorithm.'},
      {yr:'1990s',h:'Priority-queue speedups',t:'Binary heap implementations reduced the running time from O(V²) to O(E log V), making Dijkstra practical for very large graphs.'},
      {yr:'2010s',h:'A* everywhere',t:'A* search became standard for games, robotics and route planning, adding a heuristic to prune nodes that cannot lead to the goal.'}
    ],
    historyExplain:[
      {h:'A pattern worth noticing', t:'The pure mathematical result arrived in 1956, decades before the hardware could run it usefully. The speedups in the 1990s are what turned it into real infrastructure.'},
      {h:'Why routers need it at all', t:'No router knows the whole internet. Each computes shortest paths from its own local database, which is why protocols are designed to converge on consistent results.'}
    ],
    flash:[
      {q:'What is the one rule of Dijkstra?',a:'Always settle the unvisited node with the smallest tentative distance.'},
      {q:'What does "settled" mean?',a:'The node has been proven to have its final shortest distance and will never be reconsidered.'},
      {q:'What is relaxing an edge u→v?',a:'Try distance[u] + cost(u,v). If that is smaller than the current distance[v], replace it.'},
      {q:'What are the initial values?',a:'Source distance is 0 and every other node starts at infinity, since nothing is reachable yet.'},
      {q:'Why does Dijkstra fail on negative edges?',a:'A far node may later become cheaper via a negative edge, invalidating the greedy choice of the smallest current distance.'},
      {q:'What is the time complexity?',a:'O(V²) with a simple array, or O(E log V) using a binary heap priority queue.'},
      {q:'How is the actual path recovered?',a:'Store a parent pointer on every improvement, then walk backwards from the destination to the source.'},
      {q:'What does A* add to Dijkstra?',a:'A heuristic estimate of remaining cost, so exploration is guided toward the goal instead of covering everything.'}
    ],
    flashExplain:[
      {h:'Fastest way to remember', t:'Nearest unsettled node, then relax its edges, repeat. Everything else is bookkeeping.'},
      {h:'Most common exam slip', t:'Settling a node in the order it was discovered rather than by smallest distance. That is not Dijkstra and gives wrong answers.'}
    ],
    exam:[
      {q:'State Dijkstra algorithm and explain why it produces shortest paths.',a:'Initialise every vertex distance to infinity except the source, which is set to zero, and mark the source settled. Repeatedly select the unsettled vertex with the smallest tentative distance, mark it settled, and for each adjacent vertex relax the edge by comparing the current distance with the settled distance plus the edge cost, updating when smaller and recording the predecessor. The algorithm is correct because all edge costs are non-negative, so any path reaching an unsettled vertex through a farther vertex cannot be cheaper than the direct settled route already known, meaning a settled distance can never decrease.'},
      {q:'Why does Dijkstra fail if any edge has a negative weight, and which algorithm replaces it?',a:'Dijkstra relies on the greedy assumption that once a vertex has the smallest tentative distance its value is final. A negative edge allows a path through a farther vertex to become cheaper later, so a vertex settled early may later receive a smaller distance through an unsettled route, and the recorded results become wrong. Bellman-Ford replaces it, relaxing all edges V−1 times, which tolerates negative weights and can also report whether a negative cycle exists.'},
      {q:'Explain how Dijkstra is used in shortest-path routing and state its suitability for the Internet.',a:'In routing, each router builds a link-cost graph from its known link metrics and runs a shortest-path computation to produce a forwarding table keyed by destination prefix. Dijkstra is suitable because link metrics such as bandwidth, delay and cost are never negative. It is only practical because protocols such as OSPF first flood link-state advertisements so every router in an area has the same graph and therefore computes the same table, which is what keeps forwarding consistent.'}
    ],
    examExplain:[
      {h:'Always name the assumption', t:'The correctness argument lives entirely in the non-negative-cost statement. Write it explicitly.'},
      {h:'State both complexities', t:'O(V²) for the array version and O(E log V) for the heap version. Examiners often ask for both.'},
      {h:'Link the algorithm to the protocol', t:'For routing questions, mention OSPF flooding. The algorithm alone does not explain how routers agree.'}
    ],
    eli5:{
      kid:'Imagine you are lost in a town trying to reach the station. Someone gives you a rule: always walk to the nearest place you know of, and keep a note of how far you walked to get there. Start with your hotel at zero. Whenever you arrive somewhere new, check whether you could have reached your friend house more cheaply through this new place, and if so rewrite the note. Because you always expand the nearest known place, and walking never makes you closer in a backwards way, you will never have to undo a decision.',
      middle:'Dijkstra finds the cheapest route through a network where places have edges with different costs. It keeps a tentative distance for every node, starting at zero for the source and infinity for everything else. It repeatedly settles the node with the smallest tentative distance, which can never improve later because all costs are positive, then relaxes each outgoing edge to see whether going through the settled node gives a cheaper route to its neighbour. Repeating this until every node is settled yields the shortest distance from the source to every node, and parent pointers recorded during relaxation reveal the actual paths.',
      engg:'Dijkstra single-source shortest-path algorithm maintains a tentative distance d(v) for each vertex, initialised to infinity except d(s)=0, and a settled set. Each iteration extracts the minimum-distance vertex u from a priority queue, settles it, and relaxes every outgoing edge by testing d(u)+w(u,v) against d(v), updating d(v) and its predecessor when smaller. Correctness follows from the cut property: with non-negative weights, the minimum-distance vertex across any cut has its final distance, since no path crossing the cut can be shorter. With an adjacency matrix the complexity is O(V²) and with a binary heap it is O(E log V). The algorithm requires non-negative weights; with negative edges the settled value can later decrease, so Bellman-Ford at O(V·E) is used instead, and it additionally detects negative cycles. Routers such as OSPF compute shortest paths over link-state databases whose metrics are non-negative, making Dijkstra the natural choice for the data plane forwarding table.'
    },
    eli5Explain:[
      {h:'The single idea underneath', t:'Expand the nearest known place, and never expand something further away — with positive costs, further can never become nearer later.'},
      {h:'Where the assumption bites', t:'The moment one edge has a negative cost, a distant place can become cheap after you have already committed, and the greedy choice becomes wrong.'}
    ]
  },

  'distance-vector': {
    crash:[
      { tag:'THE IDEA', text:"Instead of knowing the whole map, every router keeps one number for every destination: \"the cheapest cost I know of, and who told me\". That single number is a VECTOR because it is a list, one entry per destination.", visual:`<svg viewBox="0 0 420 120" style="width:100%;max-width:420px"><rect x="20" y="24" width="380" height="74" rx="10" fill="#0f172a" stroke="#334155"/><text x="34" y="44" font-size="11" fill="#2dd4bf" font-weight="800">Router 5 distance table</text><text x="34" y="64" font-size="10" fill="#94a3b8" font-family="monospace">to A : 3 hops via R2</text><text x="34" y="80" font-size="10" fill="#94a3b8" font-family="monospace">to B : 1 hop  via R7</text><text x="230" y="64" font-size="10" fill="#94a3b8" font-family="monospace">to C : 4 hops via R3</text><text x="230" y="80" font-size="10" fill="#94a3b8" font-family="monospace">to D : 2 hops via R7</text></svg>`, readMs:5600 },
      { tag:'BELLMAN-FORD', text:"The update rule: when a neighbour tells you \"I can reach X at cost c\", you ask whether c plus the cost to that neighbour beats what you already believe. If yes, copy the neighbour's value and add one.", visual:`<div style="text-align:center;font-family:monospace;font-size:14px;color:#cbd5e1;line-height:2.4">new = min( my current , <span style="color:#facc15">neighbour's cost</span> + <span style="color:#2dd4bf">cost to neighbour</span> )</div>`, readMs:5600 },
      { tag:'BELLMAN-FORD TIMING', text:"To be safe, repeat the update V−1 times, where V is the number of routers. After V−1 rounds, every possible shortest path has had time to propagate across the whole network.", visual:`<svg viewBox="0 0 420 110" style="width:100%;max-width:420px"><text x="210" y="22" text-anchor="middle" font-size="11" fill="#64748b">information spreads one hop per round</text>${Array.from({length:5},(_,i)=>`<circle cx="${44+i*84}" cy="62" r="15" fill="#1e293b" stroke="#2dd4bf"/><text x="${44+i*84}" y="67" text-anchor="middle" font-size="10" fill="#2dd4bf" font-weight="800">${i+1}</text><text x="${44+i*84}" y="94" text-anchor="middle" font-size="9" fill="#64748b">round ${i+1}</text>`).join('')}<text x="210" y="108" text-anchor="middle" font-size="10" fill="#facc15" font-weight="800">V − 1 rounds guarantee convergence</text></svg>`, readMs:5600 },
      { tag:'⚡ ONE LINE', text:"Routers gossip about their best guess. Eventually everyone agrees — and then one lie can make them agree on something wrong.", visual:`<div style="text-align:center"><div style="color:#f472b6;font-weight:900;font-size:16px;padding:16px 26px;background:rgba(244,114,182,.08);border:2px dashed rgba(244,114,182,.4);border-radius:14px;max-width:540px;margin:0 auto">Good news travels fast. Bad news travels slowly.</div></div>`, readMs:5200 }
    ],
    crashExplain:[
      {h:'Why "vector"', t:'A scalar distance is just one number. A vector is the whole list — one cost for every reachable destination — which is why the table is called a distance vector.'},
      {h:'Why V−1 rounds', t:'No shortest path can contain more than V−1 edges without repeating a vertex, since repeating one would create a cycle that could be removed to make the path cheaper.'},
      {h:'Why slow to recover', t:'A router that believes an old value only corrects itself when a neighbour reports a cheaper one. Nothing tells it the old information is stale, so the correction crawls back hop by hop.'}
    ],
    compare:{
      left:'Distance Vector', right:'Link State',
      rows:[
        ['What it knows','Its own neighbours only','The whole area topology'],
        ['Update trigger','A neighbour changed a cost','The router detects a change'],
        ['Sends','Its whole vector, periodically','Only the changed link'],
        ['Convergence','Slow — can take minutes','Fast — seconds'],
        ['Bad news','Slow to spread — count-to-infinity','Fast — flood fills everywhere']
      ],
      bars:[
        {label:'Convergence speed', leftPct:25, rightPct:95, leftTxt:'Slow', rightTxt:'Fast'},
        {label:'Bandwidth cost', leftPct:80, rightPct:30, leftTxt:'Heavy', rightTxt:'Light'},
        {label:'Memory needed', leftPct:90, rightPct:60, leftTxt:'Whole table + neighbours', rightTxt:'LSP database'},
        {label:'CPU cost', leftPct:70, rightPct:85, leftTxt:'Light', rightTxt:'Dijkstra each time'}
      ]
    },
    compareExplain:[
      {h:'The core difference', t:'Distance vector exchanges estimates with immediate neighbours only. Link state broadcasts the facts of its own links to everyone, so every router independently reconstructs the entire map.'},
      {h:'Why count-to-infinity happens', t:'When a link fails, the router cannot tell an unreachable destination from a very distant one. It increments its estimate by one each round, so a link counted as 16 takes many rounds to climb to 16, during which traffic loops.'},
      {h:'Why link state fixes it', t:'Every router learns immediately that the link is gone because the change is flooded to the entire area. Within seconds every router recomputes and the stale route disappears everywhere at once.'}
    ],
    solve:{
      q:'Network: A–B (1), B–C (1), C–D (1), B–D (5). Router B restarts with no table. What are its distance vectors after each full round of exchanges, and when does it converge?',
      steps:[
        {label:'STEP 1 — ROUND 1',  math:'B learns: A=1, C=1, D=min(5, 1+1)=2', note:'Direct links plus one hop of news'},
        {label:'STEP 2 — ROUND 2',  math:'D may now be reached as C=1 → D=2 (same)', note:'No improvement, table stable'},
        {label:'STEP 3 — CONVERGED', math:'A=1, C=1, D=2',                      note:'Correct: B→C→D beats direct B→D'},
        {label:'STEP 4 — IN WORDS', math:'V = 4 routers, so at most V−1 = 3 rounds', note:'Converged well before that'},
        {label:'ANSWER',             math:'Converges after 2 rounds with D=2',       note:'via C, not the direct 5-cost link'}
      ]
    },
    solveExplain:[
      {h:'Why D is 2 not 5', t:'In round 1, B hears from C that C can reach D at cost 1. Adding the B–C link cost of 1 gives 2, which beats the direct link of 5, so the shorter route wins immediately.'},
      {h:'Why round 2 changes nothing', t:'Every possible neighbour has now been heard from. Since no shorter route exists and nothing has changed, the vector in round 2 is identical, which is what convergence means.'},
      {h:'Why the bound is V−1', t:'With four routers the longest useful simple path has three edges. After three rounds of exchange, any improvement of that length has already propagated, so further rounds cannot help.'},
      {h:'What would break this', t:'If B–C later failed, B would hold D=2 for several rounds, incrementing it towards infinity because neither neighbour could offer a cheaper alternative. That climb is the count-to-infinity failure.'}
    ],
    life:[
      {ic:'📈',h:'Stock market prices',t:'Each trader quotes the latest price they heard from anyone, which spreads optimistic news instantly and bad news very slowly.'},
      {ic:'🗣️',h:'Office gossip',t:'You hear a rumour from one colleague and believe it until someone better informed corrects you. That is distance vector routing in words.'},
      {ic:'📡',h:'RIP routing',t:'The original internet distance-vector protocol. Simple and tiny, which is why it fits devices with very little memory.'},
      {ic:'🔗',h:'BGP',t:'The internet still runs a distance-vector protocol, but path vectors were added so a route cannot be advertised back into the network it came from.'},
      {ic:'🏠',h:'Old home routers',t:'RIP was the default on consumer routers for years, which is why small networks often converged slowly after a link dropped.'},
      {ic:'📉',h:'Financial contagion',t:'A single bad report can spread through traders like a routing loop, each amplifying what they heard rather than verifying it.'}
    ],
    lifeExplain:[
      {h:'The pattern', t:'Any network where nodes only talk to their immediate neighbours will spread good news quickly and correct bad news slowly, because correcting requires new information from outside.'},
      {h:'Why that matters at scale', t:'On a network with thousands of routers the slow convergence is not just slow — it is a window where traffic loops and the whole segment appears down.'}
    ],
    history:[
      {yr:'1969',h:'ARPANET',t:'The earliest routing exchanged estimates with neighbours, since no router could hold a map of a network growing every month.'},
      {yr:'1979',h:'RIP created',t:'Distance vector routing was formalised as an application protocol using hop count as the metric, deliberately choosing the simplest possible metric.'},
      {yr:'1984',h:'Count-to-infinity described',t:'The failure mode of slow recovery from a link failure was formally identified, explaining why hop count alone is a poor metric.'},
      {yr:'1988',h:'OSPF specified',t:'The Internet Engineering Task Force introduced link-state routing with fast convergence, in direct response to the problems distance vector had shown.'},
      {yr:'1990s',h:'Split horizon and poison reverse',t:'Practical fixes stopped routers advertising a destination back to the neighbour they learned it from, which greatly reduced looping.'},
      {yr:'1989',h:'BGP-4',t:'Border Gateway Protocol added path vectors so autonomous systems would not accept routes that had already passed through them, preventing loops at internet scale.'}
    ],
    historyExplain:[
      {h:'A pattern worth noticing', t:'Each protocol was written to fix a specific observed failure. Split horizon and poison reverse patched looping; OSPF replaced the paradigm; BGP added a loop guard.'},
      {h:'Why distance vector survived', t:'Its memory footprint is tiny and it needs no map of the network. For small embedded networks that simplicity still beats a faster algorithm that needs more memory.'}
    ],
    flash:[
      {q:'What is a distance vector?',a:'The list a router keeps giving its estimated cost to every reachable destination, plus the next hop used.'},
      {q:'What is the Bellman-Ford update rule?',a:'For each neighbour, take the minimum of the current estimate and the neighbour advertised cost plus the link cost to that neighbour.'},
      {q:'How many rounds guarantee convergence?',a:'V−1 rounds, where V is the number of routers in the network.'},
      {q:'Why is that bound V−1?',a:'A shortest path cannot repeat a vertex, so it uses at most V−1 edges, and information travels one edge per round.'},
      {q:'What is count-to-infinity?',a:'After a link failure, routers increment their estimate each round because they cannot distinguish a very distant destination from an unreachable one.'},
      {q:'How does split horizon help?',a:'A router does not advertise a destination back to the neighbour it learned that destination from, which breaks the simplest routing loops.'},
      {q:'What is poison reverse used for?',a:'It advertises a failed route as unreachable, so neighbours do not keep believing the stale cheaper value.'},
      {q:'Why was RIP poor as a metric?',a:'Hop count ignores bandwidth and delay, so it happily prefers a 30-hop 56 kbps line over a 2-hop fibre link.'}
    ],
    flashExplain:[
      {h:'Fastest way to remember', t:'Distance vector asks neighbours what they think. Link state tells everyone what is true and lets them work it out.'},
      {h:'Most common exam slip', t:'Saying the update is V rounds. It is V−1.'}
    ],
    exam:[
      {q:'Explain distance vector routing and the Bellman-Ford update rule.',a:'Each router maintains a distance vector giving its estimated cost to every reachable destination together with the next hop for each. Periodically, or when a change is detected, a router sends its entire vector to each neighbour. On receiving a neighbour vector, the router applies the rule D_x(y) = min over all neighbours v of { c(x,v) + D_v(y) }, taking the cheapest value across every neighbour and remembering which neighbour produced it. When no neighbour offers a lower value than the current entry, that entry is left unchanged.'},
      {q:'Explain count-to-infinity and describe two techniques that mitigate it.',a:'When a link fails, the router detects a change locally but cannot tell whether a distant destination is unreachable or simply very far away. It learns from its neighbours, but each neighbour still relies on the failed router for its information, so both routers increment their estimates each round, and the cost creeps towards infinity, during which traffic may loop between them. Split horizon prevents a router from advertising a destination back to the neighbour it learned that destination from, which breaks the simplest two-router loop. Poison reverse strengthens this by advertising the affected routes as unreachable, so neighbours discard the stale value immediately rather than waiting for the count to climb.'},
      {q:'Compare distance vector and link state routing.',a:'Distance vector exchanges estimates with immediate neighbours only, so each router holds an incomplete view and converges slowly, sometimes taking minutes, and recovers from failures slowly because bad news spreads gradually. Link state floods descriptions of its own links to every router in an area, so each router builds an identical topological database and computes shortest paths independently, converging in seconds after a change. Link state costs more memory and CPU per router because it runs a shortest-path computation, but it sends updates only when something actually changes, whereas distance vector sends full periodic updates regardless.'}
    ],
    examExplain:[
      {h:'Write the formula', t:'D_x(y) = min over v of { c(x,v) + D_v(y) }. The formula itself earns a guaranteed mark.'},
      {h:'Explain count-to-infinity causally', t:'Each router trusts the other, so each keeps confirming the other is wrong. Say that explicitly.'},
      {h:'For compare questions', t:'Give at least three axes. Knowledge held, update size, and convergence speed are the safest three.'}
    ],
    eli5:{
      kid:'Imagine everyone in a group knows how far it is to their closest friend but nobody knows the whole town. When a bell rings, each person tells their neighbours "I can reach the bakery in 5 minutes". If a neighbour says they can reach it in 3, you change your number to 4, because it is 1 minute from you to them plus their 3. This carries on until everybody has the same correct number. The problem starts when the road to the bakery closes: the two people who used it still believe each other and keep politely increasing their estimate, one minute at a time, until it reaches a number large enough to mean "there is no route".',
      middle:'Distance vector routing means each router keeps an estimate of the cost to every destination and learns only from its immediate neighbours. Periodically each router sends its full list to its neighbours, and applies the Bellman-Ford rule: for every destination, take the minimum of its current estimate and each neighbour advertised cost plus the link cost to that neighbour. Repeating this, a network of V routers is guaranteed to converge after at most V−1 rounds because no shortest path can use more than that many edges. The weakness is recovery: after a link fails, routers keep advertising each other as routes to the lost destination, so the estimate climbs one step per round, a problem called count-to-infinity, which split horizon and poison reverse reduce but do not eliminate.',
      engg:'Distance vector routing maintains at each router x a table D_x(y) for every destination y, updated as D_x(y) = min over neighbours v of { c(x,v) + D_v(y) }, with the originating v recorded as next hop. Vectors are exchanged periodically or triggered by change, and convergence is guaranteed within V−1 rounds because a shortest simple path contains at most V−1 edges. The principal failure mode is count-to-infinity: after a link failure, a router cannot distinguish an unreachable destination from a distant one, so mutually dependent neighbours continue to re-advertise each other and the metric increments until it exceeds the true path bound. Split horizon suppresses advertisements back toward the source of a route, and poison reverse advertises the affected entries as unreachable; both mitigate but do not eliminate the problem. RIP embodies this class with hop count as metric, bounding the metric at 16 and declaring a destination unreachable at 16, while BGP uses path vectors of traversed autonomous systems to reject routing loops at internet scale.'
    },
    eli5Explain:[
      {h:'The single idea underneath', t:'Ask your neighbours what they believe, and keep only the best answer. Everyone does the same and the truth settles everywhere.'},
      {h:'Why bad news is slower than good news', t:'A cheaper route must originate at the place that changed. Until that news physically travels each hop, nobody downstream can improve their estimate.'}
    ]
  },

  'link-state': {
    crash:[
      { tag:'THE FLIP', text:"Distance vector asks neighbours what they believe. Link state does the opposite: every router broadcasts the facts about ITS OWN LINKS to everyone, so the whole network assembles the same map and every router computes the same answer.", visual:`<svg viewBox="0 0 420 120" style="width:100%;max-width:420px"><circle cx="210" cy="58" r="20" fill="#2dd4bf"/><text x="210" y="63" text-anchor="middle" font-size="10" fill="#042f2e" font-weight="800">R1</text>${[0,1,2,3,4].map(i=>{const a=(i*72-90)*Math.PI/180;const x=210+Math.cos(a)*92,y=58+Math.sin(a)*58;return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="15" fill="#1e293b" stroke="#334155"/><line x1="210" y1="58" x2="${x.toFixed(0)}" y2="${y.toFixed(0)}" stroke="#facc15" stroke-width="2"><animate attributeName="stroke-opacity" dur="1.6s" repeatCount="indefinite" values="1;0.2;1" begin="${i*0.2}s"/></line><text x="${x.toFixed(0)}" y="${(y+4).toFixed(0)}" text-anchor="middle" font-size="9" fill="#64748b">R${i+2}</text>`}).join('')}<text x="210" y="112" text-anchor="middle" font-size="10" fill="#facc15" font-weight="800">flood the LINK, not the estimate</text></svg>`, readMs:5600 },
      { tag:'THE FIVE STEPS', text:"Each router builds a link-state packet describing its links, floods it to neighbours who forward it onward, every router stores all packets in a database, each runs Dijkstra from itself, and the result becomes the forwarding table.", visual:`<div style="font-size:11px;line-height:2.1;max-width:460px;margin:0 auto"><div><span style="color:#2dd4bf;font-weight:800">1.</span> Build LSP from its own links</div><div><span style="color:#2dd4bf;font-weight:800">2.</span> Flood to neighbours (they relay it)</div><div><span style="color:#2dd4bf;font-weight:800">3.</span> Store every LSP received</div><div><span style="color:#2dd4bf;font-weight:800">4.</span> Run Dijkstra over the database</div><div><span style="color:#2dd4bf;font-weight:800">5.</span> Turn the result into a forwarding table</div></div>`, readMs:5800 },
      { tag:'WHY IT IS FAST', text:"Because a failed link is announced to EVERYONE at once, the whole network learns of it in one flood. Distance vector has to wait for the correction to travel hop by hop.", visual:`<div style="display:flex;gap:14px;justify-content:center;align-items:center"><div style="text-align:center"><div style="font-size:28px">🐌</div><div style="color:#f472b6;font-size:10px;font-weight:800">DV</div><div style="color:#94a3b8;font-size:9px">minutes</div></div><div style="color:#334155;font-size:22px">vs</div><div style="text-align:center"><div style="font-size:28px">⚡</div><div style="color:#22c55e;font-size:10px;font-weight:800">LS</div><div style="color:#94a3b8;font-size:9px">seconds</div></div></div>`, readMs:5400 },
      { tag:'THE COST', text:"The price is real: every router stores a copy of the whole topology and runs a full Dijkstra on every change. That CPU and memory is why link state suits enterprise networks, not tiny embedded devices.", visual:`<svg viewBox="0 0 420 100" style="width:100%;max-width:420px"><text x="210" y="20" text-anchor="middle" font-size="10" fill="#64748b">trade</text><text x="105" y="52" text-anchor="middle" font-size="11" fill="#22c55e" font-weight="800">+ fast convergence</text><text x="105" y="72" text-anchor="middle" font-size="11" fill="#22c55e" font-weight="800">+ stable routes</text><text x="315" y="52" text-anchor="middle" font-size="11" fill="#f472b6" font-weight="800">− heavy memory</text><text x="315" y="72" text-anchor="middle" font-size="11" fill="#f472b6" font-weight="800">− CPU per change</text></svg>`, readMs:5400 },
      { tag:'⚡ ONE LINE', text:"Broadcast the facts, compute the answer yourself. Nobody has to trust anybody.", visual:`<div style="text-align:center"><div style="color:#2dd4bf;font-weight:900;font-size:16px;padding:16px 26px;background:rgba(45,212,191,.08);border:2px dashed rgba(45,212,191,.4);border-radius:14px;max-width:520px;margin:0 auto">Share the map, not the opinion.</div></div>`, readMs:5000 }
    ],
    crashExplain:[
      {h:'What an LSP contains', t:'The router identity, a sequence number, an age, the list of its directly attached links, and each link cost plus its status. It describes only its own neighbourhood, never a whole path.'},
      {h:'How flooding works', t:'A router sends its packet to all neighbours. Each neighbour records it, lowers the hop count, and forwards it onward, so every router in the area ends up with every packet.'},
      {h:'Why identical databases matter', t:'Every router must compute from the same information. Any difference, even temporary, would produce different tables and forward packets in a loop between routers.'}
    ],
    compare:{
      left:'Distance Vector (RIP)', right:'Link State (OSPF)',
      rows:[
        ['Shares','Its distance vector','Its own link description'],
        ['Knows about','Neighbours only','Every router in the area'],
        ['Update size','Whole table, periodically','Only when a link changes'],
        ['Runs an algorithm','Simple loop','Dijkstra per change'],
        ['Convergence','Slow, with looping','Fast, loop-free']
      ],
      bars:[
        {label:'Convergence', leftPct:25, rightPct:95, leftTxt:'Minutes', rightTxt:'Seconds'},
        {label:'Update bandwidth', leftPct:85, rightPct:35, leftTxt:'Heavy', rightTxt:'Light'},
        {label:'Router memory', leftPct:45, rightPct:95, leftTxt:'Light', rightTxt:'Heavy'},
        {label:'Loop safety', leftPct:30, rightPct:95, leftTxt:'Can loop', rightTxt:'No loops'}
      ]
    },
    compareExplain:[
      {h:'The core difference', t:'Distance vector propagates an estimate computed from partial knowledge. Link state propagates raw facts and defers every decision until each router has the complete picture.'},
      {h:'Why link state does not loop', t:'Because a router only forwards along paths derived from a complete and identical database, two routers cannot simultaneously believe a dead link is a valid path. Distance vector can, since each sees a different partial truth.'},
      {h:'The area boundary', t:'Link state routers only flood within an area to keep databases small. Areas are joined by a backbone, which is why OSPF still converges faster than the flat distance vector it replaced.'}
    ],
    solve:{
      q:'Four routers R1–R4 in one area with links R1–R2 (2), R2–R3 (3), R3–R4 (1), R1–R4 (10). R1 must flood its LSP and compute its table. How many LSPs does each router end up with, and what is R1\'s cost to R4?',
      steps:[
        {label:'STEP 1 — FLOOD',   math:'4 routers → each stores 4 LSPs',      note:'Its own plus 3 received'},
        {label:'STEP 2 — BUILD GRAPH', math:'R1–R2(2), R2–R3(3), R3–R4(1), R1–R4(10)', note:'Full topology in every database'},
        {label:'STEP 3 — ROUTE A', math:'R1→R2→R3→R4 = 2+3+1 = 6',          note:'Cheapest candidate'},
        {label:'STEP 4 — ROUTE B', math:'direct R1→R4 = 10',                 note:'Much worse'},
        {label:'STEP 5 — PICK MIN', math:'min(6, 10) = 6',                  note:'Dijkstra settles 6'},
        {label:'ANSWER',              math:'4 LSPs each,  R1→R4 cost = 6',    note:'Three hops beat the direct link'}
      ]
    },
    solveExplain:[
      {h:'Why four LSPs', t:'Each router originates exactly one packet describing its own links, and flooding guarantees all four arrive everywhere, so every database contains four packets — one per router.'},
      {h:'Why the indirect route wins', t:'The direct link costs 10 while the chain costs 2+3+1 = 6. Dijkstra explores R2 at cost 2 first, then R3 at 5, then R4 at 6, and R4 is settled before the direct link is ever considered.'},
      {h:'Why every router agrees', t:'Because all four databases are identical, every router computes the same path tree rooted at itself. That consistency is what guarantees no loops form.'},
      {h:'What changes on failure', t:'If R2–R3 drops, R2 floods a new LSP immediately. All four routers receive it in one pass and recompute within seconds, finding R1→R4 = 10 instead of waiting for a count to climb.'}
    ],
    life:[
      {ic:'🏢',h:'Enterprise networks',t:'OSPF is the default interior protocol in almost every company network, chosen precisely because fast convergence matters more than saving a little memory.'},
      {ic:'🏦',h:'Bank branches',t:'A branch link failing must reroute instantly, because the alternative is a frozen ATM network and no slow convergence window is acceptable.'},
      {ic:'☁️',h:'Cloud VPCs',t:'Cloud providers run link-state internally so thousands of virtual routers recompute together after an instance changes.'},
      {ic:'📡',h:'Mobile backhaul',t:'Aggregation networks rely on fast reconvergence so that a cell failure does not leave users without service for minutes.'},
      {ic:'🧭',h:'Autonomous systems',t:'IS-IS, the other link-state protocol, is used by many large service providers because it scales better than OSPF at very large sizes.'},
      {ic:'🗺️',h:'Campus networks',t:'A university campus runs OSPF so that a cable fault in one building reroutes around it in seconds rather than freezing labs.'}
    ],
    lifeExplain:[
      {h:'The pattern', t:'Any network where a routing outage costs real money pays the memory and CPU cost of link state, because slow convergence becomes a visible outage.'},
      {h:'Why the flooding does not explode', t:'Routers only flood inside an area, and the database is pruned of information each router already has, so the traffic stays bounded as networks grow.'}
    ],
    history:[
      {yr:'1979',h:'RIP era',t:'Distance vector dominated, and slow convergence after a failure was accepted as a limitation of small networks.'},
      {yr:'1988',h:'OSPF v1',t:'The Internet Engineering Task Force specified link-state routing with areas specifically to fix convergence and scaling.'},
      {yr:'1990',h:'IS-IS',t:'ISO produced a similar link-state protocol that became the standard inside large service provider networks.'},
      {yr:'1991',h:'Areas formalised',t:'Hierarchical areas let large networks be broken into pieces so a change floods only locally, which is what made link state scale.'},
      {yr:'2000s',h:'OSPFv3',t:'Link-state routing was adapted directly to IPv6, carrying link information instead of IPv4 addresses inside the protocol itself.'},
      {yr:'2010s',h:'Segment routing',t:'Explicit path instructions were layered over link-state databases, letting operators steer traffic across the same topology without changing routing itself.'}
    ],
    historyExplain:[
      {h:'A pattern worth noticing', t:'Each addition targeted a specific weakness: convergence, then scale, then operator control — all without abandoning the underlying flood-and-compute model.'},
      {h:'Why link state survived', t:'Because it made convergence deterministic and loop-free, which matters more than the memory it costs on any router that can afford it.'}
    ],
    flash:[
      {q:'What does a link-state packet contain?',a:'The router identity, a sequence number, an age timer, and its own attached links with their costs and status.'},
      {q:'What is flooding?',a:'Sending a packet to every neighbour, each of which stores it and forwards it onward until every router in the area has it.'},
      {q:'What algorithm runs on the database?',a:'Dijkstra shortest-path, run independently by each router with itself as the source.'},
      {q:'Why is convergence fast?',a:'A change is announced to the entire area at once, so every router reacts in the same flood rather than hop by hop.'},
      {q:'What is an OSPF area?',a:'A group of routers that flood link-state information among themselves and are joined by a backbone, limiting database size.'},
      {q:'Why does link state avoid routing loops?',a:'Every router derives its table from an identical complete database, so two routers cannot simultaneously believe a failed link is usable.'},
      {q:'Which protocol uses link state?',a:'OSPF for IPv4, OSPFv3 for IPv6, and IS-IS for large service provider networks.'},
      {q:'What is the main cost of link state?',a:'Each router must store the entire topology database and run a full shortest-path computation on every change.'}
    ],
    flashExplain:[
      {h:'Fastest way to remember', t:'Distance vector shares conclusions. Link state shares evidence and lets each router reach its own conclusion.'},
      {h:'Most common exam slip', t:'Forgetting the areas. Link state floods only within an area, never across the whole internet.'}
    ],
    exam:[
      {q:'Explain link-state routing and the five steps a router performs.',a:'Link-state routing is a dynamic technique in which each router advertises the state of its own links rather than a routing estimate. First, the router builds a link-state packet listing its own attached links with their costs and status. Second, it floods this packet to all neighbours. Third, every neighbour stores the packet and forwards it onward, so the whole area receives every packet. Fourth, each router assembles a complete link-state database and runs the Dijkstra shortest-path algorithm using itself as the source. Fifth, the resulting shortest-path tree is converted into a forwarding table used for every arriving packet.'},
      {q:'Compare link-state and distance-vector routing with respect to convergence, update traffic and router resource use.',a:'Link-state converges in seconds because a change is flooded to the entire area simultaneously, whereas distance vector converges slowly and can suffer from count-to-infinity. Link state sends only small link descriptions and only when something changes, while distance vector sends the entire routing table periodically regardless. Link state however consumes far more router memory, since each router stores the complete topology, and more CPU, since every change triggers a full Dijkstra computation. Distance vector needs only a small table of neighbours, which makes it suitable for memory-constrained devices.'},
      {q:'Explain why link-state routing cannot form routing loops, and the role of areas.',a:'A routing loop requires two routers to disagree about whether a path exists. In link-state routing every router builds its table from the same flooded database of link facts, so no router can believe a path is valid while another believes it is broken, and a consistent shared view prevents forwarding cycles. Areas limit the scale of this mechanism: routers flood link-state advertisements only within their own area and join areas through a backbone, so the database and flooding traffic stay bounded even in very large networks, while the backbone summarises inter-area reachability rather than flooding full detail.'}
    ],
    examExplain:[
      {h:'Number the five steps', t:'Listing them as 1 to 5 makes the marks obvious and matches how the examiner will mark.'},
      {h:'Tie convergence to flooding', t:'Say the change reaches everyone in one flood. That is the entire reason for the speed difference.'},
      {h:'For the loop question', t:'The key sentence is that identical databases mean routers cannot disagree about whether a path exists.'}
    ],
    eli5:{
      kid:'Imagine a town where every house puts a sign in its own front garden saying which roads leave its garden and how busy each road is. Then a town crier walks around reading every garden sign out loud, and everybody who hears repeats it until everyone has heard every sign. Now every person has the whole town map and works out the fastest route for themselves. Nobody has to trust anybody else opinion — they all read the same signs.',
      middle:'Link-state routing works like that town crier. Each router creates a packet describing only the links directly attached to it, and sends that packet to all its neighbours. Each neighbour stores it and passes it on, so eventually every router in the area has a packet from every other router, which together form a complete topology database. Each router then runs the shortest-path algorithm over that database with itself as the starting point, producing a forwarding table. Because the change is announced to everybody at the same time, a failed link is known everywhere within seconds, so all routers agree on the new routes simultaneously.',
      engg:'Link-state routing is a distributed database-driven paradigm. Each router originates a link-state advertisement containing a sequence number, an age timer and its directly attached links with their costs. Reliable flooding propagates each LSA to every router within an area, where each LSA is acknowledged and stored, and duplicate or stale advertisements are discarded by sequence number comparison. Every router therefore constructs an identical link-state database and runs Dijkstra with itself as root, yielding a shortest-path tree from which the forwarding table is derived. Because all routers derive from a common consistent database, the transient inconsistencies that cause count-to-infinity loops in distance vector are avoided. Areas partition the network to bound database size and flooding scope, connected by area 0 backbone and virtual links, with summary LSAs and prefix summarisation limiting inter-area detail. OSPF and IS-IS implement this design, and OSPFv3 extends it to IPv6 by carrying link descriptions rather than IPv4 addresses.'
    },
    eli5Explain:[
      {h:'The single idea underneath', t:'Share the raw evidence and let everyone do their own arithmetic. Nobody has to believe a single router opinion.'},
      {h:'Why areas exist', t:'Flooding to a million routers would be chaos. Areas let each small group gossip only among themselves and share a short summary with everyone else.'}
    ]
  }

});

