/* ============================================================
   DATA — FORMULA WALKTHROUGH NOTES
   ------------------------------------------------------------
   Loaded after data-formulas.js. That file stores a very short
   label per step ("Number of nodes"), which reads fine in a list
   but never explains the step. This file supplies the prose the
   derivation rail needs:

     lead     - one sentence framing the whole derivation
     why[]    - index-aligned with formula.steps[]; says what that
                step actually does and why it is needed
     takeaway - the one thing to remember afterwards
     pitfall  - the mistake students most often make here

   Kept separate from data-formulas.js so the formula maths stays a
   single source of truth and this prose can be reviewed on its own.
   ============================================================ */
window.XC = window.XC || {};

const FORMULA_NOTES = {
  /* ---------------- UNIT I : topology + error control ---------------- */
  'mesh-links': {
    lead: 'The whole formula exists to undo a double count: every link is counted once from each end.',
    why: [
      'Fix the value of n first. Nothing can be computed until you know how many nodes are in the network.',
      'Each node can reach every other node except itself, so every node owns exactly n - 1 links.',
      'Multiply n by (n - 1) to get the total link ends. This is 20 for five nodes, but it is not the answer yet.',
      'Every cable was counted twice, once from each endpoint, so halve the total to remove the duplicate.',
      'Ten is the real cabling cost. The total counts cables, not links, and each one is duplex.'
    ],
    takeaway: 'n(n-1)/2 is quadratic: 5 nodes need 10 links, but 20 nodes need 190.',
    pitfall: 'Forgetting to halve, which double-counts every link.'
  },
  'star-links': {
    lead: 'In a star, no node ever links to another node, so the link count is simply the node count.',
    why: [
      'Count the workstations in the LAN. This is the only number the formula needs.',
      'Every node needs exactly one path, and that path goes to the central switch rather than to a peer.',
      'Multiply n nodes by 1 link each, so cost grows linearly instead of quadratically.',
      'Five cables reach the switch. The hub is a single point of failure, so this count buys simplicity at the cost of that risk.'
    ],
    takeaway: 'Links = n, so cost grows linearly with the number of nodes.',
    pitfall: 'Counting links between nodes instead of links to the hub.'
  },
  'bus-terminators': {
    lead: 'Terminator count depends only on the ends of the cable, never on how many nodes tap in.',
    why: [
      'Draw the single backbone that every node taps into. Adding nodes does not add terminators.',
      'An unterminated end reflects the signal straight back and corrupts the frame, so the left end needs one.',
      'The right end has exactly the same problem and needs its own terminator.',
      'Two terminators, always, whether the LAN has three nodes or three thousand.'
    ],
    takeaway: 'Terminators = 2, fixed by the physical ends of the bus, not by node count.',
    pitfall: 'Adding a terminator per node, which is the classic bus-topology confusion.'
  },
'hamming-r': {
    lead: 'You are not solving for d, you are searching for the smallest r that makes the check fit.',
    why: [
      'Start from the known quantity: d = 4 data bits that must be protected.',
      'Try r = 2 and test both sides. 2^2 = 4 cannot cover the 4 + 2 + 1 = 7 positions, so it fails.',
      'Try r = 3. Now 2^3 = 8 equals d + r + 1 = 8, so it fits and r = 3 is the minimum.',
      'The transmitted code word is d + r = 7 bits. That is the real cost of the three check bits.'
    ],
    takeaway: 'Find the smallest r such that 2^r >= d + r + 1; the code word is then d + r bits.',
    pitfall: 'Choosing r = 4 because 2^4 looks comfortably large. Minimum r is the point of the formula.'
  },
  'hamming-pos': {
    lead: 'The parity bits that failed form a binary number, and that number is the position of the bad bit.',
    why: [
      'The receiver recomputes every parity group over the code word it just received and compares.',
      'Exactly one group disagrees, so only one parity bit reads as failed. Write each result as 1 or 0.',
      'Read the failed set in the order r4 r2 r1, which is just binary. 100 in binary is 4 in decimal.',
      'Flip that single bit and the word is correct again, with no retransmission needed.'
    ],
    takeaway: 'pos = r4*4 + r2*2 + r1*1. The syndrome is the error location for free.',
    pitfall: 'Reading the parity bits low-to-high instead of in their weighted r4, r2, r1 order.'
  },
  'pure-aloha': {
    lead: 'Throughput does not grow with offered load. Past a point more traffic means more collisions and less success.',
    why: [
      'The relationship between offered load G and success S is exponential, so it peaks and then falls away.',
      'Pick a load. At G = 0.5 the exponential term works out to e^-1, which is about 0.368.',
      'Multiply: 0.5 x 0.368 gives S = 0.184, so only 18.4% of frames get through.',
      'That 18.4% is the maximum, at G = 0.5. It means roughly one frame in five survives.'
    ],
    takeaway: 'Pure ALOHA peaks at 18.4% throughput, so it wastes over 80% of capacity.',
    pitfall: 'Assuming more offered load means more throughput. The curve turns downward after 0.5.'
  },
  'vuln-time': {
    lead: 'A frame collides with any frame that starts at any moment it is on the wire, which is twice the frame time.',
    why: [
      'A frame occupies the channel for its full transmission time T_fr. That is the base window.',
      'A frame that began just before ours started is still in flight when we begin, so add T_fr before.',
      'A frame that begins while we are sending also overlaps us, so add T_fr during.',
      'Total exposure is 2 x T_fr for pure ALOHA. Slotted ALOHA cuts this to T_fr by forcing sends onto slot boundaries.'
    ],
    takeaway: 'T_vuln = 2 x T_fr (pure) but only T_fr (slotted), which is why slotted ALOHA wins.',
    pitfall: 'Counting only the frame duration and forgetting the half before it.'
  },
/* ---------------- UNIT II : sliding window + error detection ---------------- */
  'min-frame': {
    lead: 'A sender cannot know a collision happened until the collision signal travels back, so it must still be talking.',
    why: [
      'A signal from the far end of the cable takes propagation delay T_p to arrive at the sender.',
      'If that signal collided on the way, the collision has to travel back the same distance, costing another T_p.',
      'Worst case the sender waits 2 x T_p before it learns of any collision anywhere on the link.',
      'So the frame must last at least that long. This is where the 64-byte minimum on 10 Mbps Ethernet comes from.'
    ],
    takeaway: 'T_fr >= 2 x T_p. Violate it and collisions go undetected, which destroys throughput.',
    pitfall: 'Using the one-way delay instead of the round trip, which halves the required frame size.'
  },
  'gbn-window': {
    lead: 'Go-Back-N loses efficiency by never buffering out-of-order frames, so it must reserve one sequence number.',
    why: [
      'Start with m, the number of bits in the sequence number field. Standard ARQ uses m = 3 or 4.',
      'Those m bits give 2^m distinct sequence numbers. With m = 4 that is 0 through 15.',
      'One value is held back so a new frame can never be mistaken for a very old one after wraparound.',
      'The send window is the remaining 15 frames. On any error the sender goes back and resends all of them.'
    ],
    takeaway: 'W_send = 2^m - 1, and the price is retransmitting every frame after a loss.',
    pitfall: 'Using the full 2^m, which lets an old frame be confused with a new one.'
  },
  'sr-window': {
    lead: 'Selective Repeat buffers the frames that arrive out of order, so it can safely use half the number space.',
    why: [
      'With m = 4 the sequence field gives 16 values, exactly as before.',
      'Split them: half identify frames you may send, half identify frames you may receive.',
      'The halves must not overlap, or a frame you just sent could be mistaken for one you are still expecting.',
      'Both the send and receive window are 8, which is double the Go-Back-N throughput on a lossy link.'
    ],
    takeaway: 'W = 2^(m-1) at both ends, and the sender can skip past a single loss.',
    pitfall: 'Reusing the full 2^m at each end and creating ambiguity between sent and expected frames.'
  },
  'parity-rule': {
    lead: 'Parity does not correct errors, it only makes them visible by forcing an agreed count.',
    why: [
      'Count the 1 bits in the data. Here 100011 contains three.',
      'Decide whether that count is odd or even. The rule requires the total to be even, so odd needs a fix.',
      'Append a single 1 as the parity bit, which adds one more 1 and makes the total four.',
      'Transmit 1000111. The receiver recounts and a mismatch means at least one bit changed in transit.'
    ],
    takeaway: 'Parity = 1 when the 1-count is odd. It detects errors but cannot say which bit or fix them.',
    pitfall: 'Assuming parity corrects the error. It can only report that something is wrong.'
  },
'checksum-rule': {
    lead: 'Checksum is parity generalised: sum many words in one complement and let the arithmetic expose every error.',
    why: [
      'Split the data into k segments of m bits each and add them together.',
      'Add with one complement, which means every carry that overflows is added back in at the bottom.',
      'Keep folding in the remaining segments the same way until every one is included.',
      'Complement the result and append it. The receiver sums everything and a correct word gives all 1s.'
    ],
    takeaway: 'A good checksum makes the received sum all 1s, so the test is a single comparison.',
    pitfall: 'Dropping the end-around carry, which silently corrupts the sum.'
  },
  'crc-rule': {
    lead: 'CRC is just polynomial division in binary, where subtraction is XOR and no carries ever appear.',
    why: [
      'Take the generator polynomial. A degree-3 generator like 1001 is the divider you will divide by.',
      'Shift the data left by that degree, appending zeros. 1010 becomes 1010000.',
      'Run binary long division against the generator, XORing and shifting down. Every subtraction is an XOR.',
      'Whatever is left below the division line is the remainder, and that remainder is the CRC you transmit.'
    ],
    takeaway: 'The remainder after division IS the CRC. There is no magic beyond the division.',
    pitfall: 'Appending the wrong number of zeros. You must shift by exactly the generator degree.'
  },
  /* ---------------- UNIT III : routing + congestion ---------------- */
  'dijkstra-relax': {
    lead: 'The whole algorithm is this one line, repeated until nothing changes.',
    why: [
      'Take the closest unvisited node u and declare it permanent. Here A starts with distance 0.',
      'Look at one unvisited neighbour v of u and read the edge weight w(u,v) off the link.',
      'The best route to v through u costs D(u) plus that edge weight. Here 0 + 2 = 2.',
      'Compare the candidate with what we already believed about v. If it is smaller, overwrite it.'
    ],
    takeaway: 'D(v) = min(D(v), D(u) + w(u,v)), applied repeatedly from the source.',
    pitfall: 'Relaxing a node that is already finalised. Dijkstra only works because those never improve.'
  },
  'dv-update': {
    lead: 'Each router only needs its neighbours tables, not a map of the whole network.',
    why: [
      'A neighbour broadcasts what it believes. C says it can reach B in 4 hops and D in infinity.',
      'Add the cost of the link to that neighbour itself, which is the price of the first hop.',
      'That gives a candidate cost to B through C, here 3 + 4 = 7 for the path A to C to B.',
      'Compare against the best route already in the table. Keeping the smaller is the entire update rule.'
    ],
    takeaway: 'D_x(y) = min over neighbours of c(x,v) + D_v(y). Take the best, keep your own if it wins.',
    pitfall: 'Comparing totals against totals and forgetting to add the first-hop link cost.'
  },
'hier-levels': {
    lead: 'Grouping routers into levels trades a little extra work for dramatically smaller tables.',
    why: [
      'Start flat: with 720 routers each one needs an entry for all 720. This is the cost to beat.',
      'Split into 24 regions of 30. Each router holds 30 local entries plus 23 region leaders, so 53.',
      'Add another level, 8 clusters of 9 regions of 10. Now a router needs only 25 entries.',
      'The optimum sits near ln N. For 720 routers that is about 6 to 7 levels of hierarchy.'
    ],
    takeaway: 'Optimal levels = ln N. For 720 routers, about 6.6 levels, giving roughly a 28x smaller table.',
    pitfall: 'Assuming flat routing is simplest to reason about while ignoring that its table never fits.'
  },
  'leaky-bucket': {
    lead: 'The leaky bucket smooths a bursty arrival stream into a perfectly steady output, and discards the excess.',
    why: [
      'Traffic arrives in bursts of unpredictable size, which is the problem to be smoothed.',
      'The bucket absorbs a burst up to its capacity C by holding packets until there is room.',
      'Packets leak out at a constant rate r, so the downstream link always sees the same steady rate.',
      'If more than C arrive at once, the overflow is dropped. That is the deliberate cost of smoothing.'
    ],
    takeaway: 'Output is always exactly r. Smooth, predictable, and lossy by design.',
    pitfall: 'Expecting no loss. Unlike token bucket, the leaky bucket has no credit to fall back on.'
  },
  'token-bucket': {
    lead: 'Token bucket smooths the average rate but explicitly allows bursts, which is what real traffic needs.',
    why: [
      'While the link is idle, tokens accumulate in the bucket until it is full at capacity C.',
      'When a burst arrives, each byte spends one token, so up to C bytes can go out immediately.',
      'Over the long run the output is limited to the token rate, which is the average you configured.',
      'Once the burst drains the tokens, the sender is throttled back to that steady rate again.'
    ],
    takeaway: 'Average rate is fixed by rho, but a burst of up to C is always permitted.',
    pitfall: 'Confusing it with the leaky bucket. Token bucket allows bursts, leaky bucket never does.'
  },
  'dv-infinity': {
    lead: 'RIP has to store infinity in a fixed-size field, so it picks a number that is simply too large to reach.',
    why: [
      'Mathematically infinity means unreachable, but a router table has no room for a true infinity symbol.',
      'The first workaround is to cap it at something like 100, which works but wastes value space.',
      'RIP instead declares infinity to be 16, which is small enough to fit in a single byte field.',
      'The consequence is that any path of 16 hops or more is treated as unreachable, capping the network at 15.'
    ],
    takeaway: 'Infinity = 16 means RIP networks can be at most 15 hops across. Beyond that, use OSPF or BGP.',
    pitfall: 'Forgetting that a real 16-hop path silently becomes unreachable rather than merely slow.'
  },
/* ---------------- UNIT IV : TCP flow + congestion control ---------------- */
  'tcp-window-f': {
    lead: 'TCP is limited by two independent ceilings at once, and the tighter one always wins.',
    why: [
      'The receiver advertises rwnd, how much buffer space it can accept. Here 8 KB is free.',
      'TCP also tracks cwnd, its own estimate of what the network can carry. Here 4 KB.',
      'Take the smaller of the two. A large rwnd cannot help if the path itself is congested.',
      'So at most 4 KB may be unacknowledged. The window closes and reopens as ACKs come back.'
    ],
    takeaway: 'W_eff = min(rwnd, cwnd). The bottleneck decides your speed, not your buffer size.',
    pitfall: 'Tuning the receive buffer when the real limit is congestion.'
  },
  'tcp-throughput': {
    lead: 'Throughput is how many bytes you may have in flight, divided by how long a round trip takes.',
    why: [
      'W is the window, the bytes allowed in flight before you must wait for an ACK. Here 64 KB.',
      'RTT is the round-trip delay for one window to be sent and acknowledged. Here 100 ms.',
      'Divide the window by the round trip to get bytes per second: 64 KB over 0.1 s.',
      'That is 640 KB/s, roughly 5 Mbps. This is a hard ceiling for a single TCP flow on this path.'
    ],
    takeaway: 'Throughput = W / RTT. To go faster, raise the window, lower the RTT, or open more flows.',
    pitfall: 'Forgetting this is per connection, so extra bandwidth needs more parallel flows.'
  },
  'slow-start': {
    lead: 'TCP starts deliberately timid and doubles its window every round trip until it causes trouble.',
    why: [
      'Begin with one segment in flight. The sender knows nothing about the path yet.',
      'One RTT later a single ACK returns, and the sender doubles the window to 2.',
      'Another RTT and the sender doubles again to 4, because the link shows no sign of loss.',
      'The window keeps doubling: 8, 16, 32, until it reaches ssthresh and switches to linear growth.'
    ],
    takeaway: 'cwnd(t) = 2^t until ssthresh. Slow start exists to probe, not to stay slow forever.',
    pitfall: 'Staying in slow start for the whole connection. It ends at the first loss or at ssthresh.'
  },
  'aimd-f': {
    lead: 'Additive increase probes carefully upward; multiplicative decrease backs off hard and fast.',
    why: [
      'Start from the current congestion window, here 16, learned from earlier behaviour.',
      'Each RTT without loss adds exactly 1. AIMD increases additively, never by doubling.',
      'It keeps creeping upward one segment at a time, staying just under the limit it has found.',
      'On any loss the window is halved. This is the sharp drop that gives AIMD its sawtooth shape.'
    ],
    takeaway: 'cwnd+1 per RTT, cwnd/2 on loss. Slow to grow, fast to retreat.',
    pitfall: 'Growing multiplicatively during congestion avoidance and causing repeated loss.'
  },
/* ---------------- UNIT V : application layer ---------------- */
  'udp-length': {
    lead: 'UDP has no options, so the length field is the fixed 8-byte header plus whatever payload follows.',
    why: [
      'The UDP header is always 8 bytes. It never changes size.',
      'The payload is whatever the application wrote, call it N bytes.',
      'The length field is simply the sum of those two, 8 + N.',
      'That sum must fit the 16-bit field, which caps a whole UDP datagram at 65,535 bytes.'
    ],
    takeaway: 'Length = 8 + data, so maximum payload is 65,507 bytes.',
    pitfall: 'Counting only the payload and forgetting the fixed 8-byte header.'
  },
  'tcp-hlen': {
    lead: 'The HLEN field does not store bytes, it stores 32-bit words, which is why it looks oddly small.',
    why: [
      'Every TCP header begins with a fixed 20-byte portion that is always present.',
      'Options may add between 0 and 40 bytes, so the header is not a constant size.',
      'The total therefore ranges from 20 up to 60 bytes depending on the options in use.',
      'HLEN stores that total divided by 4, giving a range of 5 to 15, since the field is 4 bits wide.'
    ],
    takeaway: 'HLEN = header_bytes / 4, so it counts 32-bit words. That is why options still fit in 4 bits.',
    pitfall: 'Reading HLEN as a byte count. It is a word count, so multiply by 4 to get bytes.'
  },
  'dns-levels': {
    lead: 'DNS names are stored as a chain of labels counted from the root downwards.',
    why: [
      'Level 0 is the root, written as a single dot and holding the top-level servers.',
      'Level 1 holds the TLDs such as .com and .edu, which are managed under the root.',
      'Level 2 is the registered domain, for example example.com.',
      'The chain is capped at 128 levels, which is the practical limit the protocol imposes.'
    ],
    takeaway: 'Root is level 0 and the maximum depth is 128 labels.',
    pitfall: 'Counting levels left to right. They are counted from the root, which sits on the right.'
  },
  'http-req': {
    lead: 'The request line is three space-separated fields, and HTTP/1.1 keeps the connection open by default.',
    why: [
      'The method says what to do. GET reads a resource, and it is the safest of the common methods.',
      'The path names the resource on the server, here /index.html.',
      'The version is HTTP/1.1, which defaults to a persistent connection rather than closing per request.',
      'The three fields are joined by spaces into one line, followed by headers on the following lines.'
    ],
    takeaway: 'METHOD /path HTTP/1.1. One line, three fields, in that fixed order.',
    pitfall: 'Putting a version on the method or the path. The order is fixed by the grammar.'
  },
'ftp-ports': {
    lead: 'FTP needs two separate connections because commands and file bytes must not block each other.',
    why: [
      'The control connection opens on port 21 at login time and stays open for the whole session.',
      'Commands such as RETR travel over that control connection, never over the data connection.',
      'A second connection on port 20 opens only while the actual file bytes are moving.',
      'It closes again after each transfer, and a new one opens for the next file.'
    ],
    takeaway: 'Control = 21, Data = 20. Answer 21 unless the question asks about the data connection.',
    pitfall: 'Answering 20 when the question asks which port the commands use.'
  },
  'smtp-port': {
    lead: 'Sending mail and relaying mail use different ports because only relaying needs authentication.',
    why: [
      'A mail client submits through port 587, which is the authenticated submission port.',
      'Servers then relay between each other on port 25, plain server-to-server transfer.',
      'The message is stored in the recipient inbox once it has been accepted.',
      'The client later retrieves mail with POP3 on 110 or IMAP on 143, which are read, not send, ports.'
    ],
    takeaway: 'Submit = 587, relay = 25. Retrieve is POP3 110 or IMAP 143, neither of which sends.',
    pitfall: 'Giving 25 for client submission. That is the relay port, not the authenticated submit port.'
  },
  'telnet-port': {
    lead: 'TELNET works because both ends agree on one character set, so the two machines may differ.',
    why: [
      'The client opens a TCP session to port 23 on the remote system.',
      'Local characters are translated into NVT, the Network Virtual Terminal character set.',
      'Only 7-bit ASCII crosses the network, so the bytes mean the same thing on any machine.',
      'The remote server maps NVT back to its own native encoding before displaying the characters.'
    ],
    takeaway: 'Port 23, and NVT = 7-bit ASCII as the universal bridge between different systems.',
    pitfall: 'Thinking TELNET is secure. Every keystroke, including passwords, travels in clear text.'
  },
  'rtp-header': {
    lead: 'RTP keeps the smallest header that still carries sequence, timestamp and stream identity.',
    why: [
      'The first 32-bit word holds the version, flags and the contributor count. That is 4 bytes.',
      'The second word carries the sequence number and part of the timestamp. Another 4 bytes.',
      'The third word holds the rest of the timestamp and the SSRC, which identifies the stream.',
      'Three 32-bit words give a 12-byte minimum. A CSRC list and extensions may be appended on top.'
    ],
    takeaway: 'At least 12 bytes, being three 32-bit words. There are deliberately no acknowledgements.',
    pitfall: 'Looking for a checksum field. RTP omits one, since the transport layer handles that.'
  }
};

/* ============================================================
   ATTACH — bind notes onto the already-loaded formulas
   ------------------------------------------------------------
   why[] is padded to exactly steps.length so the walkthrough can
   index it without a guard. A formula with no notes yet still gets
   a usable rail, falling back to its existing step labels, so a
   new formula can be added without this file breaking the view.
   ============================================================ */
(function attachFormulaNotes(){
  const F = window.XC.FORMULAS || [];
  let written = 0;
  F.forEach(f => {
    const n = FORMULA_NOTES[f.id];
    if (n) written++;
    f.notes = {
      lead:    (n && n.lead)    || f.meaning,
      why:     f.steps.map((s, i) => (n && n.why[i]) || s.desc),
      takeaway: (n && n.takeaway) || f.meaning,
      pitfall: (n && n.pitfall) || ''
    };
  });
  window.XC.FORMULA_NOTES = FORMULA_NOTES;

})();