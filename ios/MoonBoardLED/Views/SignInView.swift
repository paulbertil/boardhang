import SwiftUI

/// Sign-in sheet: email magic link + Google. (Sign in with Apple is deferred until
/// paid Apple Developer enrollment — see `AuthManager.signInWithApple`.)
///
/// Presented from the Account section of Settings. Auth is optional: dismissing this
/// leaves the app fully usable signed-out.
struct SignInView: View {
    @EnvironmentObject private var auth: AuthManager
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var isWorking = false
    @State private var magicLinkSent = false
    @State private var errorMessage: String?

    private var emailLooksValid: Bool {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.contains("@") && trimmed.contains(".")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Sign in to sync your profile across devices and unlock social features. You can keep using the app without an account.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }

                if magicLinkSent {
                    Section {
                        Label {
                            Text("Check your email for a sign-in link, then return to the app.")
                        } icon: {
                            Image(systemName: "envelope.badge")
                                .foregroundStyle(.green)
                        }
                    }
                } else {
                    Section("Email magic link") {
                        TextField("you@example.com", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Button {
                            Task { await sendMagicLink() }
                        } label: {
                            HStack {
                                Text("Email me a link")
                                Spacer()
                                if isWorking { ProgressView() }
                            }
                        }
                        .disabled(!emailLooksValid || isWorking)
                    }
                }

                Section {
                    Button {
                        Task { await signInWithGoogle() }
                    } label: {
                        Label("Continue with Google", systemImage: "globe")
                    }
                    .disabled(isWorking)
                } footer: {
                    if let errorMessage {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Sign In")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            // Once a session lands (magic-link return or Google), close the sheet.
            .onChange(of: auth.status) { _, newValue in
                if newValue != .signedOut { dismiss() }
            }
        }
    }

    private func sendMagicLink() async {
        errorMessage = nil
        isWorking = true
        defer { isWorking = false }
        do {
            try await auth.signInWithMagicLink(email: email)
            magicLinkSent = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func signInWithGoogle() async {
        errorMessage = nil
        isWorking = true
        defer { isWorking = false }
        do {
            try await auth.signInWithGoogle()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
