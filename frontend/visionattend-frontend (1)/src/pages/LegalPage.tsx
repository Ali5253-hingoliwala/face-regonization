import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ShieldCheck, FileText, Cookie } from "lucide-react";

const content = {
  terms: {
    title: "Terms & Conditions",
    icon: FileText,
    intro: "These terms describe the rules for using VisionAttend AI, an AI-assisted attendance platform.",
    sections: [
      ["1. Account responsibility", "You are responsible for keeping your login credentials secure and for activity performed through your account. Do not share your password, OTPs, verification links, or other authentication credentials."],
      ["2. Acceptable use", "Use VisionAttend only for legitimate academic attendance and account-management purposes. Do not attempt to bypass authentication, impersonate another student, manipulate attendance records, submit another person's face, or interfere with the service."],
      ["3. AI attendance", "VisionAttend uses face recognition and liveness/anti-spoofing checks to assist attendance. AI results can be imperfect. Administrators should review exceptions and retain appropriate manual processes for disputed attendance."],
      ["4. Face registration", "Only register your own face. Do not photograph or submit another person's face without appropriate authorization. Face-related data is used for the attendance functionality described in the Privacy Policy."],
      ["5. Account suspension", "An account may be suspended or disabled for abuse, security violations, fraudulent attendance activity, or other misuse of the service."],
      ["6. Service changes", "Features, availability, security controls, and integrations may change as VisionAttend evolves. Material legal or privacy changes will be reflected in the applicable notices."],
      ["7. No guarantee of perfect recognition", "AI recognition is an assistive technology and is not guaranteed to identify every face correctly in every lighting, camera, pose, or network condition."],
      ["8. Contact", "For account, privacy, or security questions, use the contact method provided by your institution or VisionAttend administrator."],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    icon: ShieldCheck,
    intro: "This notice explains what VisionAttend AI may collect, why it is used, and the controls available to account holders.",
    sections: [
      ["1. Information we collect", "Depending on the features you use, VisionAttend may process your name, student ID, email address, gender, profile photo, authentication information, attendance records, session information, security events, and face-related biometric representations used for recognition."],
      ["2. Why we use it", "Information is used to create and secure accounts, authenticate users, verify email addresses, deliver 2FA codes, operate attendance sessions, recognize registered students, prevent spoofing and fraud, manage leave and attendance records, and provide account support."],
      ["3. Face and biometric data", "Face recognition is a sensitive processing activity. VisionAttend uses the registered face representation for attendance recognition and related security purposes, not for unrelated advertising or profiling. Only register your own face. The institution operating the service should establish the appropriate lawful basis, retention period, alternative process, and DPIA for its deployment."],
      ["4. Storage and access", "Account and attendance information is stored in the application's configured database. Access is restricted through authentication and role-based controls. Administrators can access information necessary to administer attendance and accounts."],
      ["5. Email and authentication", "Your email may be used for verification, password recovery, and 2FA. Authentication secrets such as passwords and OTPs are not stored as plain text by the security flows."],
      ["6. Retention and deletion", "Retention should follow the institution's academic, legal, and operational requirements. Account holders may request correction or deletion through their institution or service administrator, subject to records that must be retained for legitimate purposes."],
      ["7. Your choices", "You can update profile information, change your password, manage profile photos, manage 2FA, and request assistance with privacy or account matters. Consent records are versioned so the service can show what was accepted and when."],
      ["8. Changes", "This notice may be updated when the service or its processing changes. The current version is shown on this page and recorded with new consent events where applicable."],
    ],
  },
  cookies: {
    title: "Cookie & Storage Policy",
    icon: Cookie,
    intro: "VisionAttend uses browser storage primarily to keep authentication and interface preferences working.",
    sections: [
      ["1. Essential storage", "Essential browser storage is used for functions such as keeping the signed-in session token, selected role, theme preference, and other settings required for the application to work. These are not optional for core account functionality."],
      ["2. Optional cookies", "VisionAttend does not enable analytics or marketing storage by default in this build. If optional categories are introduced, they should remain off until you actively choose them in Cookie Preferences."],
      ["3. Manage preferences", "Use Cookie Preferences to review optional categories. Your preference is stored locally and can be changed later from the footer's Cookie Preferences link."],
      ["4. Third-party services", "Google Sign-In and email services may process information as part of authentication or communication. Review the relevant provider's terms and privacy information when using those integrations."],
    ],
  },
} as const;

type Kind = keyof typeof content;

export default function LegalPage({ kind }: { kind: Kind }) {
  const location = useLocation();
  const item = content[kind];
  const Icon = item.icon;
  return <div className="min-h-screen bg-bg text-ink"><header className="border-b border-line bg-panel"><div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4"><Link to="/" className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"><ArrowLeft size={16}/> Back to VisionAttend</Link><nav className="flex gap-3 text-xs text-ink-muted"><Link className={location.pathname==="/terms"?"text-accent":""} to="/terms">Terms</Link><Link className={location.pathname==="/privacy"?"text-accent":""} to="/privacy">Privacy</Link><Link className={location.pathname==="/cookies"?"text-accent":""} to="/cookies">Cookies</Link></nav></div></header><main className="mx-auto max-w-4xl px-6 py-12"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon size={21}/></div><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">VisionAttend AI</p><h1 className="font-display text-3xl font-semibold">{item.title}</h1></div></div><p className="mt-5 max-w-3xl text-sm leading-6 text-ink-muted">{item.intro}</p><div className="mt-8 space-y-5">{item.sections.map(([heading, body])=><section key={heading} className="rounded-2xl border border-line bg-panel p-5"><h2 className="font-semibold">{heading}</h2><p className="mt-2 text-sm leading-6 text-ink-muted">{body}</p></section>)}</div><p className="mt-8 text-xs leading-5 text-ink-faint">Last updated: 31 August 2026. This page is product documentation, not legal advice. Your institution or organization should review and adapt these notices for its actual deployment, jurisdiction, retention rules, and lawful basis for biometric processing.</p></main></div>;
}
