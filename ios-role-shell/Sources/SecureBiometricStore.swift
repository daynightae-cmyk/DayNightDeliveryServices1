import Foundation
import LocalAuthentication
import Security

struct BiometricReply: Encodable {
    var success: Bool
    var available: Bool = true
    var enrolled: Bool = false
    var deviceCredentialAvailable: Bool = true
    var biometricType: String? = nil
    var reason: String? = nil
    var error: String? = nil
    var cancelled: Bool? = nil
    var refreshToken: String? = nil
    var userId: String? = nil
    var expectedRole: String? = nil
    var createdAt: Int64? = nil
}

private struct StoredSession: Codable {
    let refreshToken: String
    let userId: String
    let expectedRole: String
    let createdAt: Int64
}

final class SecureBiometricStore {
    private let account = "verified-refresh-session"
    private let enrollmentKey = "\(RoleConfiguration.biometricService).enrolled"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let queue = DispatchQueue(label: "com.daynightae.biometric", qos: .userInitiated)
    private var activeContext: LAContext?

    func availability() -> BiometricReply {
        let context = LAContext()
        var ownerError: NSError?
        let ownerAuthenticationAvailable = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &ownerError)

        var biometricError: NSError?
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &biometricError)

        return BiometricReply(
            success: true,
            available: ownerAuthenticationAvailable,
            enrolled: enrollmentFlag,
            deviceCredentialAvailable: ownerAuthenticationAvailable,
            biometricType: biometricType(for: context),
            reason: ownerAuthenticationAvailable ? nil : ownerError?.domain
        )
    }

    func enrollmentStatus() -> BiometricReply {
        let availability = availability()
        return BiometricReply(
            success: true,
            available: availability.available,
            enrolled: enrollmentFlag,
            deviceCredentialAvailable: availability.deviceCredentialAvailable,
            biometricType: availability.biometricType,
            reason: availability.reason
        )
    }

    func enroll(inputJSON: String, completion: @escaping (BiometricReply) -> Void) {
        guard let session = sessionFromInput(inputJSON) else {
            completion(failure("invalid_enrollment_payload"))
            return
        }
        guard session.expectedRole == RoleConfiguration.role else {
            completion(failure("role_binding_mismatch"))
            return
        }

        let isArabic = boolFromInput(inputJSON, key: "isArabic")
        let context = configuredContext(isArabic: isArabic)
        activeContext = context
        let reason = isArabic
            ? "أكد هويتك لتفعيل الدخول الآمن إلى تطبيق داي نايت."
            : "Confirm your identity to enable secure DAY NIGHT sign-in."

        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { [weak self] success, error in
            guard let self else { return }
            guard success else {
                self.finish(completion, reply: self.authenticationFailure(error))
                return
            }

            self.queue.async {
                let status = self.replaceKeychainItem(with: session, context: context)
                if status == errSecSuccess {
                    self.enrollmentFlag = true
                    self.finish(completion, reply: BiometricReply(
                        success: true,
                        available: true,
                        enrolled: true,
                        deviceCredentialAvailable: true,
                        biometricType: self.biometricType(for: context),
                        userId: session.userId,
                        expectedRole: session.expectedRole,
                        createdAt: session.createdAt
                    ))
                } else {
                    self.finish(completion, reply: self.failure("keychain_write_failed_\(status)"))
                }
            }
        }
    }

    func authenticate(inputJSON: String, completion: @escaping (BiometricReply) -> Void) {
        guard enrollmentFlag else {
            completion(failure("biometric_not_enrolled"))
            return
        }

        let isArabic = boolFromInput(inputJSON, key: "isArabic")
        let context = configuredContext(isArabic: isArabic)
        activeContext = context
        let prompt = isArabic
            ? "استخدم Face ID أو رمز قفل الجهاز للدخول إلى داي نايت."
            : "Use Face ID or the device passcode to sign in to DAY NIGHT."

        queue.async { [weak self] in
            guard let self else { return }
            var query = self.baseQuery
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne
            query[kSecUseAuthenticationContext as String] = context
            query[kSecUseOperationPrompt as String] = prompt

            var result: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &result)
            guard status == errSecSuccess, let data = result as? Data else {
                if status == errSecUserCanceled || status == errSecAuthFailed || status == errSecInteractionNotAllowed {
                    self.finish(completion, reply: self.failure(
                        status == errSecUserCanceled ? "authentication_cancelled" : "authentication_failed",
                        cancelled: status == errSecUserCanceled
                    ))
                } else {
                    self.enrollmentFlag = false
                    self.finish(completion, reply: self.failure("keychain_read_failed_\(status)"))
                }
                return
            }

            do {
                let session = try self.decoder.decode(StoredSession.self, from: data)
                guard session.expectedRole == RoleConfiguration.role else {
                    self.delete()
                    self.finish(completion, reply: self.failure("role_binding_mismatch"))
                    return
                }

                let ageMilliseconds = max(0, Self.nowMilliseconds - session.createdAt)
                let maximumMilliseconds = Int64(RoleConfiguration.biometricMaximumAge * 1_000)
                guard ageMilliseconds <= maximumMilliseconds else {
                    self.delete()
                    self.finish(completion, reply: self.failure("secure_session_expired"))
                    return
                }

                self.finish(completion, reply: BiometricReply(
                    success: true,
                    available: true,
                    enrolled: true,
                    deviceCredentialAvailable: true,
                    biometricType: self.biometricType(for: context),
                    refreshToken: session.refreshToken,
                    userId: session.userId,
                    expectedRole: session.expectedRole,
                    createdAt: session.createdAt
                ))
            } catch {
                self.delete()
                self.finish(completion, reply: self.failure("secure_session_decode_failed"))
            }
        }
    }

    func disable() -> BiometricReply {
        delete()
        return BiometricReply(
            success: true,
            available: availability().available,
            enrolled: false,
            deviceCredentialAvailable: availability().deviceCredentialAvailable,
            biometricType: availability().biometricType
        )
    }

    func cancel() -> BiometricReply {
        activeContext?.invalidate()
        activeContext = nil
        return BiometricReply(
            success: true,
            available: availability().available,
            enrolled: enrollmentFlag,
            deviceCredentialAvailable: availability().deviceCredentialAvailable,
            biometricType: availability().biometricType,
            cancelled: true
        )
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: RoleConfiguration.biometricService,
            kSecAttrAccount as String: account,
        ]
    }

    private var enrollmentFlag: Bool {
        get { UserDefaults.standard.bool(forKey: enrollmentKey) }
        set { UserDefaults.standard.set(newValue, forKey: enrollmentKey) }
    }

    private static var nowMilliseconds: Int64 {
        Int64(Date().timeIntervalSince1970 * 1_000)
    }

    private func sessionFromInput(_ inputJSON: String) -> StoredSession? {
        guard
            let data = inputJSON.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let refreshToken = object["refreshToken"] as? String,
            let userId = object["userId"] as? String,
            let expectedRole = object["expectedRole"] as? String,
            !refreshToken.isEmpty,
            !userId.isEmpty,
            !expectedRole.isEmpty
        else {
            return nil
        }

        return StoredSession(
            refreshToken: refreshToken,
            userId: userId,
            expectedRole: expectedRole,
            createdAt: Self.nowMilliseconds
        )
    }

    private func boolFromInput(_ inputJSON: String, key: String) -> Bool {
        guard
            let data = inputJSON.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return false
        }
        return object[key] as? Bool ?? false
    }

    private func configuredContext(isArabic: Bool) -> LAContext {
        let context = LAContext()
        context.localizedCancelTitle = isArabic ? "إلغاء" : "Cancel"
        context.localizedFallbackTitle = isArabic ? "استخدام رمز القفل" : "Use Passcode"
        return context
    }

    private func replaceKeychainItem(with session: StoredSession, context: LAContext) -> OSStatus {
        guard let data = try? encoder.encode(session) else { return errSecParam }
        SecItemDelete(baseQuery as CFDictionary)

        var accessError: Unmanaged<CFError>?
        guard let accessControl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            .userPresence,
            &accessError
        ) else {
            return errSecAuthFailed
        }

        var query = baseQuery
        query[kSecValueData as String] = data
        query[kSecAttrAccessControl as String] = accessControl
        query[kSecUseAuthenticationContext as String] = context
        return SecItemAdd(query as CFDictionary, nil)
    }

    private func delete() {
        activeContext?.invalidate()
        activeContext = nil
        SecItemDelete(baseQuery as CFDictionary)
        enrollmentFlag = false
    }

    private func biometricType(for context: LAContext) -> String {
        switch context.biometryType {
        case .faceID:
            return "face"
        case .touchID:
            return "fingerprint"
        default:
            return "biometric"
        }
    }

    private func authenticationFailure(_ error: Error?) -> BiometricReply {
        let code = (error as? LAError)?.code
        let cancelled = code == .userCancel || code == .appCancel || code == .systemCancel
        return failure(cancelled ? "authentication_cancelled" : "authentication_failed", cancelled: cancelled)
    }

    private func failure(_ message: String, cancelled: Bool = false) -> BiometricReply {
        let current = availability()
        return BiometricReply(
            success: false,
            available: current.available,
            enrolled: enrollmentFlag,
            deviceCredentialAvailable: current.deviceCredentialAvailable,
            biometricType: current.biometricType,
            error: message,
            cancelled: cancelled
        )
    }

    private func finish(_ completion: @escaping (BiometricReply) -> Void, reply: BiometricReply) {
        DispatchQueue.main.async { [weak self] in
            self?.activeContext = nil
            completion(reply)
        }
    }
}
