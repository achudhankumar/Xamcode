# Accessibility Statement content
acc_body = '''
<main class="content">
  <article class="card">
    <h1>Accessibility Statement</h1>
    <p class="subtitle">Last updated: 06 October 2026</p>
    <p>XamCode AI is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.</p>
    <h2>Our Commitment</h2>
    <p>We aim to conform to the <strong>Web Content Accessibility Guidelines (WCAG) 2.2</strong> at Level AA. This is an international standard published by the World Wide Web Consortium (W3C).</p>
    <h2>Technical Accessibility</h2>
    <ul>
      <li>All meaningful images have descriptive alt text</li>
      <li>Every interactive element is keyboard reachable with visible focus indicator</li>
      <li>Focus order is logical and intuitive</li>
      <li>Forms have clear labels, instructions, and accessible error messages</li>
      <li>Color is never the only indicator of state or information</li>
      <li>Text can be resized up to 200% without loss of functionality</li>
      <li>Headings follow a logical hierarchy</li>
      <li>Buttons are coded as buttons; links as links</li>
      <li>Animations respect the prefers-reduced-motion setting</li>
    </ul>
    <h2>Feedback</h2>
    <p>If you encounter an accessibility barrier, please let us know so we can improve:</p>
    <p>Email: <a href="mailto:support@xamcode.ai">support@xamcode.ai</a></p>
    <h2>Third-Party Content</h2>
    <p>Some content on this Service is provided by third parties and may not be fully accessible. We are not responsible for the accessibility of third-party content.</p>
  </article>
</main>
'''

acc_page = make_page('Accessibility Statement - XamCode AI', acc_body)
wf('accessibility-statement.html', acc_page)
print('Accessibility Statement created!')
