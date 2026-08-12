import Link from "next/link"

export const metadata = {
  title: "Terms & Conditions",
}

export default function TermsPage() {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">
      <div className="flex flex-col gap-8 max-w-2xl mx-auto px-4 py-12">
      <div>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to RouterDash
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-2">Terms & Conditions</h1>
        <p className="text-xs text-muted-foreground">
          Last updated: August 2026 — Draft, subject to revision
        </p>
      </div>

      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">1. Usage License</h2>
          <p className="text-muted-foreground mb-2">
            RouterDash is a development tool for testing and comparing LLM models. By using this service, you agree to use it only for lawful purposes and in a way that does not infringe upon the rights of others or restrict their use and enjoyment of the service.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">2. Data & Privacy</h2>
          <p className="text-muted-foreground mb-2">
            Your API keys are stored <strong>only in this browser&apos;s localStorage</strong> and are sent directly to the respective LLM providers (OpenRouter, etc.). They are never transmitted to or stored on our servers, and are never included in saved, shared, or exported benchmarks.
          </p>
          <p className="text-muted-foreground mb-2">
            Prompts and benchmark results may be stored locally in your browser and, if you choose to share or export them, those actions are under your control. We do not collect or retain this data on our servers.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">3. No Warranty</h2>
          <p className="text-muted-foreground mb-2">
            RouterDash is provided &quot;as is&quot; without warranties of any kind, either express or implied. We make no guarantees regarding:
          </p>
          <ul className="text-muted-foreground space-y-1 ml-4">
            <li>• Accuracy of model outputs or cost calculations</li>
            <li>• Availability or uptime of the service</li>
            <li>• Data integrity or security</li>
            <li>• Compatibility with any specific LLM provider</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">4. Limitation of Liability</h2>
          <p className="text-muted-foreground mb-2">
            In no event shall the operators of RouterDash be liable for any direct, indirect, incidental, special, or consequential damages arising from your use of or inability to use this service, including but not limited to loss of data, costs incurred by API calls, or business interruption.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">5. API Providers</h2>
          <p className="text-muted-foreground mb-2">
            RouterDash interfaces with third-party LLM providers. Your use of those services is governed by their own terms and policies. You are responsible for compliance with each provider&apos;s terms and for any charges or usage limits they impose.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">6. Changes to Terms</h2>
          <p className="text-muted-foreground mb-2">
            We reserve the right to modify these terms at any time. Your continued use of RouterDash after changes constitutes acceptance of the updated terms.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">7. Contact</h2>
          <p className="text-muted-foreground">
            For questions about these terms, please reach out via{" "}
            <a
              href="https://magill.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              magill.dev
            </a>
            .
          </p>
        </div>
      </section>

      <div className="pt-4 border-t border-border/50">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to RouterDash
        </Link>
      </div>
      </div>
    </div>
  )
}
