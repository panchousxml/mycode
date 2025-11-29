fetch("https://cdn.jsdelivr.net/gh/panchousxml/mycode@main/java/version.json?" + Date.now())
  .then(r => r.json())
  .then(v => {
    const s = document.createElement('script');
    s.src = `https://cdn.jsdelivr.net/gh/panchousxml/mycode@main/java/player.${v.build}.js`;
    document.body.appendChild(s);
  })
  .catch(err => console.error("Version load error:", err));
