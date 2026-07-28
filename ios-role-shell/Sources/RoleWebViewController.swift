import CoreLocation
import UIKit
import WebKit

final class RoleWebViewController: UIViewController {
    private let secureStore = SecureBiometricStore()
    private let locationManager = CLLocationManager()
    private var webView: WKWebView!
    private var progressObservation: NSKeyValueObservation?
    private var locationAlertWasShown = false

    private let loadingIndicator: UIActivityIndicatorView = {
        let view = UIActivityIndicatorView(style: .large)
        view.color = .white
        view.hidesWhenStopped = true
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    private let offlineView: UIView = {
        let view = UIView()
        view.backgroundColor = RoleConfiguration.brandNavy
        view.translatesAutoresizingMaskIntoConstraints = false
        view.isHidden = true
        return view
    }()

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func loadView() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.applicationNameForUserAgent = "DAYNIGHT/1.2 \(RoleConfiguration.role) iOS"
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.mediaTypesRequiringUserActionForPlayback = .all

        let bridgeProxy = WeakScriptMessageHandler(delegate: self)
        configuration.userContentController.add(bridgeProxy, name: "DAYNIGHT_BIOMETRIC")

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.backgroundColor = RoleConfiguration.brandNavy
        webView.isOpaque = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.translatesAutoresizingMaskIntoConstraints = false

        let root = UIView()
        root.backgroundColor = RoleConfiguration.brandNavy
        root.addSubview(webView)
        root.addSubview(loadingIndicator)
        root.addSubview(offlineView)
        buildOfflineContent()

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: root.topAnchor),
            webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: root.bottomAnchor),
            loadingIndicator.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: root.centerYAnchor),
            offlineView.topAnchor.constraint(equalTo: root.topAnchor),
            offlineView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            offlineView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            offlineView.bottomAnchor.constraint(equalTo: root.bottomAnchor),
        ])

        view = root
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        observeProgress()
        openStartRoute()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        requestLocationWhenNeeded()
    }

    deinit {
        progressObservation?.invalidate()
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "DAYNIGHT_BIOMETRIC")
    }

    private func observeProgress() {
        progressObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] webView, _ in
            guard let self else { return }
            if webView.estimatedProgress >= 0.95 {
                self.loadingIndicator.stopAnimating()
            }
        }
    }

    private func openStartRoute() {
        offlineView.isHidden = true
        loadingIndicator.startAnimating()
        webView.load(URLRequest(
            url: RoleConfiguration.startURL,
            cachePolicy: .useProtocolCachePolicy,
            timeoutInterval: 45
        ))
    }

    private func buildOfflineContent() {
        let title = UILabel()
        title.text = "تعذر الاتصال بخدمة داي نايت"
        title.textColor = .white
        title.font = .preferredFont(forTextStyle: .title2)
        title.textAlignment = .center
        title.numberOfLines = 0

        let subtitle = UILabel()
        subtitle.text = "تحقق من الإنترنت ثم اضغط إعادة المحاولة."
        subtitle.textColor = UIColor.white.withAlphaComponent(0.76)
        subtitle.font = .preferredFont(forTextStyle: .body)
        subtitle.textAlignment = .center
        subtitle.numberOfLines = 0

        let retry = UIButton(type: .system)
        var configuration = UIButton.Configuration.filled()
        configuration.title = "إعادة المحاولة"
        configuration.baseBackgroundColor = UIColor(red: 26 / 255, green: 115 / 255, blue: 232 / 255, alpha: 1)
        configuration.baseForegroundColor = .white
        configuration.cornerStyle = .large
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 14, leading: 28, bottom: 14, trailing: 28)
        retry.configuration = configuration
        retry.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [title, subtitle, retry])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        offlineView.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: offlineView.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: offlineView.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: offlineView.leadingAnchor, constant: 28),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: offlineView.trailingAnchor, constant: -28),
            title.widthAnchor.constraint(lessThanOrEqualToConstant: 420),
            subtitle.widthAnchor.constraint(lessThanOrEqualToConstant: 420),
        ])
    }

    @objc private func retryTapped() {
        openStartRoute()
    }

    private func showOffline() {
        loadingIndicator.stopAnimating()
        offlineView.isHidden = false
    }

    private func requestLocationWhenNeeded() {
        guard RoleConfiguration.role == "driver" else { return }
        switch locationManager.authorizationStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            showLocationSettingsAlert()
        case .authorizedAlways, .authorizedWhenInUse:
            locationManager.startUpdatingLocation()
        @unknown default:
            break
        }
    }

    private func showLocationSettingsAlert() {
        guard !locationAlertWasShown else { return }
        locationAlertWasShown = true
        let alert = UIAlertController(
            title: "تفعيل الموقع",
            message: "يحتاج تطبيق المندوب إلى الموقع الدقيق لبدء المهمة وعرض الملاحة الحية داخل التطبيق.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "ليس الآن", style: .cancel))
        alert.addAction(UIAlertAction(title: "فتح الإعدادات", style: .default) { _ in
            guard let settingsURL = URL(string: UIApplication.openSettingsURLString) else { return }
            UIApplication.shared.open(settingsURL)
        })
        present(alert, animated: true)
    }

    private func injectNativeBridge() {
        guard RoleConfiguration.isRoleURL(webView.url) else { return }
        let role = RoleConfiguration.role
        let script = """
        (() => {
          window.__DAY_NIGHT_NATIVE_ROLE__ = '\(role)';
          const post = (method, requestId, inputJson) => {
            window.webkit.messageHandlers.DAYNIGHT_BIOMETRIC.postMessage({
              method,
              requestId,
              inputJson: inputJson || ''
            });
          };
          window.DAYNIGHT_BIOMETRIC = {
            isAvailable: (requestId) => post('isAvailable', requestId, ''),
            hasEnrollment: (requestId) => post('hasEnrollment', requestId, ''),
            enableForCurrentSession: (requestId, inputJson) => post('enableForCurrentSession', requestId, inputJson),
            authenticate: (requestId, inputJson) => post('authenticate', requestId, inputJson),
            disable: (requestId) => post('disable', requestId, ''),
            cancel: (requestId) => post('cancel', requestId, '')
          };
        })();
        """
        webView.evaluateJavaScript(script)
    }

    private func send(_ reply: BiometricReply, requestID: String) {
        guard
            let data = try? JSONEncoder().encode(reply),
            let resultJSON = String(data: data, encoding: .utf8),
            let encodedRequest = try? JSONEncoder().encode(requestID),
            let requestLiteral = String(data: encodedRequest, encoding: .utf8),
            let encodedResult = try? JSONEncoder().encode(resultJSON),
            let resultLiteral = String(data: encodedResult, encoding: .utf8)
        else {
            return
        }

        let script = "window.__dayNightBiometricNativeResolve && window.__dayNightBiometricNativeResolve(\(requestLiteral), \(resultLiteral));"
        webView.evaluateJavaScript(script)
    }

    private func openExternal(_ url: URL) {
        UIApplication.shared.open(url)
    }
}

extension RoleWebViewController: WKNavigationDelegate {
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        let scheme = url.scheme?.lowercased() ?? ""
        if ["about", "data", "blob"].contains(scheme) {
            decisionHandler(.allow)
            return
        }

        if ["tel", "mailto", "sms", "whatsapp"].contains(scheme) {
            openExternal(url)
            decisionHandler(.cancel)
            return
        }

        guard scheme == "https" else {
            decisionHandler(.cancel)
            return
        }

        if RoleConfiguration.isOfficialHost(url.host) {
            if RoleConfiguration.isRolePath(url.path) {
                decisionHandler(.allow)
            } else {
                openStartRoute()
                decisionHandler(.cancel)
            }
            return
        }

        if url.host?.lowercased().hasSuffix(".supabase.co") == true {
            decisionHandler(.allow)
            return
        }

        openExternal(url)
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        offlineView.isHidden = true
        loadingIndicator.startAnimating()
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        injectNativeBridge()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        injectNativeBridge()
        loadingIndicator.stopAnimating()
        guard RoleConfiguration.isRoleURL(webView.url) else {
            openStartRoute()
            return
        }
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        showOffline()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showOffline()
    }
}

extension RoleWebViewController: WKUIDelegate {
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        guard navigationAction.targetFrame == nil, let url = navigationAction.request.url else { return nil }
        if RoleConfiguration.isRoleURL(url) {
            webView.load(URLRequest(url: url))
        } else {
            openExternal(url)
        }
        return nil
    }
}

extension RoleWebViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard
            message.name == "DAYNIGHT_BIOMETRIC",
            RoleConfiguration.isRoleURL(webView.url),
            let body = message.body as? [String: Any],
            let method = body["method"] as? String,
            let requestID = body["requestId"] as? String,
            !requestID.isEmpty
        else {
            return
        }

        let inputJSON = body["inputJson"] as? String ?? ""
        switch method {
        case "isAvailable":
            send(secureStore.availability(), requestID: requestID)
        case "hasEnrollment":
            send(secureStore.enrollmentStatus(), requestID: requestID)
        case "enableForCurrentSession":
            secureStore.enroll(inputJSON: inputJSON) { [weak self] reply in
                self?.send(reply, requestID: requestID)
            }
        case "authenticate":
            secureStore.authenticate(inputJSON: inputJSON) { [weak self] reply in
                self?.send(reply, requestID: requestID)
            }
        case "disable":
            send(secureStore.disable(), requestID: requestID)
        case "cancel":
            send(secureStore.cancel(), requestID: requestID)
        default:
            send(BiometricReply(success: false, error: "unknown_native_method"), requestID: requestID)
        }
    }
}

extension RoleWebViewController: CLLocationManagerDelegate {
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            manager.startUpdatingLocation()
            webView.reload()
        case .denied, .restricted:
            showLocationSettingsAlert()
        case .notDetermined:
            break
        @unknown default:
            break
        }
    }
}

private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}
