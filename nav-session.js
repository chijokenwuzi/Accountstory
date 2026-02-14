(function () {
  const hasToken = Boolean(localStorage.getItem("accountstory_token"));
  const inDemoMode = sessionStorage.getItem("accountstory_demo_mode") === "1";
  if (!hasToken && !inDemoMode) {
    return;
  }

  document.querySelectorAll('.top-nav a[href="/login"]').forEach((node) => {
    node.remove();
  });
})();
