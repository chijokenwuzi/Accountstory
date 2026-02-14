(function () {
  const hasToken = Boolean(localStorage.getItem("accountstory_token"));
  if (!hasToken) {
    return;
  }

  document.querySelectorAll('.top-nav a[href="/login"]').forEach((node) => {
    node.remove();
  });

  document.querySelectorAll("a.cta-pill").forEach((node) => {
    node.remove();
  });
})();
