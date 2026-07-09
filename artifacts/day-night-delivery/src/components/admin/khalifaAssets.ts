const defaultKhalifaBot = "/assets/daynight/khalifa-bot-reference.png";

function savedKhalifaAvatar() {
  if (typeof window === "undefined") return defaultKhalifaBot;
  try {
    return localStorage.getItem("dn_admin_khalifa_avatar") || defaultKhalifaBot;
  } catch {
    return defaultKhalifaBot;
  }
}

const khalifaAssets = {
  staticMascot: "/assets/daynight/khalifa-static-reference.png",
  loginReference: "/assets/daynight/admin-login-reference.png",
  dashboardReference: "/assets/daynight/dashboard-quiet-reference.png",
  get bot() {
    return savedKhalifaAvatar();
  },
};

export default khalifaAssets;
