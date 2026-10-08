# Terms of Service content
tos_body = '''
<main class="content">
  <article class="card">
    <h1>Terms of Service</h1>
    <p class="subtitle">Last updated: 06 October 2026</p>
    <p>These Terms of Service govern your use of the XamCode AI Service (the "Service"). By accessing or using the Service, you agree to be bound by these Terms.</p>
    <h2>1. Acceptance of Terms</h2>
    <p>These Terms were created by XamCode AI. They set out the rules and regulations for using XamCode AI's Website and Services.</p>
    <h2>2. Description of Service</h2>
    <p>XamCode AI is a study learning application that provides interactive study materials generated from PDFs, formula cards, cheat sheets, and a Vaathiyar quiz mode.</p>
    <h2>3. User Accounts</h2>
    <p>You may be required to create an account to access certain features. You are responsible for maintaining the confidentiality of your account credentials.</p>
    <h2>4. Acceptable Use</h2>
    <p>You agree not to use the Service to:</p>
    <ul>
      <li>Violate any applicable laws or regulations</li>
      <li>Infringe intellectual property rights of others</li>
      <li>Transmit harmful, illegal, or offensive content</li>
      <li>Attempt to gain unauthorized access to the Service</li>
      <li>Interfere with or disrupt the Service</li>
    </ul>
    <h2>5. Intellectual Property</h2>
    <p>The Service and its original content, features, and functionality are owned by XamCode AI and are protected by international copyright, trademark, and other intellectual property laws.</p>
    <h2>6. Privacy</h2>
    <p>Your privacy is important to us. Our privacy practices are described in the Privacy Policy at /privacy-policy. By using the Service, you consent to the data practices described in the Privacy Policy.</p>
    <h2>7. Third-Party Services</h2>
    <p>The Service may link to third-party websites, applications, or services that are not owned or controlled by XamCode AI. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites.</p>
    <h2>8. Limitation of Liability</h2>
    <p>XamCode AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your access to or use of the Service.</p>
    <h2>9. Changes to Terms</h2>
    <p>We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the new Terms on this page. Your continued use of the Service after such changes constitutes acceptance of the updated Terms.</p>
    <h2>10. Governing Law</h2>
    <p>These Terms shall be governed by and construed in accordance with the laws of India. Any dispute arising under these Terms shall be resolved in the courts of India.</p>
    <h2>11. Contact Information</h2>
    <p>If you have any questions about these Terms, please contact us at: support@xamcode.ai</p>
  </article>
</main>
'''

tos_page = make_page('Terms of Service - XamCode AI', tos_body)
wf('terms-of-service.html', tos_page)
print('Terms of Service created!')
