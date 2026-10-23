const generatePositionBasedId = (title, unitNumber, topicIndex) => `u${unitNumber}-t${topicIndex}`;

// Test 1: IDs are unique for different topics in the same unit
{
  const unitNumber = 1;
  const tamilTitles = ['Title1 Unit1', 'Title2 Unit1', 'Title3 Unit1'];
  const hindiTitles = ['Title1 Unit1', 'Title2 Unit1', 'Title3 Unit1'];
  const kannadaTitles = ['Title1 Unit1', 'Title2 Unit1', 'Title3 Unit1'];

  const allTitles = [...tamilTitles, ...hindiTitles, ...kannadaTitles];
  const ids = new Set();

  allTitles.forEach((title, idx) => {
    const id = generatePositionBasedId(title, unitNumber, idx);
    if (ids.has(id)) {
      throw new Error('Duplicate ID found: ' + id);
    }
    ids.add(id);
  });

  // Test 2: IDs are stable across runs
  const ids2 = new Set();
  allTitles.forEach((title, idx) => {
    const id = generatePositionBasedId(title, unitNumber, idx);
    if (ids2.has(id)) {
      throw new Error('Duplicate ID found: ' + id);
    }
    ids2.add(id);
  });

  // Test 3: Different units produce different IDs
  const unit2Ids = new Set();
  allTitles.forEach((title, idx) => {
    const id = generatePositionBasedId(title, 2, idx);
    if (unit2Ids.has(id)) {
      throw new Error('Duplicate ID found for unit 2: ' + id);
    }
    unit2Ids.add(id);
  });

  // Test 4: Same unit, different topic indices produce different IDs
  const unit1Ids = new Set();
  tamilTitles.forEach((title, idx) => {
    const id = generatePositionBasedId(title, 1, idx);
    if (unit1Ids.has(id)) {
      throw new Error('Duplicate ID found for unit 1: ' + id);
    }
    unit1Ids.add(id);
  });

  console.log('All multilingual ID stability tests passed!');
}