'use strict';

const fs = require('fs');
const path = require('path');
const { createTextPdf } = require('../lib/pdf-builder');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

// 1. Computer Networks Fixture
const netPdf = createTextPdf([
  {
    title: 'Computer Networks Lecture 1: Core Architectures',
    headings: ['Layered Protocol Stack and Transmission Media'],
    paragraphs: [
      'A computer network consists of two or more autonomous computing devices linked by communication media to exchange data packets.',
      'Transmission media are categorized into guided copper or optical fiber and unguided wireless channels.',
      'The physical layer translates logical binary bits into electrical, optical, or radio physical signals.'
    ]
  },
  {
    title: 'Computer Networks Lecture 2: Packet Switching and Routing',
    headings: ['Datagram Forwarding and IP Addressing'],
    paragraphs: [
      'In a packet-switched network, routers inspect destination IP headers and consult forwarding routing tables.',
      'Subnet masks partition the 32-bit IPv4 address into network prefixes and individual host identifiers.',
      'Hierarchical CIDR routing aggregates multiple subnet prefixes to prevent global routing table explosion.'
    ]
  },
  {
    title: 'Computer Networks Lecture 3: Reliable Transport Protocols',
    headings: ['TCP Sliding Window and Congestion Avoidance'],
    paragraphs: [
      'TCP guarantees ordered reliable delivery using cumulative acknowledgements and retransmission timers.',
      'The sliding window protocol maximizes channel throughput by allowing multiple unacknowledged frames in flight.',
      'Congestion control uses additive-increase multiplicative-decrease AIMD to converge on fair network capacity.'
    ]
  }
]);
fs.writeFileSync(path.join(FIXTURES_DIR, 'computer-networks.pdf'), netPdf);

// 2. Operating Systems Fixture
const osPdf = createTextPdf([
  {
    title: 'Operating Systems Lecture 1: Process Management',
    headings: ['Process Control Blocks and CPU Scheduling'],
    paragraphs: [
      'A process is an active program in execution possessing its own distinct virtual address space and call stack.',
      'The operating system kernel maintains a Process Control Block PCB tracking registers, program counter, and state.',
      'Context switching saves hardware registers of the current process and loads the saved state of the next task.'
    ]
  },
  {
    title: 'Operating Systems Lecture 2: Memory Hierarchy and Paging',
    headings: ['Virtual Address Translation and Page Replacement'],
    paragraphs: [
      'Paging divides physical memory into fixed-size frames and logical process space into equal-sized virtual pages.',
      'The memory management unit MMU uses translation lookaside buffers TLB to accelerate virtual-to-physical address mapping.',
      'When an accessed page is not resident in physical RAM, the MMU raises a page fault trap to fetch it from disk.'
    ]
  },
  {
    title: 'Operating Systems Lecture 3: Concurrency and Synchronization',
    headings: ['Mutual Exclusion Primitives and Deadlock Prevention'],
    paragraphs: [
      'Race conditions occur when multiple concurrent threads read and mutate shared mutable state without coordination.',
      'Mutual exclusion locks and counting semaphores ensure that only one thread executes inside the critical section.',
      'Deadlocks require four simultaneous conditions: mutual exclusion, hold and wait, no preemption, and circular wait.'
    ]
  }
]);
fs.writeFileSync(path.join(FIXTURES_DIR, 'operating-systems.pdf'), osPdf);

// 3. Data Structures Fixture
const dsaPdf = createTextPdf([
  {
    title: 'Data Structures Lecture 1: Tree Architectures',
    headings: ['Binary Search Trees and Self Balancing AVL Nodes'],
    paragraphs: [
      'A binary search tree enforces the invariant that left subtree keys are strictly smaller than root and right are greater.',
      'Unbalanced binary trees degrade to linear O(N) linked list complexity in the worst-case ascending insertion order.',
      'AVL trees maintain a balance factor of minus one, zero, or one using single and double rotation operations.'
    ]
  },
  {
    title: 'Data Structures Lecture 2: Graph Exploration',
    headings: ['Depth-First Search and Breadth-First Shortest Paths'],
    paragraphs: [
      'Graphs represent pairwise node relationships through vertices connected by directed or undirected weighted edges.',
      'Breadth-first search traverses level by level using a FIFO queue to discover shortest paths in unweighted graphs.',
      'Depth-first search uses a recursion stack to explore branches deeply and compute topological sorts in DAGs.'
    ]
  },
  {
    title: 'Data Structures Lecture 3: Dynamic Programming',
    headings: ['Optimal Substructure and Overlapping Subproblems'],
    paragraphs: [
      'Dynamic programming solves complex optimization problems by decomposing them into memoized subproblem solutions.',
      'Top-down memoization caches recursive results in a lookup table, whereas bottom-up tabulation builds iteratively.',
      'The classic 0-1 knapsack problem establishes a two-dimensional recurrence relation bounded by total weight capacity.'
    ]
  }
]);
fs.writeFileSync(path.join(FIXTURES_DIR, 'data-structures.pdf'), dsaPdf);

// 4. Database Systems Fixture
const dbmsPdf = createTextPdf([
  {
    title: 'Database Systems Lecture 1: Relational Foundations',
    headings: ['Relational Algebra and Schema Normalization'],
    paragraphs: [
      'The relational model structures data into mathematical relations represented as tables of tuples and typed attributes.',
      'Primary keys uniquely identify relation tuples while foreign key constraints enforce referential integrity.',
      'Third normal form 3NF eliminates transitive functional dependencies to prevent insertion and update anomalies.'
    ]
  },
  {
    title: 'Database Systems Lecture 2: Storage and Indexing',
    headings: ['B-Tree Indexing and Query Execution Plans'],
    paragraphs: [
      'Database storage engines utilize balanced B+ Trees to minimize high-latency disk I/O operations for range queries.',
      'Leaf nodes in a B+ Tree are linked sequentially in a doubly-linked list enabling rapid sequential scans.',
      'Cost-based query optimizers inspect table statistics to select between index seeks, index scans, and hash joins.'
    ]
  },
  {
    title: 'Database Systems Lecture 3: Transaction Processing',
    headings: ['ACID Guarantees and Two-Phase Locking'],
    paragraphs: [
      'A database transaction is an atomic sequence of read and write operations preserving database consistency invariants.',
      'The ACID properties define atomicity, consistency, isolation, and durability for mission-critical enterprise systems.',
      'Strict two-phase locking 2PL prevents conflicting concurrent reads and writes, preventing dirty and non-repeatable reads.'
    ]
  }
]);
fs.writeFileSync(path.join(FIXTURES_DIR, 'database-systems.pdf'), dbmsPdf);

// 5. Software Engineering Fixture
const sePdf = createTextPdf([
  {
    title: 'Software Engineering Lecture 1: Agile Methodologies',
    headings: ['Sprint Iterations and User Story Estimation'],
    paragraphs: [
      'Agile software development values rapid iterative delivery of working software over exhaustive upfront documentation.',
      'Scrum teams plan work in time-boxed sprint iterations, tracking velocity through story points and burndown charts.',
      'User stories capture business value from the persona perspective using standard acceptance criteria.'
    ]
  },
  {
    title: 'Software Engineering Lecture 2: Architectural Patterns',
    headings: ['SOLID Design Principles and Clean Architecture'],
    paragraphs: [
      'Clean architecture separates business domain logic from volatile database drivers and web presentation frameworks.',
      'The Single Responsibility Principle asserts that a class or module should have only one reason to change.',
      'Dependency inversion dictates that high-level business policies should depend on abstractions rather than low-level details.'
    ]
  },
  {
    title: 'Software Engineering Lecture 3: Continuous Integration and Testing',
    headings: ['Automated Testing Pyramids and Deployment Pipelines'],
    paragraphs: [
      'Continuous integration mandates that developers merge code changes frequently into a shared repository with automated test gates.',
      'The testing pyramid prioritizes fast isolated unit tests at the base, followed by integration tests and end-to-end tests.',
      'Automated canary deployment strategies gradually shift user traffic to new revisions while observing health telemetry.'
    ]
  }
]);
fs.writeFileSync(path.join(FIXTURES_DIR, 'software-engineering.pdf'), sePdf);

console.log('Successfully generated 5 PDF fixtures in fixtures/');
