import UIKit

@main
final class DayNightAppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.backgroundColor = RoleConfiguration.brandNavy
        window.rootViewController = RoleWebViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

enum RoleConfiguration {
    static let runtimeVersion = "1.2.0"
    static let brandNavy = UIColor(red: 7.0 / 255.0, green: 26.0 / 255.0, blue: 51.0 / 255.0, alpha: 1)

    #if DRIVER
    static let role = "driver"
    static let displayName = "DAY NIGHT Driver"
    static let ArabicDisplayName = "داي نايت للمندوب"
    static let bundleIdentifier = "com.daynightae.driver"
    static let biometricService = "daynight_driver_biometric_session_v1"
    static let biometricMaximumAge: TimeInterval = 24 * 60 * 60
    #elseif MERCHANT
    static let role = "merchant"
    static let displayName = "DAY NIGHT Merchant"
    static let ArabicDisplayName = "داي نايت للتاجر"
    static let bundleIdentifier = "com.daynightae.merchant"
    static let biometricService = "daynight_merchant_biometric_session_v1"
    static let biometricMaximumAge: TimeInterval = 12 * 60 * 60
    #else
    #error("Build either the DRIVER or MERCHANT target.")
    #endif

    static var startURL: URL {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "www.daynightae.com"
        components.path = "/\(role)"
        components.queryItems = [
            URLQueryItem(name: "nativeShell", value: role),
            URLQueryItem(name: "nosplash", value: "1"),
            URLQueryItem(name: "__dn_live", value: "role-v\(runtimeVersion)"),
            URLQueryItem(name: "platform", value: "ios"),
        ]
        guard let url = components.url else {
            preconditionFailure("Invalid DAY NIGHT start URL")
        }
        return url
    }

    static func isOfficialHost(_ host: String?) -> Bool {
        guard let host = host?.lowercased() else { return false }
        return host == "daynightae.com" || host == "www.daynightae.com"
    }

    static func isRolePath(_ path: String) -> Bool {
        let normalized = path.lowercased()
        return normalized == "/\(role)" || normalized.hasPrefix("/\(role)/")
    }

    static func isRoleURL(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme?.lowercased() == "https"
            && isOfficialHost(url.host)
            && isRolePath(url.path)
    }
}
