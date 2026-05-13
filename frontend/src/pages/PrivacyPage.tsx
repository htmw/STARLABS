type PrivacyPageProps = {
  onBack: () => void;
};

const LAST_UPDATED = "May 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="kv-privacy-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function PrivacyPage({ onBack }: PrivacyPageProps) {
  return (
    <div className="kv-privacy-page">
      <nav className="kv-privacy-nav">
        <button type="button" className="kv-privacy-back" onClick={onBack}>
          Back
        </button>
        <span className="kv-privacy-brand">KneeVision</span>
      </nav>

      <div className="kv-privacy-content">
        <header className="kv-privacy-header">
          <h1>Privacy Policy</h1>
          <p>Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="kv-privacy-intro">
          <p>
            KneeVision is a research and educational tool for AI-assisted knee
            osteoarthritis analysis. We take your privacy seriously. This policy
            explains what data we collect, how we use it, and what rights you
            have over it — in plain language.
          </p>
        </div>

        <Section title="1. Who We Are">
          <p>
            KneeVision is an academic project developed for research and
            portfolio purposes. It is not a commercial medical product and is
            not intended to replace professional clinical judgment.
          </p>
        </Section>

        <Section title="2. What Data We Collect">
          <p>We collect only what is necessary to run the service:</p>
          <ul>
            <li>
              <strong>Account information</strong> — your email address and a
              hashed version of your password. We never store passwords in
              plain text.
            </li>
            <li>
              <strong>Uploaded images</strong> — knee X-ray images you upload
              for analysis. These are stored temporarily and associated with
              your account.
            </li>
            <li>
              <strong>Prediction results</strong> — the AI-generated KL grade,
              confidence score, and related findings for each image you
              analyze.
            </li>
            <li>
              <strong>Chat history</strong> — messages you send to the
              AI assistant within the app, stored so you can resume
              conversations later.
            </li>
            <li>
              <strong>Research sessions</strong> — questions and answers from
              the AI Research Workspace, saved per session.
            </li>
          </ul>
          <p>
            We do not collect names, phone numbers, addresses, payment
            information, or any patient identifiers.
          </p>
        </Section>

        <Section title="3. How We Use Your Data">
          <p>Your data is used solely to:</p>
          <ul>
            <li>Authenticate you and maintain your session securely</li>
            <li>Run AI inference on your uploaded X-ray images</li>
            <li>Display and save your analysis results and chat history</li>
            <li>Improve the reliability of the service during development</li>
          </ul>
          <p>
            We do not use your data for advertising, profiling, or any
            commercial purpose.
          </p>
        </Section>

        <Section title="4. Image Storage and Retention">
          <p>
            Uploaded images are stored on our backend server. Our deployment
            uses ephemeral storage, which means images may be deleted when the
            server restarts. Prediction results and metadata are stored in a
            database and persist independently of the image files.
          </p>
          <p>
            You can delete your uploaded images and associated predictions at
            any time from the History page. Deletion is permanent and
            irreversible.
          </p>
        </Section>

        <Section title="5. Third-Party Services">
          <p>
            KneeVision uses the following third-party services to operate:
          </p>
          <ul>
            <li>
              <strong>Groq API</strong> — powers the AI chat assistant and
              Research Workspace. Messages are sent to Groq for processing.
              Groq's privacy policy applies to data sent through their API.
            </li>
            <li>
              <strong>Hugging Face</strong> — hosts the machine learning model
              used for KL grade prediction. Images are sent to Hugging Face
              for inference.
            </li>
            <li>
              <strong>MongoDB Atlas</strong> — stores your account information,
              prediction results, and chat history in a cloud database.
            </li>
            <li>
              <strong>Render</strong> — hosts the backend server.
            </li>
          </ul>
          <p>
            We recommend reviewing the privacy policies of these services if
            you have concerns about how they handle data.
          </p>
        </Section>

        <Section title="6. Data Security">
          <p>
            We take reasonable steps to protect your data:
          </p>
          <ul>
            <li>Passwords are hashed using bcrypt before storage</li>
            <li>API requests are authenticated using JSON Web Tokens (JWT)</li>
            <li>All traffic is transmitted over HTTPS</li>
          </ul>
          <p>
            However, no system is completely secure. As a research project, we
            recommend not uploading sensitive or personally identifiable patient
            data.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p>You have the right to:</p>
          <ul>
            <li>
              <strong>Access your data</strong> — all your uploads, predictions,
              and history are visible within the app
            </li>
            <li>
              <strong>Delete your data</strong> — you can delete individual
              uploads and predictions from the History page
            </li>
            <li>
              <strong>Stop using the service</strong> — you may stop at any
              time; no ongoing obligations exist
            </li>
          </ul>
          <p>
            If you want your entire account and all associated data deleted,
            contact us at the email below.
          </p>
        </Section>

        <Section title="8. Medical Disclaimer">
          <p>
            KneeVision is a research and educational tool only. It is not a
            certified medical device and its outputs should not be used as the
            sole basis for clinical decisions. Always consult a qualified
            healthcare professional for diagnosis and treatment.
          </p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>
            We may update this policy as the project evolves. The date at the
            top of this page reflects the most recent revision. Continued use
            of the service after changes are posted constitutes acceptance of
            the updated policy.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            If you have questions about this policy or want to request data
            deletion, reach out at{" "}
            <a href="mailto:kneevision@gmail.com" className="kv-privacy-link">
              kneevision@gmail.com
            </a>
            .
          </p>
        </Section>
      </div>

      <footer className="kv-privacy-footer">
        <p>KneeVision — AI-assisted knee osteoarthritis analysis</p>
        <p>This is a research project, not a certified medical product.</p>
      </footer>
    </div>
  );
}

export default PrivacyPage;
